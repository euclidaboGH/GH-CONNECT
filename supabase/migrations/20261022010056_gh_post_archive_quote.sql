-- Migration 56 — Durable post archive + quote-repost reference
-- Additive only. Does not modify economy / payment tables.
-- Soft-delete remains deleted_at; archive is a distinct non-destructive state.

-- ---------------------------------------------------------------------------
-- Archive (owner-only via server API; distinct from soft-delete)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gh_posts_author_archived
  ON public.gh_posts (author_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- Exclude archived from public feed index usage (new partial for active feed)
CREATE INDEX IF NOT EXISTS idx_gh_posts_feed_active
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL
    AND archived_at IS NULL
    AND visibility = 'public';

-- ---------------------------------------------------------------------------
-- Quote repost: reference original post by id (do not duplicate authoritative body)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS quote_of_post_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gh_posts_quote_of_fk'
  ) THEN
    ALTER TABLE public.gh_posts
      ADD CONSTRAINT gh_posts_quote_of_fk
      FOREIGN KEY (quote_of_post_id) REFERENCES public.gh_posts(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    -- If constraint cannot be added (legacy rows), leave column without FK
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_gh_posts_quote_of
  ON public.gh_posts (quote_of_post_id)
  WHERE quote_of_post_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- RPC: archive / unarchive own post
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_set_post_archived(
  p_post_id text,
  p_actor_id text,
  p_archived boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts WHERE id = p_post_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;
  IF v_author IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_posts
  SET archived_at = CASE WHEN COALESCE(p_archived, false) THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'ok', true,
    'post_id', p_post_id,
    'archived', COALESCE(p_archived, false),
    'archived_at', (SELECT archived_at FROM public.gh_posts WHERE id = p_post_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_set_post_archived(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_set_post_archived(text, text, boolean) TO service_role;

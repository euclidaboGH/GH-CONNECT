-- Phase 13: durable share/repost relationship (metadata only — not a second post store).

CREATE TABLE IF NOT EXISTS public.gh_post_shares (
  id              text PRIMARY KEY,
  post_id         text NOT NULL,
  sharer_id       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_post_shares_post_nonempty CHECK (length(trim(post_id)) > 0),
  CONSTRAINT gh_post_shares_sharer_nonempty CHECK (length(trim(sharer_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_post_shares_user_post
  ON public.gh_post_shares (sharer_id, post_id);

CREATE INDEX IF NOT EXISTS idx_gh_post_shares_post_created
  ON public.gh_post_shares (post_id, created_at DESC);

ALTER TABLE public.gh_post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_shares_no_client ON public.gh_post_shares;
CREATE POLICY gh_post_shares_no_client ON public.gh_post_shares
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_post_shares IS
  'Share/repost edges only. Original content remains on gh_posts. No media copies.';

CREATE OR REPLACE FUNCTION public.gh_post_share(
  p_sharer_id text,
  p_post_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
  v_id text;
  v_count integer;
BEGIN
  IF p_sharer_id IS NULL OR length(trim(p_sharer_id)) = 0 OR p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts WHERE id = trim(p_post_id);

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_sharer_id) AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = trim(p_sharer_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;

  v_id := 'share_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_post_shares (id, post_id, sharer_id)
  VALUES (v_id, trim(p_post_id), trim(p_sharer_id))
  ON CONFLICT (sharer_id, post_id) DO NOTHING;

  UPDATE public.gh_posts
  SET share_count = (
    SELECT COUNT(*)::integer FROM public.gh_post_shares WHERE post_id = trim(p_post_id)
  )
  WHERE id = trim(p_post_id);

  SELECT share_count INTO v_count FROM public.gh_posts WHERE id = trim(p_post_id);

  RETURN jsonb_build_object(
    'ok', true,
    'shareId', v_id,
    'postId', trim(p_post_id),
    'authorId', v_author,
    'shareCount', COALESCE(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_share(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_share(text, text) TO service_role;

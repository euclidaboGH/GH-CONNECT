-- Phase 2.2: durable content attention events (no economy / ranking).
-- Spec: docs/GH_ATTENTION.md
-- Does NOT mint GHC, alter balances, or compute reputation.
--
-- Existing structures (do not duplicate):
--   gh_saves          → authoritative save toggle (Phase 1)
--   gh_posts.share_count → aggregate share counter
--   gh_story_views    → story-only views
--   gh_posts          → no view_count column today
--
-- New: gh_content_events for view / qualified_view / complete (and optional
-- unified log rows for save/share without replacing gh_saves).

CREATE TABLE IF NOT EXISTS public.gh_content_events (
  id            text PRIMARY KEY,
  content_id    text NOT NULL,
  content_kind  text NOT NULL DEFAULT 'post'
                CHECK (content_kind IN ('post', 'story', 'other')),
  actor_id      text NOT NULL,
  event_type    text NOT NULL
                CHECK (event_type IN (
                  'view', 'qualified_view', 'complete', 'save', 'share'
                )),
  -- Dedup window: e.g. UTC date '2026-09-25' or hour bucket '2026-09-25T14'
  window_key    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Optional non-economic metadata only (dwell_ms, client build, etc.)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Idempotency: one row per actor × content × event × window
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_content_events_dedup
  ON public.gh_content_events (content_id, actor_id, event_type, window_key);

CREATE INDEX IF NOT EXISTS idx_gh_content_events_content_type_created
  ON public.gh_content_events (content_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_content_events_actor_created
  ON public.gh_content_events (actor_id, created_at DESC);

ALTER TABLE public.gh_content_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_events_no_client ON public.gh_content_events;
CREATE POLICY gh_content_events_no_client ON public.gh_content_events
  FOR ALL USING (false) WITH CHECK (false);

-- Optional denormalized counters on posts (views only; never client-written)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_posts'
  ) THEN
    ALTER TABLE public.gh_posts
      ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0
        CHECK (view_count >= 0);
    ALTER TABLE public.gh_posts
      ADD COLUMN IF NOT EXISTS qualified_view_count integer NOT NULL DEFAULT 0
        CHECK (qualified_view_count >= 0);
  END IF;
END $$;

/**
 * Record one attention event. Actor must be supplied by trusted server (session).
 * Returns ok + whether a new row was inserted.
 */
CREATE OR REPLACE FUNCTION public.gh_content_event_record(
  p_content_id   text,
  p_actor_id     text,
  p_event_type   text,
  p_window_key   text,
  p_content_kind text DEFAULT 'post',
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_kind text := lower(trim(COALESCE(p_content_kind, 'post')));
  v_window text := trim(COALESCE(p_window_key, ''));
  v_id text;
  v_inserted boolean := false;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_type NOT IN ('view', 'qualified_view', 'complete', 'save', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF v_kind NOT IN ('post', 'story', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTENT_KIND');
  END IF;
  IF length(v_window) = 0 OR length(v_window) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  -- Soft existence check for posts (skip hard fail for other kinds)
  IF v_kind = 'post' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_posts
      WHERE id = trim(p_content_id) AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
  END IF;

  v_id := 'ce_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_content_events (
    id, content_id, content_kind, actor_id, event_type, window_key, metadata
  ) VALUES (
    v_id,
    trim(p_content_id),
    v_kind,
    trim(p_actor_id),
    v_type,
    v_window,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (content_id, actor_id, event_type, window_key)
  DO UPDATE SET
    updated_at = now(),
    metadata = COALESCE(EXCLUDED.metadata, public.gh_content_events.metadata)
  RETURNING (xmax = 0) INTO v_inserted;

  -- Increment denormalized counters only on first insert for view types
  IF v_inserted AND v_kind = 'post' THEN
    IF v_type = 'view' THEN
      UPDATE public.gh_posts
        SET view_count = view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    ELSIF v_type = 'qualified_view' THEN
      UPDATE public.gh_posts
        SET qualified_view_count = qualified_view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'recorded', v_inserted,
    'eventType', v_type,
    'contentId', trim(p_content_id),
    'windowKey', v_window
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_content_events IS
  'Phase 2 attention signals only. No GHC/Pi/reward semantics. Saves authoritative in gh_saves.';
COMMENT ON FUNCTION public.gh_content_event_record IS
  'Server-only attention recorder. Actor must come from session, never client body identity.';

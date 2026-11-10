-- Phase 2.6 minimal security: attention writes respect visibility + blocks.
-- Does not change economy, ranking, or client APIs.

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
  v_author text;
  v_visibility text;
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

  IF v_kind = 'post' THEN
    SELECT author_id, visibility INTO v_author, v_visibility
    FROM public.gh_posts
    WHERE id = trim(p_content_id) AND deleted_at IS NULL;

    IF v_author IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;

    -- Block either direction
    IF EXISTS (
      SELECT 1 FROM public.ghc_user_blocks
      WHERE (blocker_id = trim(p_actor_id) AND blocked_id = v_author)
         OR (blocker_id = v_author AND blocked_id = trim(p_actor_id))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    -- Visibility: public | author always; followers needs follow edge; mutuals/private author-only for attention
    IF v_visibility = 'public' OR v_author = trim(p_actor_id) THEN
      NULL; -- allowed
    ELSIF v_visibility = 'followers' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.gh_follows
        WHERE follower_id = trim(p_actor_id) AND following_id = v_author
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
      END IF;
    ELSE
      -- mutuals / private: author-only for attention writes
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
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

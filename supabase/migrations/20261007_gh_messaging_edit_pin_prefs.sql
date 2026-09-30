-- Migration 55 — Message edit/pin + per-user conversation preferences
-- Additive only. Does not modify economy / payment tables.
-- Service-role writes; RLS denies direct client access (matches existing messaging pattern).

-- ---------------------------------------------------------------------------
-- Message pin flag (conversation-scoped; only members may pin via server API)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gh_messages_pinned
  ON public.gh_messages (conversation_id, is_pinned)
  WHERE is_pinned = true AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Per-user conversation preferences (pin / archive are personal, not global)
-- muted_until already exists on gh_conversation_members; extend with prefs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user_pinned
  ON public.gh_conversation_members (gh_user_id, is_pinned)
  WHERE left_at IS NULL AND is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user_archived
  ON public.gh_conversation_members (gh_user_id, is_archived)
  WHERE left_at IS NULL AND is_archived = true;

-- ---------------------------------------------------------------------------
-- RPC: edit own message (sender only, not deleted, body length bound)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_edit_message(
  p_message_id text,
  p_actor_id text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gh_messages%ROWTYPE;
  v_body text;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  v_body := left(trim(COALESCE(p_body, '')), 8000);
  IF length(v_body) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPTY_BODY');
  END IF;

  SELECT * INTO v_row FROM public.gh_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;
  IF v_row.sender_id IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = v_row.conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_messages
  SET body = v_body,
      edited_at = now()
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', p_message_id,
    'body', v_body,
    'edited_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_edit_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_edit_message(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: pin / unpin message (member of conversation only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_pin_message(
  p_message_id text,
  p_actor_id text,
  p_pinned boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gh_messages%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_row FROM public.gh_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND OR v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = v_row.conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_messages
  SET is_pinned = COALESCE(p_pinned, false)
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', p_message_id,
    'is_pinned', COALESCE(p_pinned, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pin_message(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_pin_message(text, text, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: set personal conversation prefs (pin / archive / mute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_set_conversation_prefs(
  p_conversation_id text,
  p_actor_id text,
  p_is_pinned boolean DEFAULT NULL,
  p_is_archived boolean DEFAULT NULL,
  p_muted_until timestamptz DEFAULT NULL,
  p_clear_mute boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_conversation_members
  SET
    is_pinned = COALESCE(p_is_pinned, is_pinned),
    is_archived = COALESCE(p_is_archived, is_archived),
    muted_until = CASE
      WHEN p_clear_mute THEN NULL
      WHEN p_muted_until IS NOT NULL THEN p_muted_until
      ELSE muted_until
    END
  WHERE conversation_id = p_conversation_id
    AND gh_user_id = p_actor_id
    AND left_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'conversation_id', p_conversation_id,
    'is_pinned', (SELECT is_pinned FROM public.gh_conversation_members
                  WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id),
    'is_archived', (SELECT is_archived FROM public.gh_conversation_members
                    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id),
    'muted_until', (SELECT muted_until FROM public.gh_conversation_members
                    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_set_conversation_prefs(text, text, boolean, boolean, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_set_conversation_prefs(text, text, boolean, boolean, timestamptz, boolean) TO service_role;

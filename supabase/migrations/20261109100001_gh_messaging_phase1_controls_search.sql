-- REVIEW_REQUIRED: source hardening completed; must pass disposable PostgreSQL rehearsal and dependency checks before Testnet application.
-- Messaging Phase 1 closeout: durable personal controls + indexed authorized history search.
-- Additive, service-role RPC boundary; no client table access or financial changes.
-- Requires canonical messaging foundations:
--   20261022010027_gh_messaging_durable.sql (conversations, members, messages)
--   20261022010055_gh_messaging_edit_pin_prefs.sql (member/message pin and archive fields)
--   20261022010105_gh_messaging_presence_delivery_receipts.sql (receipt table)
--   20261023010003_gh_messaging_v2.sql (messaging context/member schema extensions)
-- Explicit transaction prevents a failed migration from leaving a partially installed feature.

BEGIN;

ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS quick_reaction text NOT NULL DEFAULT '❤️',
  ADD COLUMN IF NOT EXISTS read_receipts_enabled boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(c.oid)
    INTO v_definition
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = 'public.gh_conversation_members'::regclass
    AND c.conname = 'gh_conversation_members_quick_reaction_valid';

  IF v_definition IS NULL THEN
    ALTER TABLE public.gh_conversation_members
      ADD CONSTRAINT gh_conversation_members_quick_reaction_valid
      CHECK (char_length(quick_reaction) BETWEEN 1 AND 16) NOT VALID;
  ELSIF v_definition NOT ILIKE '%char_length(quick_reaction)%'
     OR NOT (
       v_definition ILIKE '%BETWEEN 1 AND 16%'
       OR (v_definition ILIKE '%>= 1%' AND v_definition ILIKE '%<= 16%')
     ) THEN
    RAISE EXCEPTION
      'Existing constraint gh_conversation_members_quick_reaction_valid has an unexpected definition: %',
      v_definition;
  END IF;
END $$;

-- GIN index makes historical text search index-backed rather than loading a client window.
ALTER TABLE public.gh_messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, coalesce(body, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_gh_messages_search_vector
  ON public.gh_messages USING gin (search_vector);

CREATE TABLE IF NOT EXISTS public.gh_conversation_nicknames (
  conversation_id text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  target_user_id text NOT NULL,
  nickname text NOT NULL CHECK (char_length(trim(nickname)) BETWEEN 1 AND 48),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, actor_id, target_user_id),
  CHECK (actor_id <> target_user_id)
);
ALTER TABLE public.gh_conversation_nicknames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_conversation_nicknames_no_client ON public.gh_conversation_nicknames;
CREATE POLICY gh_conversation_nicknames_no_client ON public.gh_conversation_nicknames FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_conversation_nicknames FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_conversation_nicknames TO service_role;

CREATE OR REPLACE FUNCTION public.gh_set_conversation_controls(
  p_conversation_id text,
  p_actor_id text,
  p_target_user_id text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_set_nickname boolean DEFAULT false,
  p_quick_reaction text DEFAULT NULL,
  p_read_receipts_enabled boolean DEFAULT NULL,
  p_is_pinned boolean DEFAULT NULL,
  p_is_archived boolean DEFAULT NULL,
  p_muted_until timestamptz DEFAULT NULL,
  p_clear_mute boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_nickname text := nullif(trim(p_nickname), '');
  v_reaction text := nullif(trim(p_quick_reaction), '');
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_quick_reaction IS NOT NULL AND (v_reaction IS NULL OR char_length(v_reaction) > 16) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_QUICK_REACTION');
  END IF;
  IF p_set_nickname THEN
    IF p_target_user_id IS NULL OR p_target_user_id = p_actor_id OR NOT EXISTS (
      SELECT 1 FROM public.gh_conversation_members
      WHERE conversation_id = p_conversation_id AND gh_user_id = p_target_user_id AND left_at IS NULL
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_NICKNAME_TARGET'); END IF;
    IF v_nickname IS NOT NULL AND char_length(v_nickname) > 48 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_NICKNAME');
    END IF;
    IF v_nickname IS NULL THEN
      DELETE FROM public.gh_conversation_nicknames WHERE conversation_id = p_conversation_id AND actor_id = p_actor_id AND target_user_id = p_target_user_id;
    ELSE
      INSERT INTO public.gh_conversation_nicknames(conversation_id,actor_id,target_user_id,nickname,updated_at)
      VALUES(p_conversation_id,p_actor_id,p_target_user_id,v_nickname,now())
      ON CONFLICT(conversation_id,actor_id,target_user_id) DO UPDATE SET nickname=EXCLUDED.nickname, updated_at=now();
    END IF;
  END IF;
  UPDATE public.gh_conversation_members
  SET quick_reaction = COALESCE(v_reaction, quick_reaction),
      read_receipts_enabled = COALESCE(p_read_receipts_enabled, read_receipts_enabled),
      is_pinned = COALESCE(p_is_pinned, is_pinned),
      is_archived = COALESCE(p_is_archived, is_archived),
      muted_until = CASE WHEN p_clear_mute THEN NULL WHEN p_muted_until IS NOT NULL THEN p_muted_until ELSE muted_until END
  WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL;
  RETURN (SELECT jsonb_build_object('ok', true,
    'quick_reaction', quick_reaction, 'read_receipts_enabled', read_receipts_enabled)
    FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL);
END; $$;
REVOKE ALL ON FUNCTION public.gh_set_conversation_controls(text,text,text,text,boolean,text,boolean,boolean,boolean,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_set_conversation_controls(text,text,text,text,boolean,text,boolean,boolean,boolean,timestamptz,boolean) TO service_role;

-- Search is scoped to active membership and never exposes deleted messages.
CREATE OR REPLACE FUNCTION public.gh_search_conversation_messages(
  p_conversation_id text, p_actor_id text, p_query text,
  p_limit integer DEFAULT 30, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_query tsquery;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000);
  v_results jsonb;
  v_total bigint;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_query IS NULL OR char_length(trim(p_query)) < 2 OR char_length(p_query) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_QUERY');
  END IF;
  v_query := plainto_tsquery('simple', trim(p_query));
  IF numnode(v_query) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'results', '[]'::jsonb, 'total', 0,
      'limit', v_limit, 'offset', v_offset, 'has_more', false);
  END IF;
  SELECT count(*) INTO v_total FROM public.gh_messages m
    WHERE m.conversation_id = p_conversation_id AND m.deleted_at IS NULL AND m.search_vector @@ v_query;
  SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO v_results FROM (
    SELECT m.id, m.conversation_id, m.sender_id, m.body, m.status, m.created_at,
      m.edited_at, m.is_pinned, ts_rank(m.search_vector, v_query) AS rank
    FROM public.gh_messages m
    WHERE m.conversation_id = p_conversation_id AND m.deleted_at IS NULL AND m.search_vector @@ v_query
    ORDER BY rank DESC, m.created_at DESC, m.id DESC LIMIT v_limit OFFSET v_offset
  ) s;
  RETURN jsonb_build_object('ok', true, 'results', v_results, 'total', v_total,
    'limit', v_limit, 'offset', v_offset, 'has_more', v_offset + v_limit < v_total);
END; $$;
REVOKE ALL ON FUNCTION public.gh_search_conversation_messages(text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_search_conversation_messages(text,text,text,integer,integer) TO service_role;

-- Keep unread cursor current, but suppress read receipts when the member opts out.
CREATE OR REPLACE FUNCTION public.gh_messaging_mark_read(p_user_id text, p_conversation_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_now timestamptz := now(); v_receipts_enabled boolean;
BEGIN
  SELECT read_receipts_enabled INTO v_receipts_enabled FROM public.gh_conversation_members
  WHERE conversation_id = p_conversation_id AND gh_user_id = p_user_id AND left_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF coalesce(v_receipts_enabled, true) THEN
    INSERT INTO public.gh_message_receipts (message_id, conversation_id, sender_id, recipient_id, delivered_at, read_at)
    SELECT m.id, m.conversation_id, m.sender_id, p_user_id, v_now, v_now
    FROM public.gh_messages m WHERE m.conversation_id = p_conversation_id
      AND m.sender_id <> p_user_id AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC LIMIT 1000
    ON CONFLICT (message_id, recipient_id) DO UPDATE
      SET delivered_at = COALESCE(public.gh_message_receipts.delivered_at, EXCLUDED.delivered_at),
          read_at = COALESCE(public.gh_message_receipts.read_at, EXCLUDED.read_at);
  END IF;
  UPDATE public.gh_conversation_members SET last_read_at = v_now
  WHERE conversation_id = p_conversation_id AND gh_user_id = p_user_id AND left_at IS NULL;
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.gh_messaging_mark_read(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_mark_read(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_get_conversation_controls(p_conversation_id text, p_actor_id text, p_target_user_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  RETURN (SELECT jsonb_build_object('ok', true,
    'quick_reaction', quick_reaction, 'read_receipts_enabled', read_receipts_enabled,
    'is_pinned', is_pinned, 'is_archived', is_archived, 'muted_until', muted_until,
    'nickname', CASE WHEN EXISTS (SELECT 1 FROM public.gh_conversation_members tm
      WHERE tm.conversation_id = p_conversation_id AND tm.gh_user_id = p_target_user_id AND tm.left_at IS NULL)
      THEN (SELECT n.nickname FROM public.gh_conversation_nicknames n
        WHERE n.conversation_id = p_conversation_id AND n.actor_id = p_actor_id
        AND n.target_user_id = p_target_user_id) ELSE NULL END)
    FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL);
END; $$;
REVOKE ALL ON FUNCTION public.gh_get_conversation_controls(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_get_conversation_controls(text,text,text) TO service_role;

COMMIT;

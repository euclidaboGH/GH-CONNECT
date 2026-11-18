-- GreenHaven Messaging V2: durable context, stable cursors, and transaction/community links.
-- Service-role writes only. Authz remains server-side membership/ownership based.

ALTER TABLE public.gh_conversations
  ADD COLUMN IF NOT EXISTS context_type text,
  ADD COLUMN IF NOT EXISTS context_id text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_id text;

ALTER TABLE public.gh_conversations
  DROP CONSTRAINT IF EXISTS gh_conversations_context_type_check;
ALTER TABLE public.gh_conversations
  ADD CONSTRAINT gh_conversations_context_type_check
  CHECK (context_type IS NULL OR context_type IN ('marketplace_order','community','post','system'));

CREATE INDEX IF NOT EXISTS idx_gh_conversations_context
  ON public.gh_conversations (context_type, context_id)
  WHERE context_type IS NOT NULL AND context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gh_conversations_updated_id
  ON public.gh_conversations (updated_at DESC, id DESC);

ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user_updated
  ON public.gh_conversation_members (gh_user_id, is_archived, is_pinned, conversation_id)
  WHERE left_at IS NULL;

ALTER TABLE public.gh_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id text,
  ADD COLUMN IF NOT EXISTS shared_type text,
  ADD COLUMN IF NOT EXISTS shared_id text;

ALTER TABLE public.gh_messages
  DROP CONSTRAINT IF EXISTS gh_messages_shared_type_check;
ALTER TABLE public.gh_messages
  ADD CONSTRAINT gh_messages_shared_type_check
  CHECK (shared_type IS NULL OR shared_type IN ('post','marketplace_listing','marketplace_order','profile','community'));

CREATE INDEX IF NOT EXISTS idx_gh_messages_conversation_created_id
  ON public.gh_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gh_messages_reply_to
  ON public.gh_messages (conversation_id, reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gh_messages_shared
  ON public.gh_messages (shared_type, shared_id)
  WHERE shared_type IS NOT NULL AND shared_id IS NOT NULL;

-- First-class context projection used by marketplace transaction chat and community chat.
CREATE OR REPLACE FUNCTION public.gh_messaging_set_conversation_context(
  p_conversation_id text,
  p_actor_id text,
  p_context_type text,
  p_context_id text,
  p_title text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text := NULLIF(trim(COALESCE(p_context_type,'')), '');
  v_id text := NULLIF(trim(COALESCE(p_context_id,'')), '');
BEGIN
  IF p_conversation_id IS NULL OR p_actor_id IS NULL OR v_type IS NULL OR v_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  IF v_type NOT IN ('marketplace_order','community','post','system') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_CONTEXT');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id=p_conversation_id AND gh_user_id=p_actor_id AND left_at IS NULL
  ) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;

  UPDATE public.gh_conversations
  SET context_type=v_type,
      context_id=v_id,
      title=COALESCE(NULLIF(left(trim(COALESCE(p_title,'')),120),''), title),
      avatar_url=COALESCE(NULLIF(left(trim(COALESCE(p_avatar_url,'')),2048),''), avatar_url),
      updated_at=now()
  WHERE id=p_conversation_id;

  RETURN jsonb_build_object('ok',true,'conversationId',p_conversation_id,'contextType',v_type,'contextId',v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_set_conversation_context(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_set_conversation_context(text,text,text,text,text,text) TO service_role;

-- Server-authoritative delivery acknowledgement. It never marks a message read.
CREATE OR REPLACE FUNCTION public.gh_messaging_mark_delivered(
  p_user_id text,
  p_conversation_id text,
  p_message_ids text[]
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_now timestamptz := now(); v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_conversation_members WHERE conversation_id=p_conversation_id AND gh_user_id=p_user_id AND left_at IS NULL) THEN
    RETURN 0;
  END IF;
  INSERT INTO public.gh_message_receipts(message_id,conversation_id,sender_id,recipient_id,delivered_at)
  SELECT m.id,m.conversation_id,m.sender_id,p_user_id,v_now
  FROM public.gh_messages m
  WHERE m.conversation_id=p_conversation_id
    AND m.sender_id<>p_user_id
    AND m.deleted_at IS NULL
    AND m.id=ANY(COALESCE(p_message_ids,ARRAY[]::text[]))
  ON CONFLICT(message_id,recipient_id) DO UPDATE
    SET delivered_at=COALESCE(public.gh_message_receipts.delivered_at,EXCLUDED.delivered_at);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_mark_delivered(text,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_mark_delivered(text,text,text[]) TO service_role;

COMMENT ON COLUMN public.gh_conversations.context_type IS 'Durable product context for exact cross-surface navigation.';
COMMENT ON COLUMN public.gh_messages.shared_type IS 'Server-validated shared entity type.';
COMMENT ON COLUMN public.gh_messages.shared_id IS 'Server-validated shared entity identifier.';

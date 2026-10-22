-- Durable messaging delivery/read receipts and privacy-scoped presence/typing.
-- Server routes use the service role only after authenticating the session and
-- verifying active conversation membership. Clients receive no direct table access.

CREATE TABLE IF NOT EXISTS public.gh_message_receipts (
  message_id     text NOT NULL REFERENCES public.gh_messages(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  sender_id      text NOT NULL,
  recipient_id   text NOT NULL,
  delivered_at   timestamptz,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_id),
  CONSTRAINT gh_message_receipts_sender_nonempty CHECK (length(trim(sender_id)) > 0),
  CONSTRAINT gh_message_receipts_recipient_nonempty CHECK (length(trim(recipient_id)) > 0),
  CONSTRAINT gh_message_receipts_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT gh_message_receipts_read_implies_delivery CHECK (read_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_recipient_unread
  ON public.gh_message_receipts (recipient_id, conversation_id, delivered_at, read_at);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_sender_status
  ON public.gh_message_receipts (sender_id, conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_conversation_recipient_message
  ON public.gh_message_receipts (conversation_id, recipient_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_conversation_message
  ON public.gh_message_receipts (conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_messages_conversation_sender_created
  ON public.gh_messages (conversation_id, sender_id, created_at DESC)
  WHERE deleted_at IS NULL;


CREATE TABLE IF NOT EXISTS public.gh_messaging_preferences (
  user_id                       text PRIMARY KEY,
  who_can_message               text NOT NULL DEFAULT 'everyone'
                                CHECK (who_can_message IN ('everyone', 'matches-only', 'no-one')),
  who_can_message_configured    boolean NOT NULL DEFAULT false,
  online_status                 text NOT NULL DEFAULT 'everyone'
                                CHECK (online_status IN ('everyone', 'matches-only', 'hidden')),
  online_status_configured      boolean NOT NULL DEFAULT false,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_messaging_preferences_user_nonempty CHECK (length(trim(user_id)) > 0)
);

-- Forward-compatible if a deployment already applied an earlier draft of this migration.
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS who_can_message_configured boolean NOT NULL DEFAULT false;
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS online_status text NOT NULL DEFAULT 'everyone'
  CHECK (online_status IN ('everyone', 'matches-only', 'hidden'));
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS online_status_configured boolean NOT NULL DEFAULT false;

ALTER TABLE public.gh_messaging_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_messaging_preferences_no_client ON public.gh_messaging_preferences;
CREATE POLICY gh_messaging_preferences_no_client ON public.gh_messaging_preferences
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_messaging_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_messaging_preferences TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_user_presence (
  user_id                 text PRIMARY KEY,
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  online_until            timestamptz NOT NULL DEFAULT now(),
  typing_conversation_id  text,
  typing_until            timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_presence_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_user_presence_typing_pair CHECK (
    (typing_conversation_id IS NULL AND typing_until IS NULL) OR
    (typing_conversation_id IS NOT NULL AND typing_until IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_gh_user_presence_online_until
  ON public.gh_user_presence (online_until DESC);
CREATE INDEX IF NOT EXISTS idx_gh_user_presence_typing_until
  ON public.gh_user_presence (typing_conversation_id, typing_until)
  WHERE typing_conversation_id IS NOT NULL;

ALTER TABLE public.gh_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_message_receipts_no_client ON public.gh_message_receipts;
CREATE POLICY gh_message_receipts_no_client ON public.gh_message_receipts
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_message_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_message_receipts TO service_role;
DROP POLICY IF EXISTS gh_user_presence_no_client ON public.gh_user_presence;
CREATE POLICY gh_user_presence_no_client ON public.gh_user_presence
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_user_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_user_presence TO service_role;

COMMENT ON TABLE public.gh_message_receipts IS
  'Per-recipient delivery and read receipts. A message is delivered only after a recipient client fetches it, and read only after the conversation is actively marked read.';
COMMENT ON TABLE public.gh_user_presence IS
  'Short-lived server-backed online and typing presence. API returns presence only to active members of the same conversation.';

-- Atomically update read receipts and the member's unread cursor in one transaction.
CREATE OR REPLACE FUNCTION public.gh_messaging_mark_read(
  p_user_id text,
  p_conversation_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.gh_user_id = p_user_id
      AND cm.left_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.gh_message_receipts (
    message_id, conversation_id, sender_id, recipient_id, delivered_at, read_at
  )
  SELECT m.id, m.conversation_id, m.sender_id, p_user_id, v_now, v_now
  FROM public.gh_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC
  LIMIT 1000
  ON CONFLICT (message_id, recipient_id) DO UPDATE
    SET delivered_at = COALESCE(public.gh_message_receipts.delivered_at, EXCLUDED.delivered_at),
        read_at = COALESCE(public.gh_message_receipts.read_at, EXCLUDED.read_at);

  UPDATE public.gh_conversation_members cm
  SET last_read_at = v_now
  WHERE cm.conversation_id = p_conversation_id
    AND cm.gh_user_id = p_user_id
    AND cm.left_at IS NULL;

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_mark_read(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_mark_read(text, text) TO service_role;

-- One bounded RPC keeps inbox unread counts current without an N+1 query per conversation.
CREATE OR REPLACE FUNCTION public.gh_messaging_unread_counts(
  p_user_id text,
  p_conversation_ids text[]
)
RETURNS TABLE(conversation_id text, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.conversation_id, count(m.id)::bigint AS unread_count
  FROM public.gh_conversation_members cm
  LEFT JOIN public.gh_messages m
    ON m.conversation_id = cm.conversation_id
   AND m.sender_id <> p_user_id
   AND m.deleted_at IS NULL
   AND m.created_at > COALESCE(cm.last_read_at, cm.joined_at)
  WHERE cm.gh_user_id = p_user_id
    AND cm.left_at IS NULL
    AND cm.conversation_id = ANY(COALESCE(p_conversation_ids, ARRAY[]::text[]))
  GROUP BY cm.conversation_id;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_unread_counts(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_unread_counts(text, text[]) TO service_role;

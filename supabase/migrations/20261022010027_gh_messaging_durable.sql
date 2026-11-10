-- Durable DM/group messaging for GH CONNECT
-- Linked to canonical GH user ids. Service-role writes; RLS denies direct client access.
-- Realtime (if enabled later) must still authorize via membership — never trust client channel alone.
-- Additive only. Does not modify ghc_transactions / payment tables.

CREATE TABLE IF NOT EXISTS public.gh_conversations (
  id                text PRIMARY KEY,
  kind              text NOT NULL DEFAULT 'direct'
                    CHECK (kind IN ('direct', 'group', 'community')),
  title             text,
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz,
  last_message_preview text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_conversations_created_by_nonempty CHECK (length(trim(created_by)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_conversations_updated
  ON public.gh_conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_conversation_members (
  conversation_id   text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  gh_user_id        text NOT NULL,
  role              text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('member', 'admin', 'owner')),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  left_at           timestamptz,
  muted_until       timestamptz,
  last_read_at      timestamptz,
  PRIMARY KEY (conversation_id, gh_user_id),
  CONSTRAINT gh_conversation_members_user_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user
  ON public.gh_conversation_members (gh_user_id)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gh_messages (
  id                text PRIMARY KEY,
  conversation_id   text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  sender_id         text NOT NULL,
  client_message_id text,
  body              text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  edited_at         timestamptz,
  deleted_at        timestamptz,
  deleted_by        text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_messages_sender_nonempty CHECK (length(trim(sender_id)) > 0),
  CONSTRAINT gh_messages_body_len CHECK (char_length(body) <= 8000)
);

-- Idempotent client retries: one client_message_id per sender per conversation
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_messages_client_dedupe
  ON public.gh_messages (conversation_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gh_messages_conversation_created
  ON public.gh_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_messages_sender
  ON public.gh_messages (sender_id, created_at DESC);

ALTER TABLE public.gh_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_conversations_no_client ON public.gh_conversations;
CREATE POLICY gh_conversations_no_client ON public.gh_conversations
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_conversation_members_no_client ON public.gh_conversation_members;
CREATE POLICY gh_conversation_members_no_client ON public.gh_conversation_members
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_messages_no_client ON public.gh_messages;
CREATE POLICY gh_messages_no_client ON public.gh_messages
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_messages IS
  'Authoritative chat history. Drafts stay client-only. Service-role access; membership enforced in app server.';

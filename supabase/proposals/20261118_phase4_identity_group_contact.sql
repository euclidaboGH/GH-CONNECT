-- Phase 4 identity + messenger group/contact proposal.
-- HOLD: proposal only. Do not rename into supabase/migrations or apply until:
-- 1) Testnet/Mainnet migration histories are independently reconciled;
-- 2) every dependency below is present and version-compatible;
-- 3) clean PostgreSQL rehearsal + rollback/partial-failure tests pass;
-- 4) explicit operator approval is recorded.
--
-- Dependencies: gh_sessions, gh_conversations, gh_conversation_members, gh_social_notification_create,
-- gh_messages (client_message_id/shared_type/shared_id/meta), gh_pi_identities,
-- gh_user_profiles, ghc_user_blocks, service_role.
-- No economy, wallet, rewards, payment, or entitlement objects are touched.

-- ---------------------------------------------------------------------------
-- Atomic per-account session ceiling + durable session issue.
-- The advisory lock serializes concurrent issuances for one GH identity.
-- Keep the newest max_active - 1 active sessions, then insert this session.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_session_issue_with_cap(
  p_id text,
  p_token_hash text,
  p_gh_user_id text,
  p_created_at timestamptz,
  p_last_seen_at timestamptz,
  p_expires_at timestamptz,
  p_absolute_expires_at timestamptz,
  p_user_agent_hash text,
  p_meta jsonb,
  p_max_active integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_revoked integer := 0;
  v_existing public.gh_sessions%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_id !~ '^([0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_gh_user_id IS NULL OR length(trim(p_gh_user_id)) = 0 OR length(p_gh_user_id) > 180
     OR COALESCE(p_max_active, 0) < 1 OR p_max_active > 32
     OR (p_user_agent_hash IS NOT NULL AND (length(p_user_agent_hash) <> 32 OR p_user_agent_hash !~ '^[0-9a-f]{32}$'))
     OR jsonb_typeof(COALESCE(p_meta, '{}'::jsonb)) <> 'object' OR pg_column_size(COALESCE(p_meta, '{}'::jsonb)) > 4096
     OR p_expires_at <= p_created_at OR p_absolute_expires_at < p_expires_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SESSION');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_gh_user_id, 0));

  SELECT * INTO v_existing FROM public.gh_sessions WHERE id = p_id::uuid;
  IF FOUND THEN
    IF v_existing.token_hash = p_token_hash AND v_existing.gh_user_id = p_gh_user_id THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'revoked_count', 0);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'SESSION_ID_CONFLICT');
  END IF;

  WITH overflow AS (
    SELECT id
    FROM public.gh_sessions
    WHERE gh_user_id = p_gh_user_id
      AND revoked_at IS NULL
      AND expires_at > now()
      AND absolute_expires_at > now()
    ORDER BY last_seen_at DESC, created_at DESC, id DESC
    OFFSET GREATEST(p_max_active - 1, 0)
  )
  UPDATE public.gh_sessions s
     SET revoked_at = now()
    FROM overflow o
   WHERE s.id = o.id;
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  INSERT INTO public.gh_sessions (
    id, token_hash, gh_user_id, created_at, last_seen_at,
    expires_at, absolute_expires_at, revoked_at, user_agent_hash, meta
  ) VALUES (
    p_id::uuid, p_token_hash, p_gh_user_id, p_created_at, p_last_seen_at,
    p_expires_at, p_absolute_expires_at, NULL, p_user_agent_hash,
    COALESCE(p_meta, '{}'::jsonb)
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'revoked_count', v_revoked);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_session_issue_with_cap(text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_session_issue_with_cap(text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,jsonb,integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Pending group invitations. A new group starts with the creator only; invitees
-- become members only after accepting their own invitation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_conversation_invites (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  invited_user_id text NOT NULL,
  invited_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  responded_at timestamptz,
  CONSTRAINT gh_conversation_invites_no_self CHECK (invited_user_id <> invited_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_conversation_invites_pending
  ON public.gh_conversation_invites (conversation_id, invited_user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_gh_conversation_invites_inbox
  ON public.gh_conversation_invites (invited_user_id, created_at DESC)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_conversations_creator_request
  ON public.gh_conversations (created_by, (meta->>'clientRequestId'))
  WHERE kind = 'group' AND meta->>'clientRequestId' IS NOT NULL;
ALTER TABLE public.gh_conversation_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_conversation_invites_no_client ON public.gh_conversation_invites;
CREATE POLICY gh_conversation_invites_no_client ON public.gh_conversation_invites
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_conversation_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_conversation_invites TO service_role;

-- Keep the denormalized conversation member count aligned with active membership
-- for all existing and newly created groups, including leave/remove operations.
CREATE OR REPLACE FUNCTION public.gh_messaging_sync_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_conversation_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_conversation_id := OLD.conversation_id;
  ELSE
    v_conversation_id := NEW.conversation_id;
  END IF;
  UPDATE public.gh_conversations c
     SET member_count = (
       SELECT count(*)::integer FROM public.gh_conversation_members m
        WHERE m.conversation_id = v_conversation_id AND m.left_at IS NULL
     ),
     updated_at = GREATEST(c.updated_at, now())
   WHERE c.id = v_conversation_id;
  IF TG_OP = 'UPDATE' AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    UPDATE public.gh_conversations c
       SET member_count = (
         SELECT count(*)::integer FROM public.gh_conversation_members m
          WHERE m.conversation_id = OLD.conversation_id AND m.left_at IS NULL
       ),
       updated_at = GREATEST(c.updated_at, now())
     WHERE c.id = OLD.conversation_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_gh_messaging_member_count_sync ON public.gh_conversation_members;
CREATE TRIGGER trg_gh_messaging_member_count_sync
AFTER INSERT OR UPDATE OF left_at, conversation_id OR DELETE
ON public.gh_conversation_members
FOR EACH ROW EXECUTE FUNCTION public.gh_messaging_sync_member_count();
REVOKE ALL ON FUNCTION public.gh_messaging_sync_member_count() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gh_messaging_group_create_from_dm(
  p_group_id text,
  p_source_conversation_id text,
  p_actor_id text,
  p_title text,
  p_invited_user_ids text[] DEFAULT ARRAY[]::text[],
  p_client_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_peer text;
  v_peer_count integer := 0;
  v_target text;
  v_invitees text[] := ARRAY[]::text[];
  v_invite_id text;
  v_existing_id text;
  v_existing_title text;
  v_existing_meta jsonb;
  v_title text := left(trim(COALESCE(p_title, '')), 80);
BEGIN
  UPDATE public.gh_conversation_invites
     SET status = 'expired', responded_at = now()
   WHERE status = 'pending' AND expires_at <= now();

  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 OR length(p_actor_id) > 180
     OR p_group_id IS NULL OR p_group_id !~ '^[a-zA-Z0-9_-]{12,100}$'
     OR p_source_conversation_id IS NULL OR length(trim(p_source_conversation_id)) = 0
     OR p_client_request_id IS NULL OR p_client_request_id !~ '^[a-zA-Z0-9_-]{8,80}$'
     OR v_title = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_GROUP');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id || ':' || p_client_request_id, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversations c
    JOIN public.gh_conversation_members m ON m.conversation_id = c.id
    WHERE c.id = p_source_conversation_id AND c.kind = 'direct'
      AND m.gh_user_id = p_actor_id AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SOURCE_CONVERSATION_FORBIDDEN');
  END IF;
  SELECT count(*)::integer INTO v_peer_count
    FROM public.gh_conversation_members m
   WHERE m.conversation_id = p_source_conversation_id
     AND m.left_at IS NULL AND m.gh_user_id <> p_actor_id;
  IF v_peer_count <> 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'SOURCE_PEER_INVALID'); END IF;
  SELECT m.gh_user_id INTO v_peer
    FROM public.gh_conversation_members m
   WHERE m.conversation_id = p_source_conversation_id
     AND m.left_at IS NULL AND m.gh_user_id <> p_actor_id
   ORDER BY m.joined_at ASC LIMIT 1;

  v_invitees := array_append(v_invitees, v_peer);
  FOREACH v_target IN ARRAY COALESCE(p_invited_user_ids, ARRAY[]::text[]) LOOP
    v_target := trim(COALESCE(v_target, ''));
    IF v_target = '' OR length(v_target) > 180 OR v_target ~ '[[:cntrl:]]' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INVITEE');
    END IF;
    IF v_target <> p_actor_id AND NOT (v_target = ANY(v_invitees)) THEN
      v_invitees := array_append(v_invitees, v_target);
    END IF;
  END LOOP;
  IF cardinality(v_invitees) < 1 OR cardinality(v_invitees) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVITEE_LIMIT');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_invitees) x
    WHERE NOT EXISTS (SELECT 1 FROM public.gh_pi_identities i WHERE i.gh_user_id = x)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVITEE_NOT_FOUND');
  END IF;
  SELECT array_agg(x ORDER BY x) INTO v_invitees FROM unnest(v_invitees) x;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_actor_id AND b.blocked_id = ANY(v_invitees))
       OR (b.blocked_id = p_actor_id AND b.blocker_id = ANY(v_invitees))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED_PARTICIPANT');
  END IF;
  SELECT id, title, meta INTO v_existing_id, v_existing_title, v_existing_meta
    FROM public.gh_conversations
   WHERE created_by = p_actor_id AND kind = 'group'
     AND meta->>'clientRequestId' = p_client_request_id
   LIMIT 1;
  IF FOUND THEN
    IF v_existing_title <> v_title
       OR v_existing_meta->>'sourceConversationId' <> p_source_conversation_id
       OR v_existing_meta->'inviteeUserIds' IS DISTINCT FROM to_jsonb(v_invitees) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'durable', true, 'idempotent', true,
      'conversation_id', v_existing_id, 'invited_count', cardinality(v_invitees));
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_conversations WHERE id = p_group_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GROUP_ID_CONFLICT');
  END IF;

  INSERT INTO public.gh_conversations (id, kind, title, created_by, created_at, updated_at, meta)
  VALUES (p_group_id, 'group', v_title, p_actor_id, now(), now(), jsonb_build_object('created_from', 'direct', 'clientRequestId', p_client_request_id, 'sourceConversationId', p_source_conversation_id, 'inviteeUserIds', to_jsonb(v_invitees)));
  INSERT INTO public.gh_conversation_members (conversation_id, gh_user_id, role)
  VALUES (p_group_id, p_actor_id, 'owner');

  FOREACH v_target IN ARRAY v_invitees LOOP
    v_invite_id := 'ginv_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.gh_conversation_invites (id, conversation_id, invited_user_id, invited_by)
    VALUES (v_invite_id, p_group_id, v_target, p_actor_id);
    PERFORM public.gh_social_notification_create(
      v_target, p_actor_id, 'system', 'none', p_group_id,
      'Group invitation', 'You have been invited to join ' || v_title,
      'group-invite:' || v_invite_id,
      jsonb_build_object('category', 'messages', 'open', 'messages', 'tab', 'messages',
        'conversationId', p_group_id, 'groupInviteId', v_invite_id)
    );
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'durable', true, 'conversation_id', p_group_id, 'invited_count', cardinality(v_invitees));
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_group_create_from_dm(text,text,text,text,text[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_group_create_from_dm(text,text,text,text,text[],text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_messaging_group_invite_respond(
  p_invite_id text,
  p_actor_id text,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_inv public.gh_conversation_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.gh_conversation_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR v_inv.invited_user_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  END IF;
  IF v_inv.status <> 'pending' THEN
    IF (v_inv.status = 'accepted' AND p_accept IS TRUE)
       OR (v_inv.status = 'declined' AND p_accept IS FALSE) THEN
      RETURN jsonb_build_object('ok', true, 'durable', true, 'idempotent', true,
        'accepted', p_accept, 'conversation_id', v_inv.conversation_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_PENDING');
  END IF;
  IF v_inv.expires_at <= now() THEN
    UPDATE public.gh_conversation_invites SET status = 'expired', responded_at = now() WHERE id = v_inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_EXPIRED');
  END IF;
  IF p_accept THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_conversation_members m
       WHERE m.conversation_id = v_inv.conversation_id
         AND m.gh_user_id = v_inv.invited_by AND m.left_at IS NULL
    ) THEN
      UPDATE public.gh_conversation_invites SET status = 'expired', responded_at = now() WHERE id = v_inv.id;
      RETURN jsonb_build_object('ok', false, 'error', 'GROUP_UNAVAILABLE');
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.gh_conversation_members m
        JOIN public.ghc_user_blocks b
          ON (b.blocker_id = p_actor_id AND b.blocked_id = m.gh_user_id)
          OR (b.blocker_id = m.gh_user_id AND b.blocked_id = p_actor_id)
       WHERE m.conversation_id = v_inv.conversation_id
         AND m.left_at IS NULL AND m.gh_user_id <> p_actor_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED_PARTICIPANT');
    END IF;
    INSERT INTO public.gh_conversation_members (conversation_id, gh_user_id, role)
    VALUES (v_inv.conversation_id, p_actor_id, 'member')
    ON CONFLICT (conversation_id, gh_user_id) DO NOTHING;
    UPDATE public.gh_conversation_invites SET status = 'accepted', responded_at = now() WHERE id = v_inv.id;
  ELSE
    UPDATE public.gh_conversation_invites SET status = 'declined', responded_at = now() WHERE id = v_inv.id;
  END IF;
  PERFORM public.gh_social_notification_create(
    v_inv.invited_by, p_actor_id, 'system', 'none', v_inv.conversation_id,
    CASE WHEN p_accept THEN 'Group invitation accepted' ELSE 'Group invitation declined' END,
    CASE WHEN p_accept THEN 'A member accepted your group invitation.' ELSE 'A member declined your group invitation.' END,
    'group-invite-response:' || v_inv.id,
    jsonb_build_object('category', 'messages', 'open', 'messages', 'tab', 'messages',
      'conversationId', v_inv.conversation_id, 'groupInviteId', v_inv.id, 'accepted', p_accept)
  );
  RETURN jsonb_build_object('ok', true, 'durable', true, 'accepted', COALESCE(p_accept, false), 'conversation_id', v_inv.conversation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_group_invite_respond(text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_group_invite_respond(text,text,boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- Consent-based contact sharing: only the authenticated actor's own public
-- profile may be shared. No phone, email, private profile fields or other user's
-- identity may be injected by the client.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_messaging_share_own_contact(
  p_conversation_id text,
  p_actor_id text,
  p_client_message_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_message public.gh_messages%ROWTYPE;
  v_id text := 'msg_' || replace(gen_random_uuid()::text, '-', '');
  v_body text := 'Shared their GreenHaven profile';
  v_visibility text := 'everyone';
  v_onboarded boolean := false;
BEGIN
  IF p_conversation_id IS NULL OR length(trim(p_conversation_id)) = 0
     OR p_actor_id IS NULL OR length(trim(p_actor_id)) = 0
     OR p_client_message_id IS NULL OR length(trim(p_client_message_id)) < 8 OR length(p_client_message_id) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTACT_SHARE');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = p_conversation_id AND m.gh_user_id = p_actor_id AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT COALESCE(
    p.profile_payload->'privacySettings'->>'profileVisibility',
    p.profile_payload->'privacy'->>'profileVisibility',
    'everyone'
  ), p.onboarded
    INTO v_visibility, v_onboarded
    FROM public.gh_user_profiles p
   WHERE p.gh_user_id = p_actor_id;
  IF NOT FOUND OR NOT v_onboarded OR v_visibility <> 'everyone' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PUBLIC_PROFILE_UNAVAILABLE');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    JOIN public.ghc_user_blocks b
      ON (b.blocker_id = p_actor_id AND b.blocked_id = m.gh_user_id)
      OR (b.blocker_id = m.gh_user_id AND b.blocked_id = p_actor_id)
    WHERE m.conversation_id = p_conversation_id AND m.left_at IS NULL AND m.gh_user_id <> p_actor_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED_PARTICIPANT');
  END IF;

  INSERT INTO public.gh_messages (
    id, conversation_id, sender_id, client_message_id, body, status,
    created_at, meta, shared_type, shared_id
  ) VALUES (
    v_id, p_conversation_id, p_actor_id, p_client_message_id, v_body, 'sent',
    now(), jsonb_build_object('sharedType', 'profile'), 'profile', p_actor_id
  ) ON CONFLICT (conversation_id, sender_id, client_message_id) WHERE client_message_id IS NOT NULL DO NOTHING;

  SELECT * INTO v_message FROM public.gh_messages
   WHERE conversation_id = p_conversation_id AND sender_id = p_actor_id
     AND client_message_id = p_client_message_id LIMIT 1;
  IF NOT FOUND OR v_message.shared_type <> 'profile' OR v_message.shared_id <> p_actor_id OR v_message.body <> v_body THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
  END IF;
  UPDATE public.gh_conversations
     SET updated_at = GREATEST(updated_at, now()),
         last_message_at = v_message.created_at,
         last_message_preview = v_body
   WHERE id = p_conversation_id
     AND (last_message_at IS NULL OR last_message_at <= v_message.created_at);
  RETURN jsonb_build_object(
    'ok', true, 'durable', true, 'idempotent', v_message.id <> v_id,
    'message', jsonb_build_object(
      'id', v_message.id, 'conversationId', v_message.conversation_id,
      'senderId', v_message.sender_id, 'body', v_message.body,
      'createdAt', (extract(epoch FROM v_message.created_at) * 1000)::bigint,
      'status', v_message.status, 'sharedType', v_message.shared_type, 'sharedId', v_message.shared_id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_share_own_contact(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_share_own_contact(text,text,text) TO service_role;

COMMENT ON TABLE public.gh_conversation_invites IS
  'Pending per-recipient group invitations. Invitees are not members until they accept via the service-role RPC.';

-- ---------------------------------------------------------------------------
-- Canonical community member directory: only public identity fields are
-- returned; private profile attributes are never selected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_community_member_directory(
  p_community_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_privacy text;
  v_role text;
  v_members jsonb;
  v_total integer;
BEGIN
  IF p_community_id IS NULL OR length(trim(p_community_id)) = 0
     OR p_viewer_id IS NULL OR length(trim(p_viewer_id)) = 0
     OR p_limit < 1 OR p_limit > 100 OR p_offset < 0 OR p_offset > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DIRECTORY_QUERY');
  END IF;
  SELECT privacy INTO v_privacy FROM public.gh_communities
   WHERE id = trim(p_community_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  v_role := public.gh_community_platform_role(p_community_id, p_viewer_id);
  IF v_privacy <> 'public' AND v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT count(*)::integer INTO v_total FROM public.gh_community_members
   WHERE community_id = p_community_id AND status = 'active';
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.gh_user_id,
    'name', CASE WHEN q.profile_visibility = 'everyone' THEN COALESCE(NULLIF(q.display_name, ''), NULLIF(q.username, ''), 'GreenHaven member') ELSE 'Private member' END,
    'username', CASE WHEN q.profile_visibility = 'everyone' THEN q.username ELSE NULL END,
    'photo', CASE WHEN q.profile_visibility = 'everyone' THEN q.photos->>0 ELSE NULL END,
    'role', q.role,
    'joinedAt', extract(epoch FROM q.joined_at) * 1000
  ) ORDER BY q.joined_at ASC, q.gh_user_id ASC), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT m.gh_user_id, m.role, m.joined_at,
           p.display_name, p.username, p.photos,
           COALESCE(p.profile_payload->'privacySettings'->>'profileVisibility', p.profile_payload->'privacy'->>'profileVisibility', 'everyone') AS profile_visibility
      FROM public.gh_community_members m
      LEFT JOIN public.gh_user_profiles p ON p.gh_user_id = m.gh_user_id
     WHERE m.community_id = p_community_id AND m.status = 'active'
     ORDER BY m.joined_at ASC, m.gh_user_id ASC
     LIMIT p_limit OFFSET p_offset
  ) q;
  RETURN jsonb_build_object('ok', true, 'durable', true, 'members', v_members,
    'total', v_total, 'limit', p_limit, 'offset', p_offset, 'hasMore', p_offset + p_limit < v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_community_member_directory(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_member_directory(text,text,integer,integer) TO service_role;

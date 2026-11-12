-- Run ONLY after migration 20261109100001 is approved/applied on disposable Testnet.
-- Execute as a trusted database operator; transaction rolls back all fixtures.
BEGIN;
DO $$
DECLARE
  v_cid text := 'phase1-accept-' || gen_random_uuid()::text;
  v_member text := 'phase1-member-' || gen_random_uuid()::text;
  v_peer text := 'phase1-peer-' || gen_random_uuid()::text;
  v_outsider text := 'phase1-outsider-' || gen_random_uuid()::text;
  v_mid text := 'phase1-message-' || gen_random_uuid()::text;
  v_result jsonb;
BEGIN
  INSERT INTO public.gh_conversations(id, kind, title, created_by)
    VALUES (v_cid, 'direct', 'Phase 1 acceptance fixture', v_member);
  INSERT INTO public.gh_conversation_members(conversation_id, gh_user_id, role)
    VALUES (v_cid, v_member, 'member'), (v_cid, v_peer, 'member');
  INSERT INTO public.gh_messages(id, conversation_id, sender_id, body)
    VALUES (v_mid, v_cid, v_peer, 'private zebra phase one phrase');

  v_result := public.gh_search_conversation_messages(v_cid, v_member, 'zebra', 20, 0);
  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE
     OR coalesce((v_result->>'total')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'Active member full-history search failed: %', v_result;
  END IF;

  v_result := public.gh_search_conversation_messages(v_cid, v_outsider, 'zebra', 20, 0);
  IF v_result->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN
    RAISE EXCEPTION 'Outsider search was not rejected: %', v_result;
  END IF;

  v_result := public.gh_set_conversation_controls(
    v_cid, v_member, v_peer, 'Peer alias', true, '🔥', false,
    NULL, NULL, NULL, false
  );
  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Member preference update failed: %', v_result;
  END IF;

  v_result := public.gh_set_conversation_controls(
    v_cid, v_member, v_outsider, 'Invalid alias', true, NULL, NULL,
    NULL, NULL, NULL, false
  );
  IF v_result->>'error' IS DISTINCT FROM 'INVALID_NICKNAME_TARGET' THEN
    RAISE EXCEPTION 'Nickname for non-member was not rejected: %', v_result;
  END IF;

  IF public.gh_messaging_mark_read(v_member, v_cid) IS NOT TRUE THEN
    RAISE EXCEPTION 'Member read cursor did not advance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_message_receipts WHERE message_id = v_mid AND recipient_id = v_member) THEN
    RAISE EXCEPTION 'Read receipt was written after opt-out';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = v_cid AND gh_user_id = v_member AND last_read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Read cursor missing after receipt opt-out';
  END IF;

  v_result := public.gh_edit_message(v_mid, v_member, 'unauthorized edit');
  IF v_result->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN
    RAISE EXCEPTION 'Non-sender edit was not rejected: %', v_result;
  END IF;
  v_result := public.gh_edit_message(v_mid, v_peer, 'authorized edit');
  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sender edit failed: %', v_result;
  END IF;

  v_result := public.gh_pin_message(v_mid, v_outsider, true);
  IF v_result->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN
    RAISE EXCEPTION 'Outsider pin was not rejected: %', v_result;
  END IF;
  v_result := public.gh_pin_message(v_mid, v_member, true);
  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Active member pin failed: %', v_result;
  END IF;
END $$;
ROLLBACK;

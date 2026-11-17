-- Dependency guard: these call RPCs operate on public.gh_call_sessions, which is created only by
-- supabase/proposals/20261111090001_direct_call_sessions_proposal.sql. Fail closed with a clear message.
DO $guard$ BEGIN
  IF to_regclass('public.gh_call_sessions') IS NULL OR to_regclass('public.gh_call_signals') IS NULL THEN
    RAISE EXCEPTION 'GH_CALL_TABLES_MISSING: apply the direct call sessions proposal (public.gh_call_sessions, public.gh_call_signals) before this migration';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.gh_call_start(p_call_id text,p_conversation_id text,p_actor_id text,p_media_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE v_peer text; v_member_count integer; v_row public.gh_call_sessions;
BEGIN
  -- Reap abandoned ringing/accepted sessions before the unique active-call
  -- indexes are evaluated. Browser close, tab crash and network loss must not
  -- permanently prevent a participant from starting a later call.
  WITH expired AS (
    UPDATE public.gh_call_sessions
      SET status='expired',ended_at=pg_catalog.now()
      WHERE status IN ('ringing','accepted') AND expires_at<=pg_catalog.now()
      RETURNING id
  )
  DELETE FROM public.gh_call_signals s USING expired e WHERE s.call_id=e.id;

  DELETE FROM public.gh_call_sessions
    WHERE status IN ('declined','cancelled','ended','expired')
      AND COALESCE(ended_at,expires_at)<pg_catalog.now()-interval '30 days';

  IF p_call_id IS NULL OR p_call_id !~ '^call_[a-f0-9]{32}$' OR p_conversation_id IS NULL OR length(p_conversation_id)=0 OR p_actor_id IS NULL OR length(p_actor_id)=0 OR p_media_kind NOT IN ('audio','video') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_CALL');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_conversations c WHERE c.id=p_conversation_id AND c.kind='direct') THEN
    RETURN jsonb_build_object('ok',false,'error','DIRECT_CONVERSATION_REQUIRED');
  END IF;
  SELECT count(*)::integer,max(m.gh_user_id) FILTER(WHERE m.gh_user_id<>p_actor_id)
    INTO v_member_count,v_peer
    FROM public.gh_conversation_members m
    WHERE m.conversation_id=p_conversation_id AND m.left_at IS NULL;
  IF v_member_count<>2 OR NOT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=p_conversation_id AND m.gh_user_id=p_actor_id AND m.left_at IS NULL) OR v_peer IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(LEAST(p_actor_id,v_peer)||':'||GREATEST(p_actor_id,v_peer),0));
  IF EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=p_actor_id AND b.blocked_id=v_peer) OR (b.blocker_id=v_peer AND b.blocked_id=p_actor_id)) THEN
    RETURN jsonb_build_object('ok',false,'error','BLOCKED');
  END IF;
  INSERT INTO public.gh_call_sessions(id,conversation_id,caller_id,callee_id,media_kind,status,expires_at)
    VALUES(p_call_id,p_conversation_id,p_actor_id,v_peer,p_media_kind,'ringing',pg_catalog.now()+interval '90 seconds')
    ON CONFLICT(id) DO NOTHING RETURNING * INTO v_row;
  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.gh_call_sessions WHERE id=p_call_id;
    IF v_row.id IS NOT NULL AND v_row.conversation_id=p_conversation_id AND v_row.caller_id=p_actor_id AND v_row.callee_id=v_peer AND v_row.media_kind=p_media_kind AND v_row.status IN ('ringing','accepted') AND v_row.expires_at>pg_catalog.now() THEN
      RETURN jsonb_build_object('ok',true,'call',pg_catalog.to_jsonb(v_row),'replayed',true);
    END IF;
    RETURN jsonb_build_object('ok',false,'error','CALL_ID_CONFLICT');
  END IF;
  RETURN jsonb_build_object('ok',true,'call',pg_catalog.to_jsonb(v_row),'replayed',false);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','USER_ALREADY_IN_CALL');
END;
$function$;
REVOKE ALL ON FUNCTION public.gh_call_start(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_call_start(text,text,text,text) TO service_role;

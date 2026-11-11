CREATE OR REPLACE FUNCTION public.gh_call_start(p_call_id text,p_conversation_id text,p_actor_id text,p_media_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE v_peer text; v_member_count integer; v_row public.gh_call_sessions;
BEGIN
  DELETE FROM public.gh_call_sessions WHERE status IN ('declined','cancelled','ended','expired') AND COALESCE(ended_at,expires_at)<pg_catalog.now()-interval '30 days';
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

CREATE OR REPLACE FUNCTION public.gh_call_transition(p_call_id text,p_actor_id text,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE v_row public.gh_call_sessions; v_peer text; v_blocked boolean; v_members_valid boolean;
BEGIN
  SELECT * INTO v_row FROM public.gh_call_sessions WHERE id=p_call_id;
  IF NOT FOUND OR p_actor_id IS NULL OR (p_actor_id<>v_row.caller_id AND p_actor_id<>v_row.callee_id) THEN
    RETURN jsonb_build_object('ok',false,'error','NOT_FOUND');
  END IF;
  v_peer:=CASE WHEN p_actor_id=v_row.caller_id THEN v_row.callee_id ELSE v_row.caller_id END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(LEAST(p_actor_id,v_peer)||':'||GREATEST(p_actor_id,v_peer),0));
  SELECT * INTO v_row FROM public.gh_call_sessions WHERE id=p_call_id FOR UPDATE;
  IF NOT FOUND OR p_actor_id<>v_row.caller_id AND p_actor_id<>v_row.callee_id THEN
    RETURN jsonb_build_object('ok',false,'error','NOT_FOUND');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=p_actor_id AND b.blocked_id=v_peer) OR (b.blocker_id=v_peer AND b.blocked_id=p_actor_id)) INTO v_blocked;
  SELECT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_row.conversation_id AND m.gh_user_id=v_row.caller_id AND m.left_at IS NULL)
     AND EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_row.conversation_id AND m.gh_user_id=v_row.callee_id AND m.left_at IS NULL) INTO v_members_valid;
  IF v_blocked OR NOT v_members_valid THEN
    UPDATE public.gh_call_sessions SET status=CASE WHEN status='ringing' THEN 'declined' ELSE 'ended' END,ended_at=pg_catalog.now()
      WHERE id=p_call_id AND status IN ('ringing','accepted') RETURNING * INTO v_row;
    DELETE FROM public.gh_call_signals WHERE call_id=p_call_id;
    RETURN jsonb_build_object('ok',false,'error',CASE WHEN v_blocked THEN 'BLOCKED' ELSE 'FORBIDDEN' END);
  END IF;
  IF v_row.status NOT IN ('ringing','accepted') OR v_row.expires_at<=pg_catalog.now() THEN
    IF v_row.status IN ('ringing','accepted') THEN UPDATE public.gh_call_sessions SET status='expired',ended_at=pg_catalog.now() WHERE id=p_call_id RETURNING * INTO v_row; END IF;
    DELETE FROM public.gh_call_signals WHERE call_id=p_call_id;
    RETURN jsonb_build_object('ok',false,'error','CALL_EXPIRED');
  END IF;
  IF p_action='accept' AND p_actor_id=v_row.callee_id AND v_row.status='ringing' THEN
    UPDATE public.gh_call_sessions SET status='accepted',accepted_at=pg_catalog.now(),expires_at=pg_catalog.now()+interval '60 minutes' WHERE id=p_call_id RETURNING * INTO v_row;
  ELSIF p_action='decline' AND p_actor_id=v_row.callee_id AND v_row.status='ringing' THEN
    UPDATE public.gh_call_sessions SET status='declined',ended_at=pg_catalog.now() WHERE id=p_call_id RETURNING * INTO v_row;
  ELSIF p_action='cancel' AND p_actor_id=v_row.caller_id AND v_row.status='ringing' THEN
    UPDATE public.gh_call_sessions SET status='cancelled',ended_at=pg_catalog.now() WHERE id=p_call_id RETURNING * INTO v_row;
  ELSIF p_action='end' AND v_row.status='accepted' THEN
    UPDATE public.gh_call_sessions SET status='ended',ended_at=pg_catalog.now() WHERE id=p_call_id RETURNING * INTO v_row;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION');
  END IF;
  IF v_row.status IN ('declined','cancelled','ended','expired') THEN DELETE FROM public.gh_call_signals WHERE call_id=p_call_id; END IF;
  RETURN jsonb_build_object('ok',true,'call',pg_catalog.to_jsonb(v_row));
END;
$function$;

CREATE OR REPLACE FUNCTION public.gh_call_signal_append(p_call_id text,p_actor_id text,p_signal_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE v_call public.gh_call_sessions; v_peer text; v_id bigint; v_has_offer boolean; v_count integer;
BEGIN
  SELECT * INTO v_call FROM public.gh_call_sessions WHERE id=p_call_id;
  IF NOT FOUND OR p_actor_id IS NULL OR (p_actor_id<>v_call.caller_id AND p_actor_id<>v_call.callee_id) THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  v_peer:=CASE WHEN p_actor_id=v_call.caller_id THEN v_call.callee_id ELSE v_call.caller_id END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(LEAST(p_actor_id,v_peer)||':'||GREATEST(p_actor_id,v_peer),0));
  SELECT * INTO v_call FROM public.gh_call_sessions WHERE id=p_call_id FOR UPDATE;
  IF NOT FOUND OR (p_actor_id<>v_call.caller_id AND p_actor_id<>v_call.callee_id) THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF v_call.status NOT IN ('ringing','accepted') OR v_call.expires_at<=pg_catalog.now() THEN RETURN jsonb_build_object('ok',false,'error','CALL_EXPIRED'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_call.conversation_id AND m.gh_user_id=v_call.caller_id AND m.left_at IS NULL)
     OR NOT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_call.conversation_id AND m.gh_user_id=v_call.callee_id AND m.left_at IS NULL)
     OR EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=v_call.caller_id AND b.blocked_id=v_call.callee_id) OR (b.blocker_id=v_call.callee_id AND b.blocked_id=v_call.caller_id)) THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN');
  END IF;
  IF p_signal_kind NOT IN ('offer','answer','ice_candidate') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR pg_column_size(p_payload)>16384 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_SIGNAL'); END IF;
  IF p_signal_kind='offer' AND (p_actor_id<>v_call.caller_id OR v_call.status<>'ringing') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_SIGNAL_ORDER'); END IF;
  IF p_signal_kind='answer' THEN
    SELECT EXISTS(SELECT 1 FROM public.gh_call_signals s WHERE s.call_id=p_call_id AND s.sender_id=v_call.caller_id AND s.signal_kind='offer') INTO v_has_offer;
    IF p_actor_id<>v_call.callee_id OR v_call.status<>'accepted' OR NOT v_has_offer THEN RETURN jsonb_build_object('ok',false,'error','INVALID_SIGNAL_ORDER'); END IF;
  END IF;
  SELECT count(*)::integer INTO v_count FROM public.gh_call_signals WHERE call_id=p_call_id;
  IF v_count>=1500 OR (SELECT count(*) FROM public.gh_call_signals WHERE call_id=p_call_id AND sender_id=p_actor_id AND created_at>pg_catalog.now()-interval '1 minute')>=120 THEN
    RETURN jsonb_build_object('ok',false,'error','SIGNAL_LIMIT');
  END IF;
  INSERT INTO public.gh_call_signals(call_id,sender_id,signal_kind,payload) VALUES(p_call_id,p_actor_id,p_signal_kind,p_payload) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'signalId',v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.gh_call_signal_list(p_call_id text,p_actor_id text,p_after_id bigint DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE v_call public.gh_call_sessions; v_peer text; v_signals jsonb;
BEGIN
  SELECT * INTO v_call FROM public.gh_call_sessions WHERE id=p_call_id;
  IF NOT FOUND OR p_actor_id IS NULL OR (p_actor_id<>v_call.caller_id AND p_actor_id<>v_call.callee_id) THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  v_peer:=CASE WHEN p_actor_id=v_call.caller_id THEN v_call.callee_id ELSE v_call.caller_id END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(LEAST(p_actor_id,v_peer)||':'||GREATEST(p_actor_id,v_peer),0));
  SELECT * INTO v_call FROM public.gh_call_sessions WHERE id=p_call_id FOR UPDATE;
  IF NOT FOUND OR (p_actor_id<>v_call.caller_id AND p_actor_id<>v_call.callee_id) THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_call.conversation_id AND m.gh_user_id=v_call.caller_id AND m.left_at IS NULL)
     OR NOT EXISTS(SELECT 1 FROM public.gh_conversation_members m WHERE m.conversation_id=v_call.conversation_id AND m.gh_user_id=v_call.callee_id AND m.left_at IS NULL)
     OR EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=v_call.caller_id AND b.blocked_id=v_call.callee_id) OR (b.blocker_id=v_call.callee_id AND b.blocked_id=v_call.caller_id)) THEN
    DELETE FROM public.gh_call_signals WHERE call_id=p_call_id;
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN');
  END IF;
  IF v_call.status IN ('ringing','accepted') AND v_call.expires_at<=pg_catalog.now() THEN
    UPDATE public.gh_call_sessions SET status='expired',ended_at=pg_catalog.now() WHERE id=p_call_id RETURNING * INTO v_call;
  END IF;
  IF v_call.status IN ('declined','cancelled','ended','expired') THEN DELETE FROM public.gh_call_signals WHERE call_id=p_call_id; END IF;
  SELECT COALESCE(jsonb_agg(pg_catalog.jsonb_build_object('id',s.id,'senderId',s.sender_id,'kind',s.signal_kind,'payload',s.payload) ORDER BY s.id),'[]'::jsonb)
    INTO v_signals
    FROM (SELECT id,sender_id,signal_kind,payload FROM public.gh_call_signals WHERE call_id=p_call_id AND id>GREATEST(COALESCE(p_after_id,0),0) AND sender_id<>p_actor_id ORDER BY id LIMIT 100) s;
  RETURN jsonb_build_object('ok',true,'call',pg_catalog.to_jsonb(v_call),'signals',v_signals);
END;
$function$;

REVOKE ALL ON FUNCTION public.gh_call_start(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_call_start(text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_call_transition(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_call_transition(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_call_signal_append(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_call_signal_append(text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_call_signal_list(text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_call_signal_list(text,text,bigint) TO service_role;

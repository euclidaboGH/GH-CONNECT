-- GreenHaven Phase 15 — social participation reputation events.
-- Reputation remains non-financial; these events never touch GHC balances.

CREATE OR REPLACE FUNCTION public.gh_reputation_apply_event(
  p_user_id text,
  p_event_type text,
  p_points integer,
  p_idempotency_key text,
  p_source_ref text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(coalesce(p_event_type, '')));
  v_pts integer := greatest(0, least(coalesce(p_points, 0), 10000));
  v_id text;
  v_existing public.gh_reputation_events%ROWTYPE;
  v_total integer;
  v_level integer;
  v_count integer;
  v_snap_id text;
BEGIN
  IF coalesce(trim(p_user_id), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED'); END IF;
  IF v_type = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'EVENT_TYPE_REQUIRED'); END IF;
  IF v_type NOT IN (
    'profile_complete','first_post','community_join','marketplace_order_complete',
    'report_resolved_helpful','manual_adjustment_credit','comment_created'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED'); END IF;
  IF v_type = 'manual_adjustment_credit' AND v_pts = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POINTS'); END IF;
  IF v_type = 'comment_created' AND v_pts <> 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POINTS'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_rep:' || trim(p_user_id)));
  SELECT * INTO v_existing FROM public.gh_reputation_events
  WHERE user_id = trim(p_user_id) AND idempotency_key = trim(p_idempotency_key) LIMIT 1;
  IF FOUND THEN
    SELECT total_points, level, event_count INTO v_total, v_level, v_count
    FROM public.gh_reputation_state WHERE user_id = trim(p_user_id);
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id,
      'totalPoints', coalesce(v_total,0), 'level', coalesce(v_level,1), 'eventCount', coalesce(v_count,0));
  END IF;

  v_id := 're_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_reputation_events(id,user_id,event_type,points,source_ref,idempotency_key,metadata)
  VALUES(v_id,trim(p_user_id),v_type,v_pts,NULLIF(trim(coalesce(p_source_ref,'')),''),trim(p_idempotency_key),coalesce(p_metadata,'{}'::jsonb));

  INSERT INTO public.gh_reputation_state(user_id,total_points,level,event_count,updated_at)
  VALUES(trim(p_user_id),v_pts,public.gh_reputation_level_from_points(v_pts),1,now())
  ON CONFLICT(user_id) DO UPDATE SET
    total_points=public.gh_reputation_state.total_points+EXCLUDED.total_points,
    level=public.gh_reputation_level_from_points(public.gh_reputation_state.total_points+EXCLUDED.total_points),
    event_count=public.gh_reputation_state.event_count+1,
    updated_at=now();

  SELECT total_points, level, event_count INTO v_total, v_level, v_count
  FROM public.gh_reputation_state WHERE user_id=trim(p_user_id);

  v_snap_id := 'rs_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_reputation_snapshots(id,user_id,total_points,level,reason,event_id)
  VALUES(v_snap_id,trim(p_user_id),v_total,v_level,'event',v_id);

  RETURN jsonb_build_object('ok',true,'duplicate',false,'eventId',v_id,
    'totalPoints',coalesce(v_total,0),'level',coalesce(v_level,1),'eventCount',coalesce(v_count,0));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reputation_apply_event(text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_apply_event(text,text,integer,text,text,jsonb) TO service_role;

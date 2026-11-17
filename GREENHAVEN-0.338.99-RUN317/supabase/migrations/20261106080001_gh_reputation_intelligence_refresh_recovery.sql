-- Correct curation intelligence refresh recovery.
-- Fixes two source defects in 20261023030002_gh_reputation_curation_intelligence_v2.sql:
-- 1) the intelligence table has no `id` column, so RETURNING id always fails;
-- 2) plain SELECT INTO overwrites defaults with NULL for users without reputation/calibration rows.
-- This migration changes no vote weight policy, GHC balance, rewards, or access grants.

CREATE OR REPLACE FUNCTION public.gh_reputation_intelligence_refresh(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id,''));
  v_total integer := 0; v_level integer := 1;
  v_jcs numeric := 50; v_integrity numeric := 70;
  v_cqs numeric := 0; v_cis numeric := 70; v_evs numeric := 0; v_xp numeric := 0;
  v_cp numeric := 0.25; v_risk numeric := 0;
  v_votes integer := 0; v_distinct integer := 0; v_same_author integer := 0; v_rapid integer := 0;
  v_tip_count integer := 0; v_order_count integer := 0;
  v_diversity numeric := 1; v_author_concentration numeric := 0; v_rapid_ratio numeric := 0;
BEGIN
  IF v_user='' THEN RETURN jsonb_build_object('ok',false,'error','USER_REQUIRED'); END IF;
  -- Aggregate SELECTs always return one row, including for a brand-new user.
  -- Plain SELECT INTO would overwrite initialized defaults with NULL when absent.
  SELECT coalesce(max(total_points),0),coalesce(max(level),1)
    INTO v_total,v_level FROM public.gh_reputation_state WHERE user_id=v_user;
  SELECT coalesce(max(jcs),50),coalesce(max(integrity_score),70)
    INTO v_jcs,v_integrity FROM public.gh_curator_calibration WHERE user_id=v_user;

  SELECT coalesce(avg(greatest(0,least(100,q.quality_score))),0)
    INTO v_cqs
  FROM public.gh_content_quality_signals q
  JOIN public.gh_posts p ON p.id=q.content_id
  WHERE p.author_id=v_user AND p.deleted_at IS NULL;

  SELECT count(*),count(distinct post_id)
    INTO v_votes,v_distinct
  FROM public.gh_curator_activity_events
  WHERE user_id=v_user AND created_at >= current_date;
  SELECT count(*) INTO v_same_author
  FROM public.gh_curator_activity_events a
  WHERE a.user_id=v_user AND a.created_at >= current_date
    AND a.author_id IN (SELECT author_id FROM public.gh_curator_activity_events WHERE user_id=v_user AND created_at >= current_date GROUP BY author_id ORDER BY count(*) DESC LIMIT 1);
  SELECT count(*) INTO v_rapid
  FROM public.gh_curator_activity_events
  WHERE user_id=v_user AND created_at >= now() - interval '10 minutes';
  IF v_votes > 0 THEN
    v_diversity := greatest(0,least(1,v_distinct::numeric/v_votes::numeric));
    v_author_concentration := greatest(0,least(1,v_same_author::numeric/v_votes::numeric));
    v_rapid_ratio := greatest(0,least(1,v_rapid::numeric/20));
  END IF;
  -- CIS rewards independent, diversified participation; it is not a popularity score.
  v_cis := greatest(0,least(100,50 + 50*v_diversity - 25*v_author_concentration));

  BEGIN
    SELECT count(*) INTO v_tip_count FROM public.gh_tip_settlements WHERE creator_id=v_user AND status IN ('payable','paid');
  EXCEPTION WHEN undefined_table THEN v_tip_count := 0; END;
  BEGIN
    SELECT count(*) INTO v_order_count FROM public.gh_marketplace_orders WHERE seller_id=v_user AND status='completed' AND payment_status='verified';
  EXCEPTION WHEN undefined_table THEN v_order_count := 0; END;
  v_evs := least(100, ln(1 + v_tip_count + v_order_count) * 20);
  v_xp := v_total;

  v_risk := least(100, v_author_concentration*60 + v_rapid_ratio*40);
  v_cp := greatest(0.25, least(25,
    (0.35 + (least(15,greatest(1,v_level)) / 15.0) * 0.65) *
    (0.4 + (greatest(0,least(100,v_jcs))/100.0) * 0.6) *
    (0.5 + (greatest(0,least(100,v_integrity))/100.0) * 0.5) *
    (0.5 + v_diversity*0.5) *
    (1 - v_risk/100.0) * 8
  ));

  INSERT INTO public.gh_reputation_intelligence(user_id,creator_quality,judgment_calibration,community_integrity,economic_value,growth_xp,curation_power,risk_score,curation_eligible,model_version,calculated_at,updated_at)
  VALUES(v_user,v_cqs,v_jcs,v_cis,v_evs,v_xp,v_cp,v_risk,v_risk < 70,'rep-curation-v2',now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    creator_quality=EXCLUDED.creator_quality, judgment_calibration=EXCLUDED.judgment_calibration,
    community_integrity=EXCLUDED.community_integrity, economic_value=EXCLUDED.economic_value,
    growth_xp=EXCLUDED.growth_xp, curation_power=EXCLUDED.curation_power,
    risk_score=EXCLUDED.risk_score, curation_eligible=EXCLUDED.curation_eligible,
    model_version=EXCLUDED.model_version, calculated_at=now(), updated_at=now();

  INSERT INTO public.gh_reputation_intelligence_history(user_id,creator_quality,judgment_calibration,community_integrity,economic_value,growth_xp,curation_power,risk_score,model_version)
  VALUES(v_user,v_cqs,v_jcs,v_cis,v_evs,v_xp,v_cp,v_risk,'rep-curation-v2');

  RETURN jsonb_build_object('ok',true,'userId',v_user,'totalPoints',v_total,'level',v_level,
    'creatorQuality',round(v_cqs,4),'judgmentCalibration',round(v_jcs,4),'communityIntegrity',round(v_cis,4),
    'economicValue',round(v_evs,4),'growthXp',v_xp,'curationPower',round(v_cp,6),'riskScore',round(v_risk,4),
    'curationEligible',v_risk < 70,'dailyVotes',v_votes,'dailyDistinctPosts',v_distinct);
END; $$;

REVOKE ALL ON FUNCTION public.gh_reputation_intelligence_refresh(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_intelligence_refresh(text) TO service_role;
COMMENT ON FUNCTION public.gh_reputation_intelligence_refresh(text) IS
  'Refreshes server-owned reputation intelligence; safely initializes new users and writes snapshots without assuming a surrogate id column.';

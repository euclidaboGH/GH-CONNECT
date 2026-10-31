-- =============================================================================
-- GreenHaven Phase 34 — Reputation + Curation Intelligence V2
-- Server-authoritative trust dimensions, curation guardrails, and quality snapshots.
-- NO GHC minting. NO wallet-balance voting power. Service-role RPCs only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gh_reputation_intelligence (
  user_id text PRIMARY KEY,
  creator_quality numeric(8,4) NOT NULL DEFAULT 0 CHECK (creator_quality >= 0 AND creator_quality <= 100),
  judgment_calibration numeric(8,4) NOT NULL DEFAULT 50 CHECK (judgment_calibration >= 0 AND judgment_calibration <= 100),
  community_integrity numeric(8,4) NOT NULL DEFAULT 70 CHECK (community_integrity >= 0 AND community_integrity <= 100),
  economic_value numeric(8,4) NOT NULL DEFAULT 0 CHECK (economic_value >= 0 AND economic_value <= 100),
  growth_xp numeric(12,4) NOT NULL DEFAULT 0 CHECK (growth_xp >= 0),
  curation_power numeric(12,6) NOT NULL DEFAULT 0.25 CHECK (curation_power >= 0 AND curation_power <= 25),
  risk_score numeric(8,4) NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  curation_eligible boolean NOT NULL DEFAULT true,
  model_version text NOT NULL DEFAULT 'rep-curation-v2',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_reputation_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_intelligence_no_client ON public.gh_reputation_intelligence;
CREATE POLICY gh_reputation_intelligence_no_client ON public.gh_reputation_intelligence FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_curator_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  post_id text NOT NULL,
  author_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('upvote','downvote','neutral')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_curator_activity_user_nonempty CHECK(length(trim(user_id)) > 0),
  CONSTRAINT gh_curator_activity_post_nonempty CHECK(length(trim(post_id)) > 0),
  CONSTRAINT gh_curator_activity_author_nonempty CHECK(length(trim(author_id)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_gh_curator_activity_user_time ON public.gh_curator_activity_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_curator_activity_user_day_post ON public.gh_curator_activity_events(user_id,created_at,post_id);
ALTER TABLE public.gh_curator_activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_curator_activity_no_client ON public.gh_curator_activity_events;
CREATE POLICY gh_curator_activity_no_client ON public.gh_curator_activity_events FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_intelligence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  creator_quality numeric(8,4) NOT NULL,
  judgment_calibration numeric(8,4) NOT NULL,
  community_integrity numeric(8,4) NOT NULL,
  economic_value numeric(8,4) NOT NULL,
  growth_xp numeric(12,4) NOT NULL,
  curation_power numeric(12,6) NOT NULL,
  risk_score numeric(8,4) NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_rep_int_history_user_time ON public.gh_reputation_intelligence_history(user_id,created_at DESC);
ALTER TABLE public.gh_reputation_intelligence_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_intelligence_history_no_client ON public.gh_reputation_intelligence_history;
CREATE POLICY gh_reputation_intelligence_history_no_client ON public.gh_reputation_intelligence_history FOR ALL USING(false) WITH CHECK(false);

-- Server calculation. This is a trust/ranking signal, never a financial balance.
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
  v_id uuid;
BEGIN
  IF v_user='' THEN RETURN jsonb_build_object('ok',false,'error','USER_REQUIRED'); END IF;
  SELECT coalesce(total_points,0),coalesce(level,1) INTO v_total,v_level FROM public.gh_reputation_state WHERE user_id=v_user;
  SELECT coalesce(jcs,50),coalesce(integrity_score,70) INTO v_jcs,v_integrity FROM public.gh_curator_calibration WHERE user_id=v_user;

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
    model_version=EXCLUDED.model_version, calculated_at=now(), updated_at=now()
  RETURNING id INTO v_id;

  INSERT INTO public.gh_reputation_intelligence_history(user_id,creator_quality,judgment_calibration,community_integrity,economic_value,growth_xp,curation_power,risk_score,model_version)
  VALUES(v_user,v_cqs,v_jcs,v_cis,v_evs,v_xp,v_cp,v_risk,'rep-curation-v2');

  RETURN jsonb_build_object('ok',true,'userId',v_user,'totalPoints',v_total,'level',v_level,
    'creatorQuality',round(v_cqs,4),'judgmentCalibration',round(v_jcs,4),'communityIntegrity',round(v_cis,4),
    'economicValue',round(v_evs,4),'growthXp',v_xp,'curationPower',round(v_cp,6),'riskScore',round(v_risk,4),
    'curationEligible',v_risk < 70,'dailyVotes',v_votes,'dailyDistinctPosts',v_distinct);
END; $$;
REVOKE ALL ON FUNCTION public.gh_reputation_intelligence_refresh(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_intelligence_refresh(text) TO service_role;

-- Atomic curation guard. It validates visibility/blocks, self-curation, daily mutation volume,
-- and rapid/concentrated activity before a vote is committed.
CREATE OR REPLACE FUNCTION public.gh_curation_preflight(p_post_id text,p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE; v_info jsonb; v_votes integer; v_distinct integer; v_rapid integer;
  v_risk numeric := 0; v_author_count integer := 0; v_remaining integer;
BEGIN
  SELECT * INTO v_post FROM public.gh_posts WHERE id=trim(coalesce(p_post_id,'')) AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','NOT_FOUND'); END IF;
  IF trim(coalesce(p_user_id,''))='' THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','ACTOR_REQUIRED'); END IF;
  IF v_post.author_id=trim(p_user_id) THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','SELF_CURATION_FORBIDDEN'); END IF;
  IF EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=trim(p_user_id) AND b.blocked_id=v_post.author_id) OR (b.blocker_id=v_post.author_id AND b.blocked_id=trim(p_user_id))) THEN
    RETURN jsonb_build_object('ok',false,'eligible',false,'error','FORBIDDEN');
  END IF;
  IF v_post.visibility='followers' AND NOT EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_user_id) AND f.following_id=v_post.author_id) THEN
    RETURN jsonb_build_object('ok',false,'eligible',false,'error','FORBIDDEN');
  END IF;
  IF v_post.visibility NOT IN ('public','followers') THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','FORBIDDEN'); END IF;

  SELECT count(*),count(distinct post_id) INTO v_votes,v_distinct FROM public.gh_curator_activity_events WHERE user_id=trim(p_user_id) AND created_at>=current_date;
  SELECT count(*) INTO v_rapid FROM public.gh_curator_activity_events WHERE user_id=trim(p_user_id) AND created_at>=now()-interval '10 minutes';
  SELECT count(*) INTO v_author_count FROM public.gh_curator_activity_events WHERE user_id=trim(p_user_id) AND author_id=v_post.author_id AND created_at>=current_date;
  IF v_votes>0 THEN v_risk:=least(100,(v_author_count::numeric/v_votes::numeric)*60 + least(1,v_rapid::numeric/20)*40); END IF;
  v_remaining:=greatest(0,120-v_votes);
  IF v_votes>=120 THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','DAILY_CURATION_LIMIT','riskScore',v_risk,'remaining',0); END IF;
  IF v_risk>=70 THEN RETURN jsonb_build_object('ok',false,'eligible',false,'error','CURATION_REVIEW_REQUIRED','riskScore',v_risk,'remaining',v_remaining); END IF;
  RETURN jsonb_build_object('ok',true,'eligible',true,'riskScore',v_risk,'remaining',v_remaining,'dailyVotes',v_votes,'dailyDistinctPosts',v_distinct);
END; $$;
REVOKE ALL ON FUNCTION public.gh_curation_preflight(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_curation_preflight(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_curation_activity_record(p_post_id text,p_user_id text,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_author text; v_count integer;
BEGIN
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id=trim(p_post_id) AND deleted_at IS NULL;
  IF v_author IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  INSERT INTO public.gh_curator_activity_events(user_id,post_id,author_id,action) VALUES(trim(p_user_id),trim(p_post_id),v_author,lower(trim(p_action)));
  SELECT count(*) INTO v_count FROM public.gh_curator_activity_events WHERE user_id=trim(p_user_id) AND created_at>=current_date;
  RETURN jsonb_build_object('ok',true,'dailyVotes',v_count,'remaining',greatest(0,120-v_count));
END; $$;
REVOKE ALL ON FUNCTION public.gh_curation_activity_record(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_curation_activity_record(text,text,text) TO service_role;

-- Public-safe intelligence projection. It intentionally omits risk internals and wallet/economy balances.
CREATE OR REPLACE FUNCTION public.gh_reputation_intelligence_get(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_reputation_intelligence%ROWTYPE; rep public.gh_reputation_state%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_reputation_intelligence WHERE user_id=trim(coalesce(p_user_id,''));
  SELECT * INTO rep FROM public.gh_reputation_state WHERE user_id=trim(coalesce(p_user_id,''));
  IF NOT FOUND AND r.user_id IS NULL THEN RETURN jsonb_build_object('ok',true,'userId',trim(p_user_id),'available',false); END IF;
  RETURN jsonb_build_object('ok',true,'available',true,'userId',trim(p_user_id),'level',coalesce(rep.level,1),
    'totalPoints',coalesce(rep.total_points,0),'creatorQuality',coalesce(r.creator_quality,0),
    'judgmentCalibration',coalesce(r.judgment_calibration,50),'communityIntegrity',coalesce(r.community_integrity,70),
    'economicValue',coalesce(r.economic_value,0),'growthXp',coalesce(r.growth_xp,0),
    'curationPower',coalesce(r.curation_power,0.25),'calculatedAt',r.calculated_at,'modelVersion',coalesce(r.model_version,'rep-curation-v2'));
END; $$;
REVOKE ALL ON FUNCTION public.gh_reputation_intelligence_get(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_intelligence_get(text) TO service_role;

COMMENT ON TABLE public.gh_reputation_intelligence IS 'Server-derived multi-dimensional reputation intelligence. Not currency and not client-writable.';
COMMENT ON TABLE public.gh_curator_activity_events IS 'Auditable curation activity used for daily limits and abuse-resistant integrity signals.';
COMMENT ON FUNCTION public.gh_curation_preflight(text,text) IS 'Atomic-path curation guard: visibility, self-vote, block, daily volume, concentration and rapid-activity checks.';


-- Replace the atomic curation pipeline so V2 guardrails are inside the same transaction.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100,
  p_curation_weight numeric DEFAULT 0,
  p_judgment_mode text DEFAULT 'useful'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_guard jsonb;
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE');
  v_weighted jsonb;
  v_weight numeric(18,6) := greatest(0, least(coalesce(p_curation_weight,0),1000000));
  v_percentage numeric(5,2) := round(coalesce(p_percentage,100),2);
BEGIN
  IF v_percentage < 0 OR v_percentage > 100 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_PERCENTAGE'); END IF;
  v_guard := public.gh_curation_preflight(p_post_id,p_user_id);
  IF coalesce((v_guard->>'ok')::boolean,false) IS NOT TRUE OR coalesce((v_guard->>'eligible')::boolean,false) IS NOT TRUE THEN
    RETURN v_guard;
  END IF;

  v_vote := public.gh_post_curation_set(p_post_id,p_user_id,p_choice);
  IF coalesce((v_vote->>'ok')::boolean,false) IS NOT TRUE THEN RETURN v_vote; END IF;
  v_choice := coalesce(v_vote->>'choice','neutral');

  IF v_choice IN ('upvote','downvote') THEN
    UPDATE public.gh_post_curations SET reward_percentage=v_percentage,updated_at=now()
      WHERE post_id=trim(p_post_id) AND user_id=trim(p_user_id);
  END IF;
  IF v_choice='upvote' THEN
    v_reward := public.ghc_curation_reward_credit(p_user_id,p_post_id,v_choice,v_percentage);
    IF coalesce((v_reward->>'ok')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',coalesce(v_reward->>'error','REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  v_weighted := public.gh_ghpv_record_curation_weight(
    p_post_id,p_user_id,v_choice,
    CASE WHEN v_choice='neutral' THEN 0 ELSE v_weight*(v_percentage/100) END,
    p_judgment_mode
  );
  IF coalesce((v_weighted->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GHPV curation weight update failed: %',coalesce(v_weighted->>'error','GHPV_WEIGHT_UPDATE_FAILED');
  END IF;

  PERFORM public.gh_curation_activity_record(p_post_id,p_user_id,v_choice);
  RETURN v_vote || jsonb_build_object('reward',v_reward,'ghpv',v_weighted,'rewardPercentage',v_percentage,'guard',v_guard);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text,text,text,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text,text,text,numeric,numeric,text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text,text,text,numeric,numeric,text) IS 'Phase 34 atomic curation: V2 guardrails + vote + reward decision + active GHPV weight + activity audit. No GHC minting.';

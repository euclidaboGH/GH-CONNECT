-- GreenHaven curation pipeline hardening.
-- TESTNET first. Keeps vote, one-time GHC reward decision, and active GHPV weight
-- in one PostgreSQL transaction. No database is modified by adding this file.

DROP FUNCTION IF EXISTS public.gh_post_curation_set_with_reward(text, text, text, numeric);

-- Persist the selected percentage alongside the active vote instead of keeping
-- it only in a card's transient React state.
ALTER TABLE public.gh_post_curations
  ADD COLUMN IF NOT EXISTS reward_percentage numeric(5,2) NOT NULL DEFAULT 100
  CHECK (reward_percentage >= 0 AND reward_percentage <= 100);

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
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
  v_weighted jsonb;
  v_weight numeric(18,6) := greatest(0, least(coalesce(p_curation_weight, 0), 1000000));
  v_percentage numeric(5,2) := round(coalesce(p_percentage, 100), 2);
BEGIN
  IF v_percentage < 0 OR v_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;

  v_vote := public.gh_post_curation_set(p_post_id, p_user_id, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;

  v_choice := coalesce(v_vote->>'choice', 'neutral');
  IF v_choice IN ('upvote', 'downvote') THEN
    UPDATE public.gh_post_curations
      SET reward_percentage = v_percentage, updated_at = now()
      WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
  END IF;
  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(
      p_user_id, p_post_id, v_choice, v_percentage
    );
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  -- The GHPV active-weight record is part of the same transaction. The caller
  -- derives p_curation_weight from server-side reputation/calibration, never client input.
  v_weighted := public.gh_ghpv_record_curation_weight(
    p_post_id,
    p_user_id,
    v_choice,
    CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_weight * (v_percentage / 100) END,
    p_judgment_mode
  );
  IF coalesce((v_weighted->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GHPV curation weight update failed: %',
      coalesce(v_weighted->>'error', 'GHPV_WEIGHT_UPDATE_FAILED');
  END IF;

  RETURN v_vote || jsonb_build_object('reward', v_reward, 'ghpv', v_weighted,
    'rewardPercentage', v_percentage);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) IS
  'Atomic curation pipeline: authoritative vote, one-time GHC reward decision, and active GHPV weight. Percentage scales reward and active curation weight; does not mutate account reputation directly.';

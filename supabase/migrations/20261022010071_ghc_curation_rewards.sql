-- GreenHaven curation rewards: additive, server-authoritative, idempotent.
-- Apply to TESTNET first. This migration does not execute itself against any database.

CREATE TABLE IF NOT EXISTS public.ghc_curation_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  post_id text NOT NULL,
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  status text NOT NULL CHECK (status IN ('credited','ineligible','capped','zero_amount','failed')),
  calculated_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (calculated_amount >= 0),
  credited_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (credited_amount >= 0),
  reputation_level integer NOT NULL DEFAULT 1 CHECK (reputation_level BETWEEN 1 AND 15),
  balance_basis numeric(18,4) NOT NULL DEFAULT 0 CHECK (balance_basis >= 0),
  ledger_transaction_id uuid,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.ghc_curation_reward_claims ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ghc_curation_reward_claims_user_created
  ON public.ghc_curation_reward_claims (user_id, created_at DESC);
ALTER TABLE public.ghc_curation_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ghc_curation_reward_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ghc_curation_reward_claims TO service_role;
DROP POLICY IF EXISTS ghc_curation_reward_claims_no_client ON public.ghc_curation_reward_claims;
CREATE POLICY ghc_curation_reward_claims_no_client ON public.ghc_curation_reward_claims
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.ghc_curation_reward_credit(
  p_user_id text,
  p_post_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_pct numeric(5,2) := round(coalesce(p_percentage, 0), 2);
  v_author text;
  v_current_choice text;
  v_balance numeric(18,4) := 0;
  v_level integer := 1;
  v_calculated numeric(18,4) := 0;
  v_daily_cap numeric(18,4) := 500;
  v_earned_today numeric(18,4) := 0;
  v_credit numeric(18,4) := 0;
  v_local_day date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_claim_id uuid;
  v_tx_id uuid;
  v_status text := 'ineligible';
  v_reason text := '';
  v_existing public.ghc_curation_reward_claims%ROWTYPE;
BEGIN
  IF v_user = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_pct < 0 OR v_pct > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;
  IF v_choice <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE');
  END IF;

  -- Use the same post/voter lock as gh_post_curation_set, then the shared
  -- wallet lock. This prevents a concurrent toggle from racing eligibility.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || v_post || ':' || v_user));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_curation_reward:' || v_user || ':' || v_post));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || v_user));

  SELECT author_id INTO v_author FROM public.gh_posts
   WHERE id = v_post AND deleted_at IS NULL;
  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_author = v_user THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'SELF_VOTE');
  END IF;
  SELECT choice INTO v_current_choice FROM public.gh_post_curations
    WHERE post_id = v_post AND user_id = v_user;
  IF coalesce(v_current_choice, '') <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'UPVOTE_NOT_ACTIVE');
  END IF;

  SELECT * INTO v_existing FROM public.ghc_curation_reward_claims
   WHERE user_id = v_user AND post_id = v_post
   FOR UPDATE;
  IF FOUND THEN
    -- A posted reward is immutable and can never be claimed again. A no-balance,
    -- zero-percentage, or restricted attempt is retryable after conditions change;
    -- capped and other terminal outcomes remain one-shot for anti-abuse safety.
    IF v_existing.credited_amount > 0 OR NOT (
      v_existing.status IN ('ineligible', 'zero_amount') AND
      v_existing.reason IN ('NO_ELIGIBLE_BALANCE', 'PERCENTAGE_ZERO', 'ACCOUNT_RESTRICTED')
    ) THEN
      RETURN jsonb_build_object('ok', true, 'credited', v_existing.credited_amount > 0,
        'amount', v_existing.credited_amount, 'reason', 'ALREADY_CLAIMED', 'claimId', v_existing.id);
    END IF;
    v_claim_id := v_existing.id;
    UPDATE public.ghc_curation_reward_claims
      SET percentage = v_pct, status = 'ineligible', reason = 'EVALUATING', updated_at = now()
      WHERE id = v_claim_id;
  ELSE
    INSERT INTO public.ghc_curation_reward_claims
      (user_id, post_id, percentage, status, reason)
    VALUES (v_user, v_post, v_pct, 'ineligible', 'EVALUATING')
    RETURNING id INTO v_claim_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = v_user AND (restricted OR suspended)) THEN
    v_reason := 'ACCOUNT_RESTRICTED';
  ELSE
    -- Read spendable balance and reputation in one SQL statement/snapshot.
    SELECT greatest(0, coalesce(public.ghc_spendable_balance(v_user), 0)),
           greatest(1, least(15, coalesce(r.level, 1)))
      INTO v_balance, v_level
      FROM (SELECT 1) AS seed
      LEFT JOIN public.gh_reputation_state AS r ON r.user_id = v_user;
    SELECT greatest(0, coalesce(max_daily_earn, 500)) INTO v_daily_cap
      FROM public.ghc_economy_limits WHERE id = 1 FOR SHARE;
    -- Honor the existing centrally configured economy cap; do not introduce
    -- a separate hard-coded curation cap that changes established economics.
    v_daily_cap := greatest(0, coalesce(v_daily_cap, 500));

    IF v_balance <= 0 THEN
      v_reason := 'NO_ELIGIBLE_BALANCE';
    ELSIF v_pct <= 0 THEN
      v_status := 'zero_amount'; v_reason := 'PERCENTAGE_ZERO';
    ELSE
      -- Formula: (eligible balance / 10) * level * percentage / 100 / 100.
      -- 1,000 balance × level 5 × 100% = 5 GHC.
      v_calculated := round((v_balance / 10) * v_level * (v_pct / 100) / 100, 4);
      SELECT coalesce(sum(amount), 0) INTO v_earned_today
      FROM public.ghc_transactions
      WHERE user_id = v_user AND kind = 'earned' AND status = 'posted'
        AND created_at >= (v_local_day::timestamp AT TIME ZONE 'Africa/Lagos')
        AND created_at < ((v_local_day + 1)::timestamp AT TIME ZONE 'Africa/Lagos');
      v_credit := least(v_calculated, greatest(0, v_daily_cap - v_earned_today));
      IF v_credit <= 0 THEN
        v_status := 'capped'; v_reason := 'DAILY_EARN_CAP_REACHED';
      ELSE
        INSERT INTO public.ghc_transactions
          (user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at)
        VALUES
          (v_user, 'earned', v_credit, 'posted', 'Curation upvote reward',
           'curation_reward', 'curation:' || v_user || ':' || v_post,
           jsonb_build_object('postId', v_post, 'percentage', v_pct,
             'balanceBasis', v_balance, 'reputationLevel', v_level,
             'calculatedAmount', v_calculated, 'dailyCap', v_daily_cap,
             'localDay', v_local_day), now())
        RETURNING id INTO v_tx_id;
        v_status := 'credited'; v_reason := 'CREDITED';
      END IF;
    END IF;
  END IF;

  UPDATE public.ghc_curation_reward_claims
  SET percentage = v_pct, status = v_status,
      calculated_amount = v_calculated, credited_amount = v_credit,
      reputation_level = v_level, balance_basis = v_balance,
      ledger_transaction_id = v_tx_id, reason = v_reason
  WHERE id = v_claim_id;

  RETURN jsonb_build_object('ok', true, 'credited', v_credit > 0, 'amount', v_credit,
    'calculatedAmount', v_calculated, 'status', v_status, 'reason', v_reason,
    'reputationLevel', v_level, 'balanceBasis', v_balance, 'claimId', v_claim_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) TO service_role;
COMMENT ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) IS
  'Atomically evaluates and credits one curation upvote reward per user/post; server-authoritative balance, level, daily cap and ledger.';


-- Keep the durable vote mutation and its one-time reward decision in the same
-- PostgreSQL transaction. If reward evaluation fails unexpectedly, the vote
-- mutation rolls back too; clients never observe a successful vote with a
-- silently lost reward attempt.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
BEGIN
  v_vote := public.gh_post_curation_set(p_post_id, p_user_id, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;

  v_choice := coalesce(v_vote->>'choice', 'neutral');
  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(
      p_user_id, p_post_id, v_choice, p_percentage
    );
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  RETURN v_vote || jsonb_build_object('reward', v_reward);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) IS
  'Atomically applies the authoritative curation vote and its idempotent GHC reward decision.';

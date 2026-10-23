-- GreenHaven Phase 15 — Social Economy Control Plane.
-- Connects comments, curation, content rewards and wallet state without minting.
-- Comments create durable attention/reputation signals only.
-- Curation may redistribute existing GHC from curator -> creator.

CREATE OR REPLACE FUNCTION public.gh_social_economy_snapshot(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_wallet jsonb;
  v_streak jsonb;
  v_curation_balance numeric := 0;
BEGIN
  IF v_user = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  v_wallet := public.ghc_wallet_snapshot(v_user);
  v_curation_balance := greatest(0, coalesce((v_wallet->>'balance')::numeric, 0));

  IF to_regprocedure('public.ghc_get_claim_streak(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.ghc_get_claim_streak($1)' INTO v_streak USING v_user;
  ELSE
    v_streak := jsonb_build_object();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'wallet', v_wallet,
    'curation', jsonb_build_object(
      'enabled', true,
      'suggestedContribution', 0.1,
      'maxContributionPerVote', 1,
      'spendableBalance', v_curation_balance,
      'canFundSuggestedContribution', v_curation_balance >= 0.1,
      'model', 'balance_redistribution'
    ),
    'claim', v_streak,
    'rules', jsonb_build_object(
      'commentsMintGhc', false,
      'likesMintGhc', false,
      'viewsMintGhc', false,
      'curationMintsGhc', false,
      'curationMovesExistingGhc', true,
      'walletIsLedgerAuthoritative', true
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_economy_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_economy_snapshot(text) TO service_role;

-- Harden the curation redistribution path: project the confirmed ledger transfer
-- through the canonical content-reward projection after the transfer succeeds.
-- This is intentionally repeated here after the earlier bridge migration so the
-- latest function definition is authoritative regardless of older staging state.
CREATE OR REPLACE FUNCTION public.ghc_curation_redistribute(
  p_voter_id text,
  p_author_id text,
  p_post_id text,
  p_amount numeric,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voter text := trim(coalesce(p_voter_id, ''));
  v_author text := trim(coalesce(p_author_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_ref text := trim(coalesce(p_reference_id, ''));
  v_amount numeric := round(coalesce(p_amount, 0), 4);
  v_available numeric := 0;
  v_post_author text;
  v_choice text;
  v_debit_id uuid;
  v_credit_id uuid;
  v_projection jsonb;
  v_now timestamptz := now();
BEGIN
  IF v_voter = '' OR v_author = '' OR v_post = '' OR v_ref = '' OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_voter = v_author THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'SELF_VOTE');
  END IF;
  IF v_amount > 1 THEN v_amount := 1; END IF;

  SELECT author_id INTO v_post_author
  FROM public.gh_posts
  WHERE id = v_post AND deleted_at IS NULL;
  IF v_post_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_post_author <> v_author THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTHOR_MISMATCH');
  END IF;

  SELECT choice INTO v_choice
  FROM public.gh_post_curations
  WHERE post_id = v_post AND user_id = v_voter;
  IF v_choice <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'UPVOTE_NOT_ACTIVE');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_social_economy:' || v_post || ':' || v_voter));

  IF EXISTS (
    SELECT 1 FROM public.ghc_transactions
    WHERE reference_id = v_ref
      AND kind = 'transfer_out'
      AND status = 'posted'
      AND source_event = 'CURATION_REDISTRIBUTE_V1'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'credited', true, 'idempotent', true, 'amount', v_amount, 'referenceId', v_ref, 'contentRewardRecorded', true);
  END IF;

  v_available := public.ghc_available_balance(v_voter);
  IF v_available < v_amount THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'INSUFFICIENT_SPENDABLE', 'availableBalance', greatest(0, v_available), 'requiredBalance', v_amount);
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    counterparty_id, metadata, posted_at
  ) VALUES (
    v_voter, 'transfer_out', -v_amount, 'posted', 'Curation contribution',
    'CURATION_REDISTRIBUTE_V1', v_ref, v_author,
    jsonb_build_object('postId', v_post, 'redistribute', true), v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    counterparty_id, metadata, posted_at
  ) VALUES (
    v_author, 'transfer_in', v_amount, 'posted', 'Curation reward',
    'CURATION_REDISTRIBUTE_V1', v_ref, v_voter,
    jsonb_build_object('postId', v_post, 'redistribute', true), v_now
  ) RETURNING id INTO v_credit_id;

  v_projection := public.gh_content_reward_record_funded_settlement(
    v_post, v_amount, 'curation', v_ref, v_voter, v_author
  );
  IF coalesce((v_projection->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'CONTENT_REWARD_PROJECTION_FAILED: %', coalesce(v_projection->>'error', 'UNKNOWN');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', true,
    'idempotent', false,
    'amount', v_amount,
    'referenceId', v_ref,
    'debitId', v_debit_id,
    'creditId', v_credit_id,
    'availableBalanceAfter', greatest(0, v_available - v_amount),
    'contentRewardRecorded', true,
    'contentRewardProjected', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_redistribute(text,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_curation_redistribute(text,text,text,numeric,text) TO service_role;

COMMENT ON FUNCTION public.gh_social_economy_snapshot(text) IS
  'Authoritative social economy state: wallet, curation funding capacity, claim state and non-minting rules.';
COMMENT ON FUNCTION public.ghc_curation_redistribute(text,text,text,numeric,text) IS
  'Atomic curator-wallet to creator redistribution plus canonical content reward projection. Never mints GHC.';

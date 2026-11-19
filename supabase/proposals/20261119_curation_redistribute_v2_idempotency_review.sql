-- RUN376 REVIEW-ONLY PROPOSAL — curation redistribution idempotency consistency.
-- Do not apply until Testnet migration history is reconciled and this function is
-- rehearsed against the exact ghc_curation_redistribute SQL implementation.
-- The wrapper is optional, balance-funded, and never creates new GHC.

CREATE OR REPLACE FUNCTION public.ghc_curation_redistribute_v2(
  p_voter_id text,
  p_author_id text,
  p_post_id text,
  p_amount numeric,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_voter text := trim(coalesce(p_voter_id, ''));
  v_author text := trim(coalesce(p_author_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_ref text := trim(coalesce(p_reference_id, ''));
  v_existing public.ghc_transactions%ROWTYPE;
  v_result jsonb;
  v_amount numeric := coalesce(p_amount, 0);
BEGIN
  IF v_voter = '' OR length(v_voter) > 160 OR v_author = '' OR length(v_author) > 160
     OR v_post = '' OR length(v_post) > 160 OR v_ref = '' OR length(v_ref) < 8 OR length(v_ref) > 160
     OR v_voter !~ '^[A-Za-z0-9._:-]+$' OR v_author !~ '^[A-Za-z0-9._:-]+$'
     OR v_post !~ '^[A-Za-z0-9._:-]+$' OR v_ref !~ '^[A-Za-z0-9._:-]+$'
     OR v_voter = v_author OR v_amount <= 0 OR v_amount > 1
     OR abs(v_amount * 10000 - round(v_amount * 10000)) > 0.000001 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Lock the reference globally and then the same voter/post lane used by v1.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curation_reference:' || v_ref));
  PERFORM pg_advisory_xact_lock(hashtext('gh_social_economy:' || v_post || ':' || v_voter));

  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE reference_id = v_ref
    AND kind = 'transfer_out'
    AND status = 'posted'
    AND source_event = 'CURATION_REDISTRIBUTE_V1'
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.user_id <> v_voter
       OR coalesce(v_existing.counterparty_id, '') <> v_author
       OR coalesce(v_existing.metadata->>'postId', '') <> v_post THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'credited', true,
      'idempotent', true,
      'amount', abs(v_existing.amount),
      'requestAmountMismatch', abs(abs(v_existing.amount) - v_amount) > 0.0000001,
      'referenceId', v_ref,
      'availableBalanceAfter', public.ghc_available_balance(v_voter),
      'contentRewardRecorded', true,
      'contentRewardProjected', true
    );
  END IF;

  v_result := public.ghc_curation_redistribute(v_voter, v_author, v_post, v_amount, v_ref);
  RETURN coalesce(v_result, jsonb_build_object('ok', false, 'error', 'REDISTRIBUTION_FAILED'));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_redistribute_v2(text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_curation_redistribute_v2(text, text, text, numeric, text) TO service_role;
COMMENT ON FUNCTION public.ghc_curation_redistribute_v2(text, text, text, numeric, text) IS
  'Idempotency-safe wrapper around the balance-funded curation redistribution. Replays return the original ledger amount; never mints GHC.';

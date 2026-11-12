-- REVIEW_REQUIRED: source hardening completed; must pass disposable PostgreSQL rehearsal and dependency checks before Testnet application.
-- Phase 3 closeout: payout reservation explanations, reward-claim retry idempotency,
-- and serialized GHC membership purchases. Additive replacement functions only.
-- Additive replacement for the existing self-service cancellation RPC.
BEGIN;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_row public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_rel jsonb;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_total numeric(38,0) := 0;
  v_reason text;
  v_unlock text;
  v_result_status text;
  v_can_release boolean;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pi_earnings_payout:' || v_user, 0)
  );

  FOR v_row IN
    SELECT *
      FROM public.gh_pi_earnings_payout_requests
     WHERE user_id = v_user
       AND network = 'Pi Testnet'
       AND status IN ('reserved', 'processing', 'uncertain')
     ORDER BY created_at
     FOR UPDATE
  LOOP
    -- Safe self-service release is intentionally limited to a request that
    -- never entered provider execution. A missing payment ID is not proof that
    -- Pi did not create a payment before a worker timed out or lost its lease.
    -- Therefore processing/uncertain requests require provider-side reconciliation
    -- and are never released by this user-facing RPC.
    v_can_release := (
      v_row.status = 'reserved'
      AND v_row.network = 'Pi Testnet'
      AND v_row.provider_payment_id IS NULL
      AND v_row.provider_txid IS NULL
      AND v_row.provider_receipt IS NULL
      AND v_row.provider_verified_at IS NULL
      AND v_row.execution_started_at IS NULL
      AND v_row.execution_lease_token IS NULL
      AND v_row.execution_lease_expires_at IS NULL
      AND COALESCE(v_row.execution_attempts, 0) = 0
    );

    IF v_can_release THEN
      v_rel := public.gh_earnings_release_reserve(
        v_user,
        v_row.gross_atomic,
        'pi_earnings_payout:release:' || v_row.id::text,
        v_row.id::text,
        'Incomplete payout request released by account holder (no provider payment evidence)'
      );
      IF COALESCE((v_rel->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Release failed for %: %', v_row.id, COALESCE(v_rel->>'error', 'UNKNOWN');
      END IF;
      UPDATE public.gh_pi_earnings_payout_requests
         SET status = 'released',
             failure_code = 'CANCELLED_BY_USER_UNSTARTED',
             execution_lease_token = NULL,
             execution_lease_expires_at = NULL,
             updated_at = now()
       WHERE id = v_row.id;
      v_count := v_count + 1;
      v_total := v_total + v_row.gross_atomic;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'requestId', v_row.id,
        'status', 'released',
        'grossAtomic', v_row.gross_atomic,
        'reasonCode', 'UNSTARTED_REQUEST_CANCELLED',
        'reason', 'The withdrawal request had not started Pi provider execution; its reservation was returned to Available.',
        'unlockCondition', 'The reserved amount has been returned to Available.'
      ));
    ELSE
      v_result_status := v_row.status;
      IF v_row.provider_payment_id IS NOT NULL OR v_row.provider_txid IS NOT NULL
         OR v_row.provider_receipt IS NOT NULL OR v_row.provider_verified_at IS NOT NULL THEN
        v_reason := 'PROVIDER_EVIDENCE_PRESENT';
        v_unlock := 'Pi payment evidence exists. The server must reconcile the exact payment before any release or settlement.';
      ELSIF v_row.status = 'processing'
         AND v_row.execution_lease_token IS NOT NULL
         AND v_row.execution_lease_expires_at > now() THEN
        v_reason := 'PROVIDER_EXECUTION_IN_PROGRESS';
        v_unlock := 'The payout worker holds an active lease. Wait for its verified outcome; this control cannot release an active execution.';
      ELSIF v_row.status IN ('processing', 'uncertain')
         OR v_row.execution_started_at IS NOT NULL
         OR v_row.execution_lease_token IS NOT NULL
         OR v_row.execution_lease_expires_at IS NOT NULL
         OR COALESCE(v_row.execution_attempts, 0) > 0 THEN
        v_reason := 'PROVIDER_OUTCOME_UNKNOWN';
        v_unlock := 'The request may have reached Pi before its payment ID was saved. Only authoritative provider reconciliation can safely release or settle this reservation.';
      ELSE
        v_reason := 'EXECUTION_ALREADY_STARTED';
        v_unlock := 'The request is not in the never-started state required for self-service release. Contact support for reconciliation.';
      END IF;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'requestId', v_row.id,
        'status', v_result_status,
        'grossAtomic', v_row.gross_atomic,
        'reasonCode', v_reason,
        'reason', CASE v_reason
          WHEN 'PROVIDER_OUTCOME_UNKNOWN' THEN 'Pi has not yet provided a conclusive payment outcome.'
          WHEN 'PROVIDER_EVIDENCE_PRESENT' THEN 'A Pi payment id or txid is on file; self-service release is blocked for safety.'
          WHEN 'PROVIDER_EXECUTION_IN_PROGRESS' THEN 'The payout may still be in progress on the worker.'
          ELSE 'Provider execution has started, so a self-service cancellation cannot safely release it yet.'
        END,
        'unlockCondition', v_unlock
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'released', v_count,
    'releasedAtomic', v_total,
    'items', v_items,
    'message', CASE WHEN v_count > 0
      THEN 'Eligible never-started reservations were returned to Available. Processing/uncertain requests remain protected until authoritative provider reconciliation.'
      ELSE 'No incomplete reservations were eligible for immediate release. Any remaining holds are explained below.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) TO service_role;
COMMENT ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) IS
  'Self-service release only for never-started Pi Testnet reservations. Processing/uncertain requests and any provider-evidence rows remain held for authoritative provider reconciliation.';



-- Atomic membership purchase with concurrency-safe entitlement preflight.
CREATE OR REPLACE FUNCTION public.ghc_purchase_membership(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_spend jsonb;
  v_row jsonb;
  v_existing public.ghc_membership_entitlements%ROWTYPE;
  v_upsert jsonb;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_PURCHASE');
  END IF;
  IF p_row->>'user_id' IS DISTINCT FROM p_user_id
     OR p_row->>'purchase_ref' IS DISTINCT FROM p_reference_id
     OR p_row->>'tier' NOT IN ('vip', 'vvip')
     OR p_row->>'billing_period' NOT IN ('monthly', 'four_months', 'eight_months', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_ENTITLEMENT');
  END IF;

  -- Serialize the entire preflight → debit → entitlement transaction per account.
  -- The underlying spend RPC lock alone is too late: concurrent requests could
  -- both pass the entitlement preflight before either commits.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ghc_membership_purchase:' || p_user_id, 0));

  SELECT * INTO v_existing
  FROM public.ghc_membership_entitlements
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF FOUND AND v_existing.purchase_ref = p_reference_id THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true,
      'spend', jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', p_reference_id),
      'entitlement', to_jsonb(v_existing));
  END IF;

  IF FOUND AND v_existing.active IS TRUE
     AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now() + interval '60 seconds')
     AND v_existing.tier = p_row->>'tier' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'alreadyActive', true,
      'spend', jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', p_reference_id),
      'entitlement', to_jsonb(v_existing));
  END IF;
  IF FOUND AND v_existing.active IS TRUE
     AND (v_existing.expires_at IS NULL OR v_existing.expires_at > now() + interval '60 seconds')
     AND v_existing.tier = 'vvip' AND p_row->>'tier' = 'vip' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_DOWNGRADE_NOT_ALLOWED');
  END IF;

  -- Both nested RPC operations run in this transaction; an entitlement write failure
  -- rolls back the ledger debit too.
  v_spend := public.ghc_execute_spend(
    p_user_id, p_amount, p_reference_id, p_reason, 'PREMIUM_PURCHASE'
  );
  IF coalesce((v_spend->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_spend;
  END IF;
  IF coalesce((v_spend->>'idempotent')::boolean, false) IS TRUE THEN
    -- An old debit without its matching entitlement must be reconciled by support;
    -- never turn an orphaned debit into a second grant on retry.
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED');
  END IF;

  v_row := p_row || jsonb_build_object(
    'updated_at', v_now,
    'audit', coalesce(v_existing.audit, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', floor(extract(epoch from v_now) * 1000),
      'action', 'GRANT',
      'detail', concat(p_row->>'tier', '/', p_row->>'billing_period', '/ghc')
    ))
  );
  v_upsert := public.ghc_membership_upsert(v_row);
  IF coalesce((v_upsert->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'MEMBERSHIP_ENTITLEMENT_WRITE_FAILED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'spend', v_spend,
    'entitlement', v_row
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) TO service_role;


-- Retry-idempotent pending claim for UUID and rewardId aliases.
CREATE OR REPLACE FUNCTION public.ghc_claim_pending(
  p_user_id text,
  p_hold_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_pending public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_new_id uuid;
  v_ref text;
  v_reward_id text;
BEGIN
  IF p_user_id IS NULL OR p_hold_id IS NULL OR length(trim(p_hold_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Find pending row by id or reference_id
  SELECT * INTO v_pending
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND amount > 0
    AND (
      id::text = p_hold_id
      OR reference_id = p_hold_id
      OR (metadata->>'rewardId') = p_hold_id
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: already posted for this reference?
    SELECT * INTO v_posted
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND status = 'posted'
      AND kind = 'earned'
      AND amount > 0
      AND (reference_id = p_hold_id OR id::text = p_hold_id)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'transactionId', v_posted.id,
        'amount', v_posted.amount
      );
    END IF;
    -- Retry-safe lookup supports either the original pending row id or rewardId
    -- metadata, for every eligible source (not only the legacy Daily Claim type).
    SELECT * INTO v_pending
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND status = 'expired'
      AND kind = 'earned'
      AND COALESCE(metadata->>'claimedBy', '') = p_user_id
      AND (id::text = p_hold_id OR metadata->>'rewardId' = p_hold_id)
    ORDER BY created_at DESC
    LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_posted FROM public.ghc_transactions
      WHERE user_id = p_user_id AND reference_id = v_pending.reference_id
        AND kind = 'earned' AND status = 'posted'
      LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true,
          'transactionId', v_posted.id, 'amount', v_posted.amount,
          'referenceId', v_posted.reference_id);
      END IF;
    END IF;
    -- A retry using the rewardId alias may not equal the original row ID or
    -- reference. Resolve the already-posted credit directly from its metadata.
    SELECT * INTO v_posted
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND status = 'posted'
      AND kind = 'earned'
      AND amount > 0
      AND metadata->>'rewardId' = p_hold_id
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true,
        'transactionId', v_posted.id, 'amount', v_posted.amount,
        'referenceId', v_posted.reference_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CLAIMABLE');
  END IF;

  IF COALESCE((v_pending.metadata->>'reviewRequired')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNDER_REVIEW');
  END IF;

  -- Daily Claim entitlements have a fixed 48-hour lock. Legacy pending
  -- records from other sources retain their existing redemption semantics;
  -- Phase 3 separately disables new non-Daily-Claim issuance paths.
  IF COALESCE(v_pending.source_event, '') = 'DAILY_CLAIM_V12' THEN
    IF COALESCE(v_pending.metadata->>'claimKind', '') <> 'DAILY_CLAIM_V12' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAILY_CLAIM_METADATA');
    END IF;
    IF now() < v_pending.created_at + interval '48 hours' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'NOT_YET_REDEEMABLE',
        'redeemableAt', (v_pending.created_at + interval '48 hours')
      );
    END IF;
  END IF;

  v_ref := COALESCE(v_pending.reference_id, v_pending.id::text);
  v_reward_id := NULLIF(trim(COALESCE(v_pending.metadata->>'rewardId', '')), '');

  -- Serialize by the canonical reward identity as well as locking the pending
  -- row. This prevents two legacy duplicate holds with different row IDs but
  -- the same rewardId from being credited concurrently.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'ghc_claim_pending:' || p_user_id || ':' || COALESCE(v_reward_id, v_ref), 0
  ));

  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND status = 'posted'
    AND kind = 'earned'
    AND (reference_id = v_ref OR (v_reward_id IS NOT NULL AND metadata->>'rewardId' = v_reward_id))
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.ghc_transactions
    SET status = 'expired',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('claimedAt', now(), 'superseded', true)
    WHERE id = v_pending.id;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'referenceId', v_posted.reference_id
    );
  END IF;

  UPDATE public.ghc_transactions
  SET status = 'expired',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('claimedAt', now(), 'claimedBy', p_user_id)
  WHERE id = v_pending.id;

  v_new_id := gen_random_uuid();
  INSERT INTO public.ghc_transactions (
    id, user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
  ) VALUES (
    v_new_id,
    p_user_id,
    'earned',
    v_pending.amount,
    'posted',
    v_pending.reason,
    COALESCE(v_pending.source_event, 'CLAIM'),
    v_ref,
    jsonb_build_object('fromPending', v_pending.id, 'claimedBy', p_user_id, 'rewardId', v_reward_id, 'claimKind', 'DAILY_CLAIM_V12', 'redeemedAt', now()),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'transactionId', v_new_id,
    'amount', v_pending.amount,
    'redeemableAt', v_pending.created_at + interval '48 hours',
    'referenceId', v_ref
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_claim_pending(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_claim_pending(text, text) TO service_role;

COMMIT;

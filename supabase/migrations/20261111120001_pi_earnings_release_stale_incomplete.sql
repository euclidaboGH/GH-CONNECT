-- REVIEW_REQUIRED / operator-applied: harden self-service reservation recovery.
-- Only requests that provably never started provider execution may be released.
-- Processing/uncertain requests remain held: a missing persisted provider ID is
-- not proof that Pi did not create a payment before the worker lost its lease.

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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

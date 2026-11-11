-- REVIEW_REQUIRED / operator-applied: expand self-service release for incomplete
-- Pi Testnet payouts that never obtained provider payment evidence.
-- Does NOT release rows with provider_payment_id, provider_txid, or active lease.

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
  v_stale_cutoff timestamptz := now() - interval '15 minutes';
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
    -- Safe self-service release: no provider payment evidence ever recorded.
    v_can_release := (
      v_row.provider_payment_id IS NULL
      AND v_row.provider_txid IS NULL
      AND (
        (
          v_row.status = 'reserved'
          AND v_row.execution_started_at IS NULL
          AND v_row.execution_lease_token IS NULL
          AND COALESCE(v_row.execution_attempts, 0) = 0
        )
        OR (
          -- Stuck "processing" / incomplete with no Pi payment identity and dead or missing lease
          v_row.status IN ('reserved', 'processing')
          AND (
            v_row.execution_lease_token IS NULL
            OR v_row.execution_started_at IS NULL
            OR v_row.execution_started_at < v_stale_cutoff
          )
          AND COALESCE(v_row.execution_attempts, 0) <= 3
        )
      )
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
             failure_code = CASE
               WHEN v_row.status = 'processing' THEN 'CANCELLED_BY_USER_STALE_INCOMPLETE'
               ELSE 'CANCELLED_BY_USER_UNSTARTED'
             END,
             execution_lease_token = NULL,
             updated_at = now()
       WHERE id = v_row.id;
      v_count := v_count + 1;
      v_total := v_total + v_row.gross_atomic;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'requestId', v_row.id,
        'status', 'released',
        'grossAtomic', v_row.gross_atomic,
        'reasonCode', CASE WHEN v_row.status = 'processing' THEN 'STALE_INCOMPLETE_RELEASED' ELSE 'UNSTARTED_REQUEST_CANCELLED' END,
        'reason', CASE WHEN v_row.status = 'processing'
          THEN 'The incomplete withdrawal never received a Pi payment id; reservation returned to Available.'
          ELSE 'The withdrawal request had not started Pi provider execution.'
        END,
        'unlockCondition', 'The reserved amount has been returned to Available.'
      ));
    ELSE
      v_result_status := v_row.status;
      IF v_row.status = 'uncertain' THEN
        v_reason := 'PROVIDER_OUTCOME_UNKNOWN';
        v_unlock := 'Use Reconcile on this request. Funds unlock only after Pi confirms no payment, or settle after verified payment.';
      ELSIF v_row.provider_payment_id IS NOT NULL OR v_row.provider_txid IS NOT NULL THEN
        v_reason := 'PROVIDER_EVIDENCE_PRESENT';
        v_unlock := 'A Pi payment identifier exists. The server must reconcile with Pi before any release.';
      ELSIF v_row.status = 'processing' THEN
        v_reason := 'PROVIDER_EXECUTION_IN_PROGRESS';
        v_unlock := 'Wait briefly for the worker, then retry Return reserved π. If still stuck after 15 minutes with no Pi payment id, retry this control.';
      ELSE
        v_reason := 'EXECUTION_ALREADY_STARTED';
        v_unlock := 'Provider execution evidence is present or lease is still active. Reconcile before release.';
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
      THEN 'Eligible incomplete reservations were returned to Available. Requests with Pi payment evidence stay protected until reconciled.'
      ELSE 'No incomplete reservations were eligible for immediate release. Any remaining holds are explained below.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) TO service_role;
COMMENT ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) IS
  'Self-service release of incomplete Pi Testnet payout reservations with no provider payment evidence. Never force-releases rows that have Pi payment ids.';

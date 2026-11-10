-- OPERATOR ACTION — TESTNET ONLY. Review every preview before running the DO block.
-- Purpose: give users back PI that is stuck in "reserved" because a withdrawal
-- request locked it but execution never started (no provider payment, no lease,
-- zero execution attempts). Genuinely earned PI (registration bonus, rewards,
-- cashback) returns to "available". Requests that reached the provider
-- (provider_payment_id set, execution started/attempted, processing, uncertain,
-- paid) are NEVER touched; those need provider reconciliation.
-- Uses the existing exact-amount, idempotent gh_earnings_release_reserve ledger
-- function; ledger history is append-only, nothing is edited or deleted.

-- 1) Diagnostic: who has PI reserved, and which payout request holds it?
SELECT
  r.user_id,
  r.id AS payout_request_id,
  r.status,
  r.gross_atomic,
  (r.gross_atomic / 10000000.0) AS gross_pi,
  r.provider_payment_id,
  r.execution_started_at,
  r.execution_attempts,
  r.created_at,
  (r.status = 'reserved' AND r.provider_payment_id IS NULL
    AND r.execution_started_at IS NULL AND r.execution_lease_token IS NULL
    AND COALESCE(r.execution_attempts, 0) = 0
    AND r.network = 'Pi Testnet') AS safe_to_release
FROM public.gh_pi_earnings_payout_requests r
WHERE r.status IN ('reserved', 'processing', 'uncertain')
ORDER BY r.created_at, r.user_id;

-- 2) Diagnostic: confirm registration-bonus credits are 'available' credits.
SELECT status, COUNT(*) AS entries, SUM(amount_atomic) / 10000000.0 AS total_pi
FROM public.gh_earnings_ledger_entries
WHERE source_table = 'registration_bonus' AND entry_type = 'credit'
GROUP BY status;

-- 3) Explicit write operation (single transaction; any failure aborts all).
DO $$
DECLARE
  v_row record;
  v_release jsonb;
  v_released integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, user_id, gross_atomic
    FROM public.gh_pi_earnings_payout_requests
    WHERE status = 'reserved'
      AND network = 'Pi Testnet'
      AND provider_payment_id IS NULL
      AND provider_txid IS NULL
      AND execution_started_at IS NULL
      AND execution_lease_token IS NULL
      AND COALESCE(execution_attempts, 0) = 0
    ORDER BY created_at
    FOR UPDATE
  LOOP
    v_release := public.gh_earnings_release_reserve(
      v_row.user_id, v_row.gross_atomic,
      'pi_earnings_payout:release:' || v_row.id::text, v_row.id::text,
      'Unstarted payout reservation released by operator (execution never began)');
    IF COALESCE((v_release->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Release failed for request %, user %, error %',
        v_row.id, v_row.user_id, COALESCE(v_release->>'error', 'UNKNOWN');
    END IF;
    UPDATE public.gh_pi_earnings_payout_requests
       SET status = 'released', failure_code = 'RESERVATION_RELEASED_UNSTARTED',
           updated_at = now()
     WHERE id = v_row.id;
    v_released := v_released + 1;
  END LOOP;
  RAISE NOTICE 'Released % unstarted PI payout reservation(s) back to available', v_released;
END;
$$;

-- 4) Post-check: no unstarted reservations should remain; available should be restored.
SELECT COUNT(*) AS unstarted_reserved_requests_remaining
FROM public.gh_pi_earnings_payout_requests
WHERE status = 'reserved' AND provider_payment_id IS NULL
  AND execution_started_at IS NULL AND COALESCE(execution_attempts, 0) = 0;

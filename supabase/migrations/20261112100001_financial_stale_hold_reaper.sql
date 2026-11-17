-- REVIEW_REQUIRED: automatic 24-hour release of stale financial holds.
-- Run #297 candidate. Not applied to any database by the delivering run.
--
-- Scope
--   Pi earnings: public.gh_pi_earnings_payout_requests rows in status 'reserved' that never
--   entered provider execution are released through gh_earnings_release_reserve (append-only
--   ledger, same unique_ref as the app path, so retries are idempotent).
--   GHC: public.ghc_withdrawal_requests rows in 'requested' / 'under_review' / 'approved'
--   with no settlement reference are moved to 'rejected' through ghc_withdrawal_set_status.
--   The GHC lock is virtual (status-based), so leaving those statuses frees the balance.
--
-- Deliberately NOT released here (reported in 'held' instead)
--   * Pi requests in 'processing' or 'uncertain', or with any execution attempt, lease,
--     provider payment id, txid or receipt. A missing provider id is not proof that Pi did not
--     create a payment, so releasing could credit the user twice. These need provider
--     reconciliation (gh_pi_earnings_payout_release_verified_failure after Pi confirms a
--     cancelled payment with no transaction).
--   * GHC withdrawals in 'processing' (an operator has begun settlement).
--
-- Default is a dry run. Only service_role may execute.

CREATE OR REPLACE FUNCTION public.gh_financial_release_stale_holds(
  p_max_age_hours integer DEFAULT 24,
  p_dry_run boolean DEFAULT true,
  p_limit integer DEFAULT 200
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hours integer := LEAST(GREATEST(COALESCE(p_max_age_hours, 24), 24), 24 * 30);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
  v_cutoff timestamptz;
  v_dry boolean := COALESCE(p_dry_run, true);
  r record;
  v_res jsonb;
  v_pi_released jsonb := '[]'::jsonb;
  v_ghc_released jsonb := '[]'::jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_pi_held jsonb;
  v_ghc_held jsonb;
BEGIN
  -- Never shorter than 24h: callers cannot use this to release fresh, in-flight holds.
  v_cutoff := now() - make_interval(hours => v_hours);

  -- ---------------- Pi earnings: never-started reservations ----------------
  FOR r IN
    SELECT *
      FROM public.gh_pi_earnings_payout_requests
     WHERE network = 'Pi Testnet'
       AND status = 'reserved'
       AND created_at < v_cutoff
       AND provider_payment_id IS NULL
       AND provider_txid IS NULL
       AND provider_receipt IS NULL
       AND provider_verified_at IS NULL
       AND execution_started_at IS NULL
       AND execution_lease_token IS NULL
       AND execution_lease_expires_at IS NULL
       AND COALESCE(execution_attempts, 0) = 0
     ORDER BY created_at
     LIMIT v_limit
       FOR UPDATE SKIP LOCKED
  LOOP
    IF v_dry THEN
      v_pi_released := v_pi_released || jsonb_build_array(jsonb_build_object(
        'requestId', r.id, 'userId', r.user_id, 'grossAtomic', r.gross_atomic, 'dryRun', true));
      CONTINUE;
    END IF;

    -- Each request is its own subtransaction: one bad row is reported, never blocks the rest.
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended('pi_earnings_payout:' || r.user_id, 0));

      v_res := public.gh_earnings_release_reserve(
        r.user_id, r.gross_atomic,
        'pi_earnings_payout:release:' || r.id::text, r.id::text,
        'Automatic release: reservation never reached Pi provider execution within ' || v_hours || 'h'
      );
      IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', COALESCE(v_res->>'error', 'UNKNOWN');
      END IF;

      UPDATE public.gh_pi_earnings_payout_requests
         SET status = 'released',
             failure_code = 'AUTO_RELEASED_STALE_UNSTARTED',
             execution_lease_token = NULL,
             execution_lease_expires_at = NULL,
             updated_at = now()
       WHERE id = r.id;

      v_pi_released := v_pi_released || jsonb_build_array(jsonb_build_object(
        'requestId', r.id, 'userId', r.user_id, 'grossAtomic', r.gross_atomic));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'domain', 'pi', 'requestId', r.id, 'error', left(SQLERRM, 200)));
    END;
  END LOOP;

  -- ---------------- GHC withdrawals: unsettled virtual locks ----------------
  FOR r IN
    SELECT *
      FROM public.ghc_withdrawal_requests
     WHERE status IN ('requested', 'under_review', 'approved')
       AND settlement_ref IS NULL
       AND updated_at < v_cutoff
     ORDER BY created_at
     LIMIT v_limit
       FOR UPDATE SKIP LOCKED
  LOOP
    IF v_dry THEN
      v_ghc_released := v_ghc_released || jsonb_build_array(jsonb_build_object(
        'requestId', r.id, 'userId', r.user_id, 'ghcAmount', r.ghc_amount, 'dryRun', true));
      CONTINUE;
    END IF;

    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || r.user_id));

      v_res := public.ghc_withdrawal_set_status(
        r.id, 'system:stale-hold-reaper', 'rejected', NULL,
        'AUTO_RELEASED_STALE_HOLD_' || v_hours || 'H'
      );
      IF COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', COALESCE(v_res->>'error', 'UNKNOWN');
      END IF;

      v_ghc_released := v_ghc_released || jsonb_build_array(jsonb_build_object(
        'requestId', r.id, 'userId', r.user_id, 'ghcAmount', r.ghc_amount));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'domain', 'ghc', 'requestId', r.id, 'error', left(SQLERRM, 200)));
    END;
  END LOOP;

  -- ---------------- Held for provider / operator reconciliation ----------------
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'requestId', id, 'userId', user_id, 'status', status, 'grossAtomic', gross_atomic,
           'hasProviderEvidence', (provider_payment_id IS NOT NULL OR provider_txid IS NOT NULL
                                   OR provider_receipt IS NOT NULL))), '[]'::jsonb)
    INTO v_pi_held
    FROM (
      SELECT * FROM public.gh_pi_earnings_payout_requests
       WHERE status IN ('reserved', 'processing', 'uncertain')
         AND created_at < v_cutoff
         AND NOT (status = 'reserved' AND provider_payment_id IS NULL AND provider_txid IS NULL
                  AND provider_receipt IS NULL AND provider_verified_at IS NULL
                  AND execution_started_at IS NULL AND execution_lease_token IS NULL
                  AND execution_lease_expires_at IS NULL AND COALESCE(execution_attempts, 0) = 0)
       ORDER BY created_at
       LIMIT 100
    ) h;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'requestId', id, 'userId', user_id, 'status', status, 'ghcAmount', ghc_amount)), '[]'::jsonb)
    INTO v_ghc_held
    FROM (
      SELECT * FROM public.ghc_withdrawal_requests
       WHERE status = 'processing' AND updated_at < v_cutoff
       ORDER BY created_at
       LIMIT 100
    ) h;

  RETURN jsonb_build_object(
    'ok', true,
    'dryRun', v_dry,
    'maxAgeHours', v_hours,
    'cutoff', v_cutoff,
    'piReleased', v_pi_released,
    'ghcReleased', v_ghc_released,
    'failed', v_failed,
    'piHeldForReconciliation', v_pi_held,
    'ghcHeldProcessing', v_ghc_held
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_financial_release_stale_holds(integer, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_financial_release_stale_holds(integer, boolean, integer) TO service_role;

COMMENT ON FUNCTION public.gh_financial_release_stale_holds(integer, boolean, integer) IS
  'Releases Pi earnings reservations that never reached provider execution and unsettled GHC withdrawal locks older than 24h. Reports, never releases, anything with possible provider activity. Dry run by default.';

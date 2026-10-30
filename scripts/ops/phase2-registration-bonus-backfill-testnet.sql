-- PHASE 2 OPERATOR ACTION — TESTNET ONLY.
-- Review the preview first. This script credits only users with a legacy v1
-- registration bonus, using the server-owned idempotent claim RPC to post the
-- remaining 2.95 PI. It does not credit users with no v1 entry.
-- Do not run on Mainnet. Confirm the Supabase project is the intended Testnet
-- project and reconcile its migration history before executing the DO block.

-- 1) Read-only preview: eligible legacy claimants and whether reconciliation exists.
SELECT
  e.user_id,
  e.amount_atomic AS legacy_amount_atomic,
  (e.amount_atomic / 10000000.0) AS legacy_amount_pi,
  e.status AS legacy_status,
  EXISTS (
    SELECT 1 FROM public.gh_earnings_ledger_entries t
    WHERE t.user_id = e.user_id
      AND t.unique_ref = 'registration_bonus:v2_topup:' || e.user_id
  ) AS topup_already_recorded,
  EXISTS (
    SELECT 1 FROM public.gh_earnings_ledger_entries f
    WHERE f.user_id = e.user_id
      AND f.unique_ref = 'registration_bonus:v2:' || e.user_id
  ) AS full_v2_bonus_already_recorded
FROM public.gh_earnings_ledger_entries e
WHERE e.unique_ref = 'registration_bonus:v1:' || e.user_id
ORDER BY e.created_at, e.user_id;

-- 2) Explicit write operation. Execute only after reviewing the preview above.
-- The whole DO block runs in the SQL editor's transaction; any failure aborts it.
DO $$
DECLARE
  v_row record;
  v_result jsonb;
  v_processed integer := 0;
  v_credited integer := 0;
  v_duplicates integer := 0;
BEGIN
  FOR v_row IN
    SELECT DISTINCT e.user_id
    FROM public.gh_earnings_ledger_entries e
    WHERE e.unique_ref = 'registration_bonus:v1:' || e.user_id
    ORDER BY e.user_id
  LOOP
    v_result := public.gh_earnings_registration_bonus_claim(v_row.user_id);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Registration bonus reconciliation failed for user %, error %',
        v_row.user_id, COALESCE(v_result->>'error', 'UNKNOWN');
    END IF;
    v_processed := v_processed + 1;
    IF COALESCE((v_result->>'duplicate')::boolean, false) THEN
      v_duplicates := v_duplicates + 1;
    ELSE
      v_credited := v_credited + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Phase 2 Testnet registration bonus backfill: processed %, credited %, already reconciled %',
    v_processed, v_credited, v_duplicates;
END;
$$;

-- 3) Read-only post-check. Each legacy v1 claimant should have a top-up ref,
-- unless a v2 full-bonus ref already exists (which prevents an additional credit).
SELECT
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM public.gh_earnings_ledger_entries t
    WHERE t.user_id = e.user_id
      AND t.unique_ref = 'registration_bonus:v2_topup:' || e.user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.gh_earnings_ledger_entries f
    WHERE f.user_id = e.user_id
      AND f.unique_ref = 'registration_bonus:v2:' || e.user_id
  )) AS legacy_users_still_needing_reconciliation,
  COUNT(DISTINCT e.user_id) AS legacy_users_total
FROM public.gh_earnings_ledger_entries e
WHERE e.unique_ref = 'registration_bonus:v1:' || e.user_id;

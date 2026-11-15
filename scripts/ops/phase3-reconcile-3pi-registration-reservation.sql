-- Reconcile registration bonus (canonical 3 π = 30_000_000 atomic) for one user.
-- Usage:
--   psql "$URL" -v target_user="'user_id_here'" -f scripts/ops/phase3-reconcile-3pi-registration-reservation.sql
-- Optional: omit -v to list all users whose registration_bonus sum != 30000000

\set ON_ERROR_STOP on

\echo '=== 3 π registration bonus reconciliation ==='

-- Per-user sum of registration bonus credits (adjust table/column names if your ledger differs)
DO $$
BEGIN
  IF to_regclass('public.gh_earnings_ledger_entries') IS NOT NULL THEN
    RAISE NOTICE 'Using public.gh_earnings_ledger_entries';
  ELSIF to_regclass('public.gh_unified_earnings_ledger') IS NOT NULL THEN
    RAISE NOTICE 'Using public.gh_unified_earnings_ledger — adapt SELECT if columns differ';
  ELSE
    RAISE EXCEPTION 'No known earnings ledger table found';
  END IF;
END $$;

-- Primary query: gh_earnings_ledger_entries shape used by registration bonus migrations
SELECT user_id,
       unique_ref,
       amount_atomic,
       status,
       kind,
       created_at
  FROM public.gh_earnings_ledger_entries
 WHERE unique_ref LIKE 'registration_bonus:%'
   AND (
     :'target_user' = '' 
     OR :'target_user' IS NULL
     OR user_id = trim(both '''' from :'target_user')
   )
 ORDER BY user_id, created_at;

SELECT user_id,
       SUM(amount_atomic)::bigint AS total_atomic,
       ROUND(SUM(amount_atomic)::numeric / 10000000, 7) AS total_pi,
       COUNT(*) AS credit_rows,
       CASE
         WHEN SUM(amount_atomic) = 30000000 THEN 'OK_EXACT_3PI'
         WHEN SUM(amount_atomic) = 500000 THEN 'LEGACY_V1_ONLY_NEEDS_TOPUP'
         WHEN SUM(amount_atomic) = 500000 + 29500000 THEN 'OK_V1_PLUS_TOPUP_EQUALS_3PI'
         ELSE 'MISMATCH_INVESTIGATE'
       END AS verdict
  FROM public.gh_earnings_ledger_entries
 WHERE unique_ref LIKE 'registration_bonus:%'
   AND (
     :'target_user' = ''
     OR :'target_user' IS NULL
     OR user_id = trim(both '''' from :'target_user')
   )
 GROUP BY user_id
 ORDER BY user_id;

-- Reserved PI tied to registration or payout (investigation aid)
SELECT r.id AS payout_request_id,
       r.user_id,
       r.status,
       r.gross_atomic,
       r.network,
       r.provider_payment_id,
       r.provider_txid,
       r.execution_started_at,
       r.execution_attempts,
       r.failure_code,
       r.created_at
  FROM public.gh_pi_earnings_payout_requests r
 WHERE (
     :'target_user' = ''
     OR :'target_user' IS NULL
     OR r.user_id = trim(both '''' from :'target_user')
   )
   AND r.status IN ('reserved', 'processing', 'uncertain')
 ORDER BY r.created_at DESC
 LIMIT 50;

\echo 'Expected for a fully reconciled new user: total_atomic = 30000000 (3.0000000 PI), verdict OK_EXACT_3PI'
\echo 'Or legacy: 500000 + 29500000 with verdict OK_V1_PLUS_TOPUP_EQUALS_3PI'

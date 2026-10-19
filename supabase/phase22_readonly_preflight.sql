-- Phase 22 read-only preflight. Safe to run before applying migration 202610250008.
-- It makes no schema or data changes.
SELECT current_database() AS database_name, current_user AS database_role, now() AS checked_at;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('202610250008', '202610250008_paystack_ngn_beneficiaries_and_payouts')
   OR name ILIKE '%paystack%ngn%payout%'
ORDER BY version;

SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'gh_bank_beneficiaries','gh_bank_payout_obligations','gh_bank_payout_daily_limits','gh_bank_payout_requests',
    'gh_bank_payout_operator_actions','gh_bank_payout_webhook_events','gh_bank_payout_reconciliations'
  )
ORDER BY table_name;

-- This should show whether current order rails have any NGN source at all.
SELECT upper(currency) AS currency, lower(payment_method) AS payment_method,
       count(*) AS order_count,
       count(*) FILTER (WHERE status='completed' AND payment_status='verified') AS completed_verified_orders
FROM public.gh_marketplace_orders
GROUP BY upper(currency), lower(payment_method)
ORDER BY 1,2;

-- The new adapter must not be mistaken for a GHC/PI-to-NGN conversion path.
SELECT 'NGN bank payout requires gh_bank_payout_obligations from a trusted NGN revenue source' AS required_funding_boundary;

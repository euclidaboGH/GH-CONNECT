-- Phase 22 post-migration assertions. Read-only; expected after 202610250008 is applied.
SELECT table_name, row_security
FROM (
  SELECT c.relname AS table_name, c.relrowsecurity AS row_security
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (
    'gh_bank_beneficiaries','gh_bank_payout_obligations','gh_bank_payout_daily_limits','gh_bank_payout_requests',
    'gh_bank_payout_operator_actions','gh_bank_payout_webhook_events','gh_bank_payout_reconciliations'
  )
) t ORDER BY table_name;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'gh_bank_payout_record_obligation','gh_bank_beneficiary_disable','gh_bank_payout_request','gh_bank_payout_operator_transition','gh_bank_payout_resolve_exception',
  'gh_bank_payout_begin_transfer','gh_bank_payout_record_submission','gh_bank_payout_apply_webhook',
  'gh_bank_payout_apply_reconciliation'
) ORDER BY p.proname;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'public.gh_bank_beneficiaries'::regclass,
  'public.gh_bank_payout_obligations'::regclass,
  'public.gh_bank_payout_requests'::regclass,
  'public.gh_bank_payout_webhook_events'::regclass,
  'public.gh_bank_payout_reconciliations'::regclass
)
ORDER BY table_name::text, conname;

SELECT 'No bank payout can become paid without signed webhook evidence or authenticated provider reconciliation' AS invariant;

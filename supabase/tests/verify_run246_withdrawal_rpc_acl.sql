-- Read-only Run #246 postflight. Run only after the REVIEW_REQUIRED migration is approved/applied.
-- This script checks effective catalog privileges; it does not read or modify user records.
DO $$
DECLARE
  payout_table regclass := to_regclass('public.gh_pi_earnings_payout_requests');
  pin_table regclass := to_regclass('public.gh_withdrawal_pins');
  recovery_table regclass := to_regclass('public.gh_withdrawal_pin_recovery');
BEGIN
  IF payout_table IS NULL OR pin_table IS NULL OR recovery_table IS NULL THEN
    RAISE EXCEPTION 'Run #246 postflight: required payout/PIN tables are missing';
  END IF;

  IF has_table_privilege('service_role', payout_table, 'SELECT') THEN
    RAISE EXCEPTION 'Run #246 postflight: direct service_role SELECT on payout requests must remain revoked';
  END IF;
  IF has_table_privilege('anon', payout_table, 'SELECT') OR has_table_privilege('authenticated', payout_table, 'SELECT') THEN
    RAISE EXCEPTION 'Run #246 postflight: client payout-table SELECT must remain revoked';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.gh_pi_earnings_payout_get_owned(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Run #246 postflight: service_role cannot execute owned payout lookup RPC';
  END IF;
  IF has_function_privilege('anon', 'public.gh_pi_earnings_payout_get_owned(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.gh_pi_earnings_payout_get_owned(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Run #246 postflight: client role can execute owned payout lookup RPC';
  END IF;

  IF NOT has_table_privilege('service_role', pin_table, 'SELECT')
     OR NOT has_table_privilege('service_role', pin_table, 'INSERT')
     OR NOT has_table_privilege('service_role', pin_table, 'UPDATE') THEN
    RAISE EXCEPTION 'Run #246 postflight: service_role PIN storage privileges are incomplete';
  END IF;
  IF has_table_privilege('anon', pin_table, 'SELECT') OR has_table_privilege('authenticated', pin_table, 'SELECT')
     OR has_table_privilege('anon', pin_table, 'INSERT') OR has_table_privilege('authenticated', pin_table, 'INSERT') THEN
    RAISE EXCEPTION 'Run #246 postflight: client PIN storage access must remain revoked';
  END IF;

  IF has_table_privilege('service_role', recovery_table, 'SELECT')
     OR has_table_privilege('service_role', recovery_table, 'INSERT')
     OR has_table_privilege('service_role', recovery_table, 'UPDATE') THEN
    RAISE EXCEPTION 'Run #246 postflight: recovery table must be accessed through narrow RPCs only';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.gh_withdrawal_pin_recovery_get(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.gh_withdrawal_pin_recovery_setup(text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.gh_withdrawal_pin_recovery_record_failure(text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.gh_withdrawal_pin_recovery_reset_pin(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Run #246 postflight: one or more recovery RPC grants are missing';
  END IF;
  IF has_function_privilege('anon', 'public.gh_withdrawal_pin_recovery_get(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.gh_withdrawal_pin_recovery_get(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Run #246 postflight: client role can execute recovery RPC';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = pin_table)
     OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = recovery_table) THEN
    RAISE EXCEPTION 'Run #246 postflight: RLS must remain enabled on PIN and recovery tables';
  END IF;
END;
$$;

SELECT 'Run #246 withdrawal/PIN ACL postflight: PASS (catalog-only; no user data read or mutated)' AS result;

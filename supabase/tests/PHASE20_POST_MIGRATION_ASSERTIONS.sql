-- Run only after migrations 202610250006 and 202610250007 are reviewed and applied.
DO $$
DECLARE fn regprocedure; tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['gh_pi_a2u_executions','gh_pi_a2u_sequence_lease','gh_seller_payout_ghc_settlements'] LOOP
  IF to_regclass('public.'||tbl) IS NULL THEN RAISE EXCEPTION 'Missing Phase 20 table: %',tbl; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||tbl)) THEN RAISE EXCEPTION 'RLS disabled: %',tbl; END IF;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY[
  to_regprocedure('public.gh_pi_a2u_begin_execution(text,text,text)'),
  to_regprocedure('public.gh_pi_a2u_update_execution(text,text,text,text,text,text)'),
  to_regprocedure('public.gh_pi_a2u_release_sequence_lease(text,text)'),
  to_regprocedure('public.gh_seller_payout_settle_ghc_atomic(text,text)')
 ] LOOP
  IF fn IS NULL THEN RAISE EXCEPTION 'Missing Phase 20 RPC'; END IF;
  IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'service_role cannot execute %',fn; END IF;
  IF has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') OR EXISTS (
    SELECT 1 FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE'
  ) THEN
   RAISE EXCEPTION 'Client/public execution unexpectedly granted on %',fn;
  END IF;
 END LOOP;
END $$;

SELECT 'pi_a2u_executions' AS table_name, count(*) AS row_count FROM public.gh_pi_a2u_executions
UNION ALL SELECT 'pi_a2u_active_leases', count(*) FROM public.gh_pi_a2u_sequence_lease WHERE lease_expires_at>now()
UNION ALL SELECT 'ghc_seller_payout_settlements', count(*) FROM public.gh_seller_payout_ghc_settlements;

-- Any paid GHC payout must have one settlement record and a matching posted debit/credit pair.
SELECT p.id AS payout_id, p.status, s.transfer_reference,
       (d.id IS NOT NULL AND c.id IS NOT NULL AND abs(d.amount)=s.amount AND c.amount=s.amount) AS ledger_pair_matches
FROM public.gh_seller_payout_requests p
JOIN public.gh_seller_payout_ghc_settlements s ON s.payout_request_id=p.id
LEFT JOIN public.ghc_transactions d ON d.id=s.debit_transaction_id AND d.reference_id=s.transfer_reference AND d.kind='transfer_out' AND d.status='posted'
LEFT JOIN public.ghc_transactions c ON c.id=s.credit_transaction_id AND c.reference_id=s.transfer_reference AND c.kind='transfer_in' AND c.status='posted'
WHERE p.status<>'paid' OR d.id IS NULL OR c.id IS NULL OR abs(d.amount)<>s.amount OR c.amount<>s.amount;

-- Read-only assertions for the Phase 5 payment-intent idempotency and atomic-transition migrations.
-- Run only after a reviewed disposable/Testnet migration. This file does not mutate data.
DO $$
DECLARE
  v_fn text;
BEGIN
  IF to_regclass('public.ghc_payment_intents') IS NULL THEN
    RAISE EXCEPTION 'Missing public.ghc_payment_intents';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.ghc_payment_intent_get(text)',
    'public.ghc_payment_intent_by_provider(text)',
    'public.ghc_payment_intent_by_idempotency(text,text)',
    'public.ghc_payment_intent_bind_provider(text,text,text)',
    'public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb)'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION 'Missing required payment-intent RPC: %', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute privileged payment-intent RPC: %', v_fn;
    END IF;
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can execute privileged payment-intent RPC: %', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role cannot execute required payment-intent RPC: %', v_fn;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.ghc_payment_intent_upsert(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ghc_payment_intent_upsert(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client role can execute payment-intent upsert';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ghc_payment_intents'
      AND indexname = 'uq_ghc_payment_intents_idempotency'
  ) THEN RAISE EXCEPTION 'Missing unique idempotency index'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ghc_payment_intents'
      AND indexname = 'uq_ghc_payment_intents_provider_payment'
  ) THEN RAISE EXCEPTION 'Missing unique provider-payment index'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ghc_payment_intents'
      AND indexname = 'uq_ghc_payment_intents_txid'
  ) THEN RAISE EXCEPTION 'Missing unique settled transaction index'; END IF;
END $$;

SELECT 'PASS: payment-intent RPC ACLs and uniqueness constraints are present' AS assertion_result;

\set ON_ERROR_STOP on
DO $$
DECLARE
  v_function regprocedure := 'public.gh_company_revenue_event_append(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamp with time zone,jsonb)'::regprocedure;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.gh_company_revenue_events'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled';
  END IF;
  IF has_table_privilege('anon', 'public.gh_company_revenue_events', 'SELECT') OR has_table_privilege('anon', 'public.gh_company_revenue_events', 'INSERT') OR has_table_privilege('anon', 'public.gh_company_revenue_events', 'UPDATE') OR has_table_privilege('anon', 'public.gh_company_revenue_events', 'DELETE')
     OR has_table_privilege('authenticated', 'public.gh_company_revenue_events', 'SELECT') OR has_table_privilege('authenticated', 'public.gh_company_revenue_events', 'INSERT') OR has_table_privilege('authenticated', 'public.gh_company_revenue_events', 'UPDATE') OR has_table_privilege('authenticated', 'public.gh_company_revenue_events', 'DELETE')
     OR has_table_privilege('service_role', 'public.gh_company_revenue_events', 'SELECT') OR has_table_privilege('service_role', 'public.gh_company_revenue_events', 'INSERT') OR has_table_privilege('service_role', 'public.gh_company_revenue_events', 'UPDATE') OR has_table_privilege('service_role', 'public.gh_company_revenue_events', 'DELETE') THEN
    RAISE EXCEPTION 'API role unexpectedly has direct table access';
  END IF;
  IF has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Untrusted API role can execute append RPC';
  END IF;
  IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute append RPC';
  END IF;
END $$;

-- Execute through the only intended application role. Verify canonical insert and exact retry.
SET ROLE service_role;
SELECT public.gh_company_revenue_event_append(
  'pgtest-idem-001', 'paystack', 'pgtest-provider-event-001', 'membership_revenue', 'NGN',
  10000, 2500, 300, 0, 'pgtest-reference-001', now(), '{"region":"test"}'::jsonb
) AS first_insert \gset
SELECT public.gh_company_revenue_event_append(
  'pgtest-idem-001', 'paystack', 'pgtest-provider-event-001', 'membership_revenue', 'NGN',
  10000, 2500, 300, 0, 'pgtest-reference-001', now(), '{"region":"different-but-not-economic"}'::jsonb
) AS duplicate_retry \gset
RESET ROLE;

SELECT ((:'first_insert'::jsonb ->> 'ok') = 'true' AND (:'first_insert'::jsonb ->> 'duplicate') = 'false') AS first_ok \gset
\if :first_ok\n\else\n  \echo 'FAIL: first insert response incorrect'
  \quit 1
\endif
SELECT ((:'duplicate_retry'::jsonb ->> 'ok') = 'true' AND (:'duplicate_retry'::jsonb ->> 'duplicate') = 'true') AS duplicate_ok \gset
\if :duplicate_ok\n\else\n  \echo 'FAIL: duplicate response incorrect'
  \quit 1
\endif
DO $$
DECLARE v_count integer; v_net bigint;
BEGIN
  SELECT count(*), max(company_net_minor) INTO v_count, v_net
  FROM public.gh_company_revenue_events WHERE idempotency_key = 'pgtest-idem-001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Exact retry created % rows; expected one', v_count; END IF;
  IF v_net <> 2200 THEN RAISE EXCEPTION 'Generated company_net_minor wrong: %', v_net; END IF;
END $$;

-- Reusing either unique key for a different economic event must conflict.
SET ROLE service_role;
SELECT public.gh_company_revenue_event_append(
  'pgtest-idem-001', 'paystack', 'pgtest-provider-event-002', 'membership_revenue', 'NGN',
  10000, 2500, 300, 0, 'pgtest-reference-001', now(), '{}'::jsonb
) AS key_conflict \gset
SELECT public.gh_company_revenue_event_append(
  'pgtest-idem-002', 'paystack', 'pgtest-provider-event-001', 'membership_revenue', 'NGN',
  10000, 2500, 300, 0, 'pgtest-reference-001', now(), '{}'::jsonb
) AS event_conflict \gset
RESET ROLE;
SELECT ((:'key_conflict'::jsonb ->> 'error') = 'REVENUE_IDEMPOTENCY_CONFLICT') AS key_conflict_ok \gset
\if :key_conflict_ok\n\else\n  \echo 'FAIL: idempotency-key conflict not rejected'
  \quit 1
\endif
SELECT ((:'event_conflict'::jsonb ->> 'error') = 'REVENUE_IDEMPOTENCY_CONFLICT') AS event_conflict_ok \gset
\if :event_conflict_ok\n\else\n  \echo 'FAIL: provider-event conflict not rejected'
  \quit 1
\endif

-- Trigger-level immutability: even table owner must not update or delete journal rows.
DO $$ BEGIN
  BEGIN
    UPDATE public.gh_company_revenue_events SET source_reference = 'tampered'
      WHERE idempotency_key = 'pgtest-idem-001';
    RAISE EXCEPTION 'UPDATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM <> 'GH_COMPANY_REVENUE_JOURNAL_APPEND_ONLY' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.gh_company_revenue_events WHERE idempotency_key = 'pgtest-idem-001';
    RAISE EXCEPTION 'DELETE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM <> 'GH_COMPANY_REVENUE_JOURNAL_APPEND_ONLY' THEN RAISE; END IF;
  END;
END $$;

-- Invalid zero-value and unverified events must be rejected by the RPC.
SET ROLE service_role;
SELECT public.gh_company_revenue_event_append(
  'pgtest-zero', 'paystack', 'pgtest-zero-event', 'membership_revenue', 'NGN',
  0, 0, 0, 0, 'pgtest-zero-ref', now(), '{}'::jsonb
) AS zero_event \gset
SELECT public.gh_company_revenue_event_append(
  'pgtest-unverified', 'paystack', 'pgtest-unverified-event', 'membership_revenue', 'NGN',
  100, 10, 0, 0, 'pgtest-unverified-ref', NULL, '{}'::jsonb
) AS unverified_event \gset
RESET ROLE;
SELECT ((:'zero_event'::jsonb ->> 'error') = 'ZERO_VALUE_EVENT') AS zero_ok \gset
\if :zero_ok\n\else\n  \echo 'FAIL: zero-value event not rejected'
  \quit 1
\endif
SELECT ((:'unverified_event'::jsonb ->> 'error') = 'VERIFIED_SOURCE_REQUIRED') AS unverified_ok \gset
\if :unverified_ok\n\else\n  \echo 'FAIL: unverified event not rejected'
  \quit 1
\endif

\echo 'PASS: revenue journal permissions, immutability, idempotency, conflict, generated net, and input gates'

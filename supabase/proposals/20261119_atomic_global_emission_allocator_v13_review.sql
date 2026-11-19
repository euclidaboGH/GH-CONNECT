-- RUN376 REVIEW-ONLY PROPOSAL — atomic multi-instance GHC emission governor.
--
-- DO NOT paste this proposal into a live SQL Editor or apply it directly.
-- First reconcile the exact Testnet migration history against the canonical
-- source migrations, inspect the live definitions of the dependent v12 RPCs,
-- rehearse on a disposable Testnet branch, and obtain explicit operator approval.
-- Mainnet requires a separate review and must remain untouched.
--
-- Purpose:
--   * Serialize global daily demand for both Daily Claim and activity emission.
--   * Calculate the safety governor from the shared durable demand row.
--   * Execute Daily Claim v12 and reserve its demand in the SAME transaction.
--   * Preserve the existing pending-48-hour claim lifecycle and 80/20 split.
--   * Never allow client-supplied amounts, m, g, votes or balances to decide issuance.
--
-- Preconditions:
--   * public.ghc_global_emission_demand from 20261022010012 exists.
--   * public.ghc_claim_streak_state and ghc_execute_daily_claim_v12 from
--     20261022010076 exist and have been reconciled against the live database.
--   * service-role-only function ACLs and SECURITY DEFINER search_path checks pass.
--
-- Source callers remain gated by GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=true.


-- One-time, idempotent backfill of prior Daily Claim demand. The legacy v12
-- path stored baseGross and m on the user ledger row but kept global demand in
-- process memory. Existing activity demand already lives in the shared table.
CREATE TABLE IF NOT EXISTS public.ghc_global_emission_backfill_v1 (
  day_key text PRIMARY KEY,
  demand_m numeric NOT NULL CHECK (demand_m >= 0),
  applied_at timestamptz
);
ALTER TABLE public.ghc_global_emission_backfill_v1 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_global_emission_backfill_no_client ON public.ghc_global_emission_backfill_v1;
CREATE POLICY ghc_global_emission_backfill_no_client ON public.ghc_global_emission_backfill_v1
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.ghc_global_emission_backfill_v1 FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.ghc_global_emission_backfill_v1 (day_key, demand_m)
SELECT
  metadata->>'claimDayKey' AS day_key,
  sum((metadata->>'baseGross')::numeric * (metadata->>'m')::numeric) AS demand_m
FROM public.ghc_transactions
WHERE source_event = 'DAILY_CLAIM_V12'
  AND kind = 'earned'
  AND status IN ('pending', 'posted')
  AND metadata->>'claimDayKey' ~ '^\d{4}-\d{2}-\d{2}$'
  AND metadata->>'baseGross' ~ '^[0-9]+(\.[0-9]+)?$'
  AND metadata->>'m' ~ '^[0-9]+(\.[0-9]+)?$'
  AND (metadata->>'baseGross')::numeric > 0
  AND (metadata->>'m')::numeric BETWEEN 0 AND 1
GROUP BY metadata->>'claimDayKey'
ON CONFLICT (day_key) DO NOTHING;

DO $$
DECLARE v_row record;
BEGIN
  FOR v_row IN
    SELECT day_key, demand_m
    FROM public.ghc_global_emission_backfill_v1
    WHERE applied_at IS NULL
    ORDER BY day_key
    FOR UPDATE
  LOOP
    INSERT INTO public.ghc_global_emission_demand (day_key, demand_after_m, updated_at)
    VALUES (v_row.day_key, v_row.demand_m, now())
    ON CONFLICT (day_key) DO UPDATE
      SET demand_after_m = public.ghc_global_emission_demand.demand_after_m + EXCLUDED.demand_after_m,
          updated_at = now();
    UPDATE public.ghc_global_emission_backfill_v1
    SET applied_at = now()
    WHERE day_key = v_row.day_key AND applied_at IS NULL;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_reserve_global_emission_demand_v1(
  p_day_key text,
  p_amount_m numeric,
  p_eligible_users bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_before numeric := 0;
  v_after numeric := 0;
  v_budget numeric := 0;
  v_g numeric := 1;
BEGIN
  IF p_day_key IS NULL OR p_day_key !~ '^\d{4}-\d{2}-\d{2}$'
     OR to_char(to_date(p_day_key, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> p_day_key
     OR p_amount_m IS NULL OR p_amount_m <= 0 OR p_amount_m > 1000000000
     OR p_eligible_users IS NULL OR p_eligible_users < 1 OR p_eligible_users > 1000000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_GLOBAL_DEMAND_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_global_emission:' || p_day_key));

  INSERT INTO public.ghc_global_emission_demand (day_key, demand_after_m, updated_at)
  VALUES (p_day_key, 0, now())
  ON CONFLICT (day_key) DO NOTHING;

  SELECT demand_after_m INTO v_before
  FROM public.ghc_global_emission_demand
  WHERE day_key = p_day_key
  FOR UPDATE;
  v_before := greatest(0, coalesce(v_before, 0));
  v_after := v_before + p_amount_m;
  v_budget := 8 * power(p_eligible_users::numeric, 0.85);
  IF v_after > v_budget THEN
    v_g := greatest(0, least(1, v_budget / v_after));
  END IF;

  UPDATE public.ghc_global_emission_demand
  SET demand_after_m = v_after, updated_at = now()
  WHERE day_key = p_day_key;

  RETURN jsonb_build_object(
    'ok', true,
    'demandBefore', v_before,
    'demandAfter', v_after,
    'budget', v_budget,
    'g', v_g
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_reserve_global_emission_demand_v1(text, numeric, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_reserve_global_emission_demand_v1(text, numeric, bigint) TO service_role;


CREATE OR REPLACE FUNCTION public.ghc_activity_try_emission_v2(
  p_user_id text,
  p_day_key text,
  p_week_key text,
  p_requested numeric,
  p_daily_cap numeric,
  p_weekly_cap numeric,
  p_eligible_users bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_grant jsonb;
  v_base numeric;
  v_n numeric;
  v_m numeric;
  v_g numeric;
  v_gross numeric;
  v_alloc jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 OR length(trim(p_user_id)) > 160
     OR p_day_key IS NULL OR p_day_key !~ '^\d{4}-\d{2}-\d{2}$'
     OR to_char(to_date(p_day_key, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> p_day_key
     OR p_week_key IS NULL OR p_week_key !~ '^\d{4}-W\d{2}$'
     OR p_requested IS NULL OR p_requested <= 0
     OR p_daily_cap IS DISTINCT FROM 0.5
     OR p_weekly_cap IS DISTINCT FROM 2.5
     OR p_eligible_users IS NULL OR p_eligible_users < 1 OR p_eligible_users > 1000000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ACTIVITY_EMISSION_INPUT');
  END IF;

  -- The nested user-window grant and global reservation share this transaction.
  -- If the global reservation fails, the exception rolls back the user cap update too.
  v_grant := public.ghc_activity_try_grant(
    p_user_id, p_day_key, p_week_key, p_requested, p_daily_cap, p_weekly_cap
  );
  IF coalesce((v_grant->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN coalesce(v_grant, jsonb_build_object('ok', false, 'error', 'ACTIVITY_GRANT_FAILED'));
  END IF;
  v_base := greatest(0, coalesce((v_grant->>'granted')::numeric, 0));
  IF v_base <= 0 THEN RETURN v_grant; END IF;

  v_n := greatest(10, p_eligible_users)::numeric;
  v_m := greatest(0.18, least(1,
    0.18 + 0.82 / power(1 + 0.2 * (ln(v_n / 10) / ln(10)), 1.15)
  ));
  v_alloc := public.ghc_reserve_global_emission_demand_v1(p_day_key, v_base * v_m, p_eligible_users);
  IF coalesce((v_alloc->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GLOBAL_EMISSION_RESERVATION_FAILED';
  END IF;
  v_g := greatest(0, least(1, coalesce((v_alloc->>'g')::numeric, 0)));
  v_gross := round(v_base * v_m * v_g, 6);
  IF v_gross <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EMISSION_BUDGET_EXHAUSTED';
  END IF;

  RETURN v_grant || jsonb_build_object(
    'ok', true,
    'baseGhc', v_base,
    'grantedGhc', v_gross,
    'm', v_m,
    'g', v_g,
    'demandAfter', (v_alloc->>'demandAfter')::numeric,
    'budget', (v_alloc->>'budget')::numeric
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_try_emission_v2(text, text, text, numeric, numeric, numeric, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_activity_try_emission_v2(text, text, text, numeric, numeric, numeric, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.ghc_execute_daily_claim_v13(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day integer,
  p_completed_cycles integer,
  p_idempotency_key text,
  p_eligible_users bigint,
  p_economic_version text DEFAULT '1.2',
  p_missed_day_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day text;
  v_base numeric;
  v_n numeric;
  v_m numeric;
  v_g numeric;
  v_gross numeric;
  v_user numeric;
  v_reserve numeric;
  v_budget numeric;
  v_demand_after numeric;
  v_alloc jsonb;
  v_claim jsonb;
  v_streak public.ghc_claim_streak_state%ROWTYPE;
  v_existing boolean := false;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 OR length(trim(p_user_id)) > 160
     OR p_claim_day_key IS NULL
     OR p_cycle_day IS NULL OR p_cycle_day < 1 OR p_cycle_day > 7
     OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 OR length(trim(p_idempotency_key)) > 160
     OR trim(p_idempotency_key) !~ '^[A-Za-z0-9._:-]+$'
     OR p_completed_cycles IS NULL OR p_completed_cycles < 0 OR p_completed_cycles > 1000000000
     OR p_eligible_users IS NULL OR p_eligible_users < 1 OR p_eligible_users > 1000000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAILY_CLAIM_V13_INPUT');
  END IF;

  v_day := to_char(p_claim_day_key, 'YYYY-MM-DD');
  v_base := CASE p_cycle_day
    WHEN 1 THEN 0.39 WHEN 2 THEN 0.62 WHEN 3 THEN 0.86
    WHEN 4 THEN 1.09 WHEN 5 THEN 1.33 WHEN 6 THEN 1.56
    WHEN 7 THEN 1.96 ELSE 0 END;
  v_n := greatest(10, p_eligible_users)::numeric;
  v_m := greatest(0.18, least(1,
    0.18 + 0.82 / power(1 + 0.2 * (ln(v_n / 10) / ln(10)), 1.15)
  ));
  v_budget := 8 * power(p_eligible_users::numeric, 0.85);

  -- Global-day lock serializes Daily Claim and activity reservations.
  PERFORM pg_advisory_xact_lock(hashtext('ghc_global_emission:' || v_day));

  -- Establish and lock the per-user streak row before checking duplicate claims.
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (p_user_id, 0, 0, NULL, 0, coalesce(p_economic_version, '1.2'), NULL, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_existing := v_streak.last_claim_day_key = p_claim_day_key
    OR v_streak.last_idempotency_key = p_idempotency_key;

  IF v_existing THEN
    -- Delegate the exact idempotent response to the established v12 ledger path.
    v_claim := public.ghc_execute_daily_claim_v12(
      p_user_id, p_claim_day_key, p_cycle_day, greatest(0, coalesce(p_completed_cycles, 0)),
      p_idempotency_key, 0.000005, 0.000004, 0.000001, 0.000005, 1, 1,
      coalesce(p_economic_version, '1.2'), coalesce(p_missed_day_reset, false)
    );
    SELECT coalesce(demand_after_m, 0) INTO v_demand_after
    FROM public.ghc_global_emission_demand WHERE day_key = v_day;
    RETURN coalesce(v_claim, '{}'::jsonb) || jsonb_build_object(
      'baseGross', v_base, 'm', coalesce((v_claim->>'m')::numeric, v_m),
      'g', coalesce((v_claim->>'g')::numeric, 1),
      'globalDemandAfter', coalesce(v_demand_after, 0), 'globalBudget', v_budget
    );
  END IF;

  v_alloc := public.ghc_reserve_global_emission_demand_v1(v_day, v_base * v_m, p_eligible_users);
  IF coalesce((v_alloc->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN coalesce(v_alloc, jsonb_build_object('ok', false, 'error', 'GLOBAL_DEMAND_RESERVATION_FAILED'));
  END IF;
  v_g := greatest(0, least(1, coalesce((v_alloc->>'g')::numeric, 0)));
  v_demand_after := greatest(0, coalesce((v_alloc->>'demandAfter')::numeric, 0));

  -- Six-decimal micro-GHC rounding; residual always goes to the reserve leg.
  v_gross := round(v_base * v_m * v_g, 6);
  v_user := floor(v_gross * 0.8 * 1000000) / 1000000;
  v_reserve := v_gross - v_user;

  IF v_user <= 0 OR v_gross <= 0 THEN
    UPDATE public.ghc_global_emission_demand
    SET demand_after_m = greatest(0, demand_after_m - (v_base * v_m)), updated_at = now()
    WHERE day_key = v_day;
    RETURN jsonb_build_object('ok', false, 'error', 'EMISSION_BUDGET_EXHAUSTED');
  END IF;

  v_claim := public.ghc_execute_daily_claim_v12(
    p_user_id, p_claim_day_key, p_cycle_day, greatest(0, coalesce(p_completed_cycles, 0)),
    p_idempotency_key, v_gross, v_user, v_reserve, v_base, v_m, v_g,
    coalesce(p_economic_version, '1.2'), coalesce(p_missed_day_reset, false)
  );

  IF coalesce((v_claim->>'ok')::boolean, false) IS NOT TRUE
     OR coalesce((v_claim->>'alreadyClaimed')::boolean, false) IS TRUE THEN
    -- No new entitlement was created; compensate the reserved demand in this transaction.
    UPDATE public.ghc_global_emission_demand
    SET demand_after_m = greatest(0, demand_after_m - (v_base * v_m)), updated_at = now()
    WHERE day_key = v_day;
    RETURN coalesce(v_claim, jsonb_build_object('ok', false, 'error', 'DAILY_CLAIM_COMMIT_FAILED'))
      || jsonb_build_object('globalDemandAfter', greatest(0, v_demand_after - (v_base * v_m)), 'globalBudget', v_budget);
  END IF;

  RETURN v_claim || jsonb_build_object(
    'baseGross', v_base, 'm', v_m, 'g', v_g,
    'globalDemandAfter', v_demand_after, 'globalBudget', v_budget
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_daily_claim_v13(text, date, integer, integer, text, bigint, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v13(text, date, integer, integer, text, bigint, text, boolean) TO service_role;

COMMENT ON FUNCTION public.ghc_activity_try_emission_v2(text, text, text, numeric, numeric, numeric, bigint) IS
  'Atomic activity emission: user daily/weekly cap and shared global-demand reservation commit or roll back together.';
COMMENT ON FUNCTION public.ghc_reserve_global_emission_demand_v1(text, numeric, bigint) IS
  'Atomic global emission demand reservation shared by Daily Claim v13 and activity emission. Over-reservation is conservative; never bypasses the shared day lock.';
COMMENT ON FUNCTION public.ghc_execute_daily_claim_v13(text, date, integer, integer, text, bigint, text, boolean) IS
  'Daily Claim v13: global demand governor + v12 pending ledger/streak transaction in one transaction; no GHC from votes.';

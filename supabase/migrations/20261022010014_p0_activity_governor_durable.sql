-- P0: Multi-instance activity caps + global demand (additive)
-- Does not alter balances or historical ledger.

CREATE OR REPLACE FUNCTION public.ghc_activity_try_grant(
  p_user_id text,
  p_day_key text,
  p_week_key text,
  p_requested numeric,
  p_daily_cap numeric,
  p_weekly_cap numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day numeric := 0;
  v_week numeric := 0;
  v_room_day numeric;
  v_room_week numeric;
  v_grant numeric;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF coalesce(p_requested, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'granted', 0, 'dayRemaining', p_daily_cap, 'weekRemaining', p_weekly_cap);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_act:' || p_user_id));

  SELECT amount_ghc INTO v_day
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'day' AND window_key = p_day_key;
  v_day := coalesce(v_day, 0);

  SELECT amount_ghc INTO v_week
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'week' AND window_key = p_week_key;
  v_week := coalesce(v_week, 0);

  v_room_day := greatest(0, p_daily_cap - v_day);
  v_room_week := greatest(0, p_weekly_cap - v_week);
  v_grant := least(p_requested, v_room_day, v_room_week);

  IF v_grant > 0 THEN
    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = public.ghc_activity_emission_windows.amount_ghc + EXCLUDED.amount_ghc - v_day,
                  updated_at = now();
    -- simpler upsert absolute:
    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'week', p_week_key, v_week + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'granted', v_grant,
    'dayGranted', v_day + v_grant,
    'weekGranted', v_week + v_grant,
    'dayRemaining', greatest(0, p_daily_cap - (v_day + v_grant)),
    'weekRemaining', greatest(0, p_weekly_cap - (v_week + v_grant))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_record_global_demand(
  p_day_key text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  INSERT INTO public.ghc_global_emission_demand (day_key, demand_after_m, updated_at)
  VALUES (p_day_key, greatest(0, coalesce(p_amount, 0)), now())
  ON CONFLICT (day_key)
  DO UPDATE SET
    demand_after_m = public.ghc_global_emission_demand.demand_after_m + greatest(0, coalesce(p_amount, 0)),
    updated_at = now()
  RETURNING demand_after_m INTO v_total;
  RETURN coalesce(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_get_global_demand(p_day_key text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v numeric;
BEGIN
  SELECT demand_after_m INTO v FROM public.ghc_global_emission_demand WHERE day_key = p_day_key;
  RETURN coalesce(v, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_membership_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ghc_membership_entitlements (
    user_id, tier, active, started_at, expires_at, billing_period, source,
    purchase_ref, payment_intent_id, updated_at, audit
  ) VALUES (
    p_row->>'user_id',
    p_row->>'tier',
    coalesce((p_row->>'active')::boolean, true),
    CASE WHEN p_row ? 'started_at' THEN (p_row->>'started_at')::timestamptz ELSE now() END,
    CASE WHEN p_row ? 'expires_at' AND p_row->>'expires_at' IS NOT NULL
      THEN (p_row->>'expires_at')::timestamptz ELSE NULL END,
    p_row->>'billing_period',
    coalesce(p_row->>'source', 'default'),
    p_row->>'purchase_ref',
    p_row->>'payment_intent_id',
    now(),
    coalesce(p_row->'audit', '[]'::jsonb)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    active = EXCLUDED.active,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    billing_period = EXCLUDED.billing_period,
    source = EXCLUDED.source,
    purchase_ref = COALESCE(EXCLUDED.purchase_ref, public.ghc_membership_entitlements.purchase_ref),
    payment_intent_id = COALESCE(EXCLUDED.payment_intent_id, public.ghc_membership_entitlements.payment_intent_id),
    updated_at = now(),
    audit = EXCLUDED.audit;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_record_global_demand(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_get_global_demand(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_membership_upsert(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_record_global_demand(text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_get_global_demand(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_membership_upsert(jsonb) TO service_role;

-- =============================================================================
-- 20261011_ghc_activity_stage_atomic.sql
-- Atomic activity emission grant + pending stage (single transaction).
--
-- Closes P1.5A.1 gap: sequential try_grant then ghc_stage_pending could leave
-- emission capacity consumed when stage failed (DAILY_CAP/COOLDOWN/TARGET_CAP/etc).
--
-- Does NOT replace ghc_stage_pending or ghc_activity_try_grant (callers preserved).
-- SECURITY DEFINER; service_role only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ghc_activity_stage_reward(
  p_user_id text,
  p_base_amount numeric,
  p_day_key text,
  p_week_key text,
  p_daily_cap numeric,
  p_weekly_cap numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL,
  p_daily_limit integer DEFAULT NULL,
  p_cooldown_ms bigint DEFAULT NULL,
  p_max_per_target integer DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_stage_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric := abs(coalesce(p_base_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event text := upper(trim(coalesce(p_source_event, 'SYSTEM')));
  v_target text := nullif(trim(coalesce(p_target_id, '')), '');
  v_day numeric := 0;
  v_week numeric := 0;
  v_room numeric := 0;
  v_grant numeric := 0;
  v_stage numeric := 0;
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
  v_day_key text;
  v_day_count integer := 0;
  v_target_count integer := 0;
  v_last_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_base <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_day_key IS NULL OR length(trim(p_day_key)) = 0
     OR p_week_key IS NULL OR length(trim(p_week_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  -- Serialize stage + emission for this user (same domain family as stage)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_activity:' || p_user_id));

  v_day_key := to_char((v_now AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD');

  -- Already posted earned for this reference → idempotent (no new emission)
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'earned'
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', true,
      'holdId', v_posted.id,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'status', 'posted',
      'granted', 0,
      'emissionConsumed', 0
    );
  END IF;

  -- Existing pending for same reference → idempotent (no new emission)
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'status', 'pending',
      'granted', 0,
      'emissionConsumed', 0,
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'referenceId', v_existing.reference_id,
        'sourceEvent', v_existing.source_event
      )
    );
  END IF;

  -- Cooldown
  IF p_cooldown_ms IS NOT NULL AND p_cooldown_ms > 0 THEN
    SELECT max(created_at) INTO v_last_at
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned');

    IF v_last_at IS NOT NULL
       AND (extract(epoch from (v_now - v_last_at)) * 1000) < p_cooldown_ms THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'COOLDOWN',
        'cooldownMs', p_cooldown_ms,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Daily limit
  IF p_daily_limit IS NOT NULL AND p_daily_limit >= 0 THEN
    SELECT count(*)::integer INTO v_day_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key;

    IF v_day_count >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'DAILY_CAP',
        'dailyLimit', p_daily_limit,
        'dayCount', v_day_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Target cap
  IF p_max_per_target IS NOT NULL AND p_max_per_target >= 0 AND v_target IS NOT NULL THEN
    SELECT count(*)::integer INTO v_target_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key
      AND split_part(coalesce(reference_id, ''), ':', 3) = v_target;

    IF v_target_count >= p_max_per_target THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'TARGET_CAP',
        'maxPerTarget', p_max_per_target,
        'targetCount', v_target_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Emission windows (same semantics as ghc_activity_try_grant)
  SELECT coalesce(amount_ghc, 0) INTO v_day
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'day' AND window_key = p_day_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_day := 0;
  END IF;

  SELECT coalesce(amount_ghc, 0) INTO v_week
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'week' AND window_key = p_week_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_week := 0;
  END IF;

  v_room := least(
    greatest(0, coalesce(p_daily_cap, 0) - v_day),
    greatest(0, coalesce(p_weekly_cap, 0) - v_week)
  );

  IF v_room <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'dayRemaining', 0,
      'weekRemaining', 0,
      'emissionConsumed', 0
    );
  END IF;

  v_grant := least(v_base, v_room);
  IF v_grant <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'emissionConsumed', 0
    );
  END IF;

  -- Stage amount: optional post m×g amount, never above grant
  IF p_stage_amount IS NOT NULL AND p_stage_amount > 0 THEN
    v_stage := least(abs(p_stage_amount), v_grant);
  ELSE
    v_stage := v_grant;
  END IF;

  IF v_stage <> round(v_stage, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION', 'emissionConsumed', 0);
  END IF;

  -- Commit emission windows
  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'week', p_week_key, v_week + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  -- Stage pending reward
  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id,
    'pending',
    v_stage,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    v_event,
    v_ref,
    v_now,
    NULL
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_stage,
    'status', 'pending',
    'granted', v_grant,
    'baseGhc', v_grant,
    'emissionConsumed', v_grant,
    'dayRemaining', greatest(0, coalesce(p_daily_cap, 0) - (v_day + v_grant)),
    'weekRemaining', greatest(0, coalesce(p_weekly_cap, 0) - (v_week + v_grant)),
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_stage,
      'status', 'pending',
      'referenceId', v_ref,
      'sourceEvent', v_event
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) TO service_role;

COMMENT ON FUNCTION public.ghc_activity_stage_reward IS
  'Atomic activity emission grant + pending stage; failed limits consume zero emission.';

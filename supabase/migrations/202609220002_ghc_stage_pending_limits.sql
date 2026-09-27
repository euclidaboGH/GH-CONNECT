-- Extend ghc_stage_pending with durable per-rule limits matching memory-path semantics:
--   dailyLimit  → count of qualifying txs for user+sourceEvent on Africa/Lagos calendar day
--   cooldownMs  → reject if now < last qualifying tx created_at + cooldown
--   maxPerTarget → count same-day txs whose reference_id encodes target as part[2] (split by ':')
-- Additive: REPLACE function only; keeps unique indexes from 20260922_ghc_stage_pending.sql

CREATE OR REPLACE FUNCTION public.ghc_stage_pending(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL,
  p_daily_limit integer DEFAULT NULL,
  p_cooldown_ms bigint DEFAULT NULL,
  p_max_per_target integer DEFAULT NULL,
  p_target_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event text := upper(trim(coalesce(p_source_event, 'SYSTEM')));
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
  v_day_key text;
  v_day_count integer := 0;
  v_target_count integer := 0;
  v_last_at timestamptz;
  v_target text := nullif(trim(coalesce(p_target_id, '')), '');
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Serialize concurrent stage/claim/limit checks for this user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));

  -- Africa/Lagos calendar day (matches lagosDayKey intent used by evaluate)
  v_day_key := to_char((v_now AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD');

  -- Already posted earned for this reference → idempotent
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
      'referenceId', v_ref,
      'status', 'posted'
    );
  END IF;

  -- Existing pending hold for this reference → idempotent
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'referenceId', v_ref,
      'status', 'pending',
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'reason', v_existing.reason,
        'sourceEvent', v_existing.source_event,
        'referenceId', v_existing.reference_id,
        'createdAt', (extract(epoch from v_existing.created_at) * 1000)::bigint
      )
    );
  END IF;

  -- Cooldown: last qualifying event for this source_event (any day)
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
        'lastAt', (extract(epoch from v_last_at) * 1000)::bigint
      );
    END IF;
  END IF;

  -- Daily limit: qualifying txs on Lagos calendar day for this source_event
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
        'dayKey', v_day_key
      );
    END IF;
  END IF;

  -- maxPerTargetPerDay: reference_id parts[2] is target (event:user:target:...)
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
        'targetId', v_target
      );
    END IF;
  END IF;

  v_tx_id := gen_random_uuid();
  INSERT INTO public.ghc_transactions (
    id, user_id, kind, amount, status, reason, source_event, reference_id, metadata, created_at
  ) VALUES (
    v_tx_id,
    p_user_id,
    'pending',
    v_amount,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
    v_ref,
    jsonb_build_object(
      'ruleId', p_rule_id,
      'stagedAt', v_now,
      'targetId', v_target,
      'dayKey', v_day_key
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_amount,
    'referenceId', v_ref,
    'status', 'pending',
    'dayKey', v_day_key,
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_amount,
      'status', 'pending',
      'reason', coalesce(nullif(trim(p_reason), ''), 'Reward'),
      'sourceEvent', coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
      'referenceId', v_ref,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = v_ref
      AND (
        (kind = 'pending' AND status = 'pending')
        OR (kind = 'earned' AND status = 'posted')
      )
      AND amount > 0
    ORDER BY created_at ASC
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'alreadyPosted', (v_existing.kind = 'earned'),
        'holdId', v_existing.id,
        'transactionId', v_existing.id,
        'amount', v_existing.amount,
        'referenceId', v_ref,
        'status', v_existing.status
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
  WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

-- Drop old 6-arg overload if present so only limit-aware signature remains callable
DROP FUNCTION IF EXISTS public.ghc_stage_pending(text, numeric, text, text, text, text);

REVOKE ALL ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) TO service_role;

COMMENT ON FUNCTION public.ghc_stage_pending IS
  'Stage pending GHC reward with atomic dailyLimit/cooldown/maxPerTarget checks. service_role only. Idempotent on (user_id, reference_id).';

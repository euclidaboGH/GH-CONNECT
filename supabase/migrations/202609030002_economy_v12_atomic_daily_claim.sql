-- ECONOMY_VERSION 1.2 — atomic daily claim (streak + ledger) in one transaction
-- Additive only. Does not rewrite historical ledger rows or balances.

-- Idempotent earned credits per user+reference (covers daily claim keys)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_earned_posted_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'earned' AND status = 'posted' AND reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Atomic daily claim: validate day lock + insert ledger legs + commit streak
-- Amounts are computed server-side in the app and passed in; RPC enforces
-- positivity, 80/20 consistency (within 0.0001), and exactly-once identity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_execute_daily_claim_v12(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day int,
  p_completed_cycles int,
  p_idempotency_key text,
  p_gross_amount numeric,
  p_user_amount numeric,
  p_reserve_amount numeric,
  p_base_gross numeric,
  p_m numeric,
  p_g numeric,
  p_economic_version text DEFAULT '1.2',
  p_missed_day_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak public.ghc_claim_streak_state%ROWTYPE;
  v_user_tx public.ghc_transactions%ROWTYPE;
  v_rsv_tx public.ghc_transactions%ROWTYPE;
  v_user_id uuid;
  v_rsv_id uuid;
  v_reserve_user text := '__PROTOCOL_RESERVE__';
  v_rsv_ref text;
  v_total int;
  v_meta jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_claim_day_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAY');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_IDEMPOTENCY');
  END IF;
  IF p_cycle_day IS NULL OR p_cycle_day < 1 OR p_cycle_day > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CYCLE_DAY');
  END IF;
  IF p_user_amount IS NULL OR p_user_amount <= 0 OR p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_reserve_amount IS NULL OR p_reserve_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RESERVE');
  END IF;
  -- 80/20 integrity: user + reserve must equal gross within 0.0001
  IF abs((p_user_amount + p_reserve_amount) - p_gross_amount) > 0.0001 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SPLIT_MISMATCH');
  END IF;
  IF abs(p_user_amount - (p_gross_amount * 0.8)) > 0.0002 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_SHARE_MISMATCH');
  END IF;

  v_rsv_ref := p_idempotency_key || ':reserve';
  v_meta := jsonb_build_object(
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'claimDayKey', p_claim_day_key,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'baseGross', p_base_gross,
    'gross', p_gross_amount,
    'userAmount', p_user_amount,
    'reserveAmount', p_reserve_amount,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'claimKind', 'DAILY_CLAIM_V12'
  );

  -- Lock streak row (create empty shell if missing so concurrent claims serialize)
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (
    p_user_id, 0, 0, NULL, 0, COALESCE(p_economic_version, '1.2'), NULL, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Already claimed same day or same idempotency key → return existing ledger rows
  IF (v_streak.last_idempotency_key IS NOT NULL AND v_streak.last_idempotency_key = p_idempotency_key)
     OR (v_streak.last_claim_day_key IS NOT NULL AND v_streak.last_claim_day_key = p_claim_day_key) THEN
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = COALESCE(v_streak.last_idempotency_key, p_idempotency_key)
      AND kind = 'earned'
      AND status = 'posted'
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_user_tx
      FROM public.ghc_transactions
      WHERE user_id = p_user_id
        AND reference_id = p_idempotency_key
        AND kind = 'earned'
        AND status = 'posted'
      LIMIT 1;
    END IF;

    SELECT * INTO v_rsv_tx
    FROM public.ghc_transactions
    WHERE user_id = v_reserve_user
      AND reference_id = COALESCE(v_user_tx.reference_id, p_idempotency_key) || ':reserve'
      AND kind = 'earned'
      AND status = 'posted'
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', v_streak.cycle_day,
      'completedCycles', v_streak.completed_cycles,
      'lastClaimDayKey', v_streak.last_claim_day_key,
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'reserveAmount', COALESCE(v_rsv_tx.amount, p_reserve_amount),
      'grossAmount', COALESCE((v_user_tx.metadata->>'gross')::numeric, p_gross_amount),
      'transactionId', v_user_tx.id,
      'reserveTransactionId', v_rsv_tx.id,
      'referenceId', COALESCE(v_user_tx.reference_id, p_idempotency_key),
      'm', COALESCE((v_user_tx.metadata->>'m')::numeric, p_m),
      'g', COALESCE((v_user_tx.metadata->>'g')::numeric, p_g),
      'economicVersion', COALESCE(v_user_tx.metadata->>'economicVersion', p_economic_version)
    );
  END IF;

  -- Insert user credit (unique index prevents double mint under race)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      p_user_id,
      'earned',
      p_user_amount,
      'posted',
      format('Daily claim day %s/7 (%s)', p_cycle_day, COALESCE(p_economic_version, '1.2')),
      'DAILY_CLAIM_V12',
      p_idempotency_key,
      v_meta,
      now()
    )
    RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent insert won — treat as idempotent success
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id AND reference_id = p_idempotency_key AND kind = 'earned' AND status = 'posted'
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', COALESCE(v_streak.cycle_day, p_cycle_day),
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'transactionId', v_user_tx.id,
      'referenceId', p_idempotency_key
    );
  END;

  -- Protocol reserve leg (non-spendable system account)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      v_reserve_user,
      'earned',
      p_reserve_amount,
      'posted',
      format('Protocol reserve day %s/7', p_cycle_day),
      'PROTOCOL_RESERVE_V12',
      v_rsv_ref,
      v_meta || jsonb_build_object('forUserId', p_user_id),
      now()
    )
    RETURNING id INTO v_rsv_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_rsv_id FROM public.ghc_transactions
    WHERE user_id = v_reserve_user AND reference_id = v_rsv_ref AND status = 'posted'
    LIMIT 1;
  END;

  -- Commit streak only after ledger legs succeed (same transaction)
  v_total := COALESCE(v_streak.total_successful_claims, 0) + 1;
  UPDATE public.ghc_claim_streak_state
  SET
    cycle_day = p_cycle_day,
    completed_cycles = GREATEST(COALESCE(p_completed_cycles, 0), 0),
    last_claim_day_key = p_claim_day_key,
    total_successful_claims = v_total,
    economic_version = COALESCE(p_economic_version, '1.2'),
    last_idempotency_key = p_idempotency_key,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'idempotent', false,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'lastClaimDayKey', p_claim_day_key,
    'totalSuccessfulClaims', v_total,
    'userAmount', p_user_amount,
    'reserveAmount', p_reserve_amount,
    'grossAmount', p_gross_amount,
    'baseGross', p_base_gross,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'transactionId', v_user_id,
    'reserveTransactionId', v_rsv_id,
    'referenceId', p_idempotency_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v12(
  text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean
) TO service_role;

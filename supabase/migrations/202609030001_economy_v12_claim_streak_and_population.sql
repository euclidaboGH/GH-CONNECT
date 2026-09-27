-- ECONOMY_VERSION 1.2 — additive only (no destructive changes, no ledger rewrites)
-- Claim/streak authoritative state + economic population metrics support

-- ---------------------------------------------------------------------------
-- 1. Per-user claim / streak state (authoritative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_claim_streak_state (
  user_id                  text PRIMARY KEY,
  cycle_day                int NOT NULL DEFAULT 0
    CHECK (cycle_day >= 0 AND cycle_day <= 7),
  completed_cycles         int NOT NULL DEFAULT 0
    CHECK (completed_cycles >= 0),
  last_claim_day_key       date,
  total_successful_claims  int NOT NULL DEFAULT 0
    CHECK (total_successful_claims >= 0),
  economic_version         text NOT NULL DEFAULT '1.2',
  last_idempotency_key     text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_claim_streak_idempotency
  ON public.ghc_claim_streak_state (last_idempotency_key)
  WHERE last_idempotency_key IS NOT NULL;

ALTER TABLE public.ghc_claim_streak_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_claim_streak_state_no_client ON public.ghc_claim_streak_state;
CREATE POLICY ghc_claim_streak_state_no_client ON public.ghc_claim_streak_state
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. Economic eligibility flags (additive; defaults keep users eligible)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_user_economic_status (
  user_id                  text PRIMARY KEY,
  is_verified              boolean NOT NULL DEFAULT true,
  is_suspended             boolean NOT NULL DEFAULT false,
  is_suspected_duplicate   boolean NOT NULL DEFAULT false,
  last_active_at           timestamptz,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghc_user_economic_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_user_economic_status_no_client ON public.ghc_user_economic_status;
CREATE POLICY ghc_user_economic_status_no_client ON public.ghc_user_economic_status
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. Population stats (service-role / security definer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_economic_population_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered bigint := 0;
  v_verified bigint := 0;
  v_eligible bigint := 0;
  v_active bigint := 0;
  v_suspended bigint := 0;
  v_dupes bigint := 0;
BEGIN
  -- registered: known account anchors
  SELECT COUNT(*) INTO v_registered FROM public.ghc_user_accounts;

  -- verified: public identity present OR explicit verified flag
  SELECT COUNT(*) INTO v_verified
  FROM (
    SELECT user_id FROM public.ghc_public_identities
    UNION
    SELECT user_id FROM public.ghc_user_economic_status WHERE is_verified = true
  ) v;

  SELECT COUNT(*) INTO v_suspended
  FROM public.ghc_user_economic_status WHERE is_suspended = true;

  SELECT COUNT(*) INTO v_dupes
  FROM public.ghc_user_economic_status WHERE is_suspected_duplicate = true;

  -- eligibleEconomicUsers: public identity, not suspended, not suspected duplicate
  SELECT COUNT(*) INTO v_eligible
  FROM public.ghc_public_identities p
  LEFT JOIN public.ghc_user_economic_status s ON s.user_id = p.user_id
  WHERE COALESCE(s.is_suspended, false) = false
    AND COALESCE(s.is_suspected_duplicate, false) = false;

  -- active: eligible with activity in last 90 days (status) OR any claim streak row
  SELECT COUNT(*) INTO v_active
  FROM public.ghc_public_identities p
  LEFT JOIN public.ghc_user_economic_status s ON s.user_id = p.user_id
  LEFT JOIN public.ghc_claim_streak_state c ON c.user_id = p.user_id
  WHERE COALESCE(s.is_suspended, false) = false
    AND COALESCE(s.is_suspected_duplicate, false) = false
    AND (
      s.last_active_at IS NOT NULL AND s.last_active_at > now() - interval '90 days'
      OR c.last_claim_day_key IS NOT NULL
      OR c.total_successful_claims > 0
    );

  -- Floor at 1 so early network m stays defined
  IF v_eligible < 1 THEN
    v_eligible := 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registeredUsers', v_registered,
    'verifiedUsers', v_verified,
    'eligibleEconomicUsers', v_eligible,
    'activeEconomicUsers', v_active,
    'suspendedUsers', v_suspended,
    'suspectedDuplicateUsers', v_dupes
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Get claim streak (service-role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_get_claim_streak(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_claim_streak_state%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT * INTO v_row FROM public.ghc_claim_streak_state WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'userId', p_user_id,
      'cycleDay', 0,
      'completedCycles', 0,
      'lastClaimDayKey', NULL,
      'totalSuccessfulClaims', 0,
      'economicVersion', '1.2',
      'lastIdempotencyKey', NULL,
      'exists', false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_row.user_id,
    'cycleDay', v_row.cycle_day,
    'completedCycles', v_row.completed_cycles,
    'lastClaimDayKey', v_row.last_claim_day_key,
    'totalSuccessfulClaims', v_row.total_successful_claims,
    'economicVersion', v_row.economic_version,
    'lastIdempotencyKey', v_row.last_idempotency_key,
    'exists', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Atomic claim-day commit (idempotent, concurrent-safe)
--    Does NOT write ledger amounts — only streak authority + day lock.
--    Returns alreadyClaimed if same calendar day already committed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_commit_claim_day(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day int,
  p_completed_cycles int,
  p_idempotency_key text,
  p_economic_version text DEFAULT '1.2'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_claim_streak_state%ROWTYPE;
  v_total int;
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

  -- Lock existing row if any
  SELECT * INTO v_row
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- Idempotent: same key
    IF v_row.last_idempotency_key IS NOT NULL
       AND v_row.last_idempotency_key = p_idempotency_key THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'idempotent', true,
        'cycleDay', v_row.cycle_day,
        'completedCycles', v_row.completed_cycles,
        'lastClaimDayKey', v_row.last_claim_day_key
      );
    END IF;

    -- Same day already claimed with different key
    IF v_row.last_claim_day_key IS NOT NULL
       AND v_row.last_claim_day_key = p_claim_day_key THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'idempotent', true,
        'cycleDay', v_row.cycle_day,
        'completedCycles', v_row.completed_cycles,
        'lastClaimDayKey', v_row.last_claim_day_key
      );
    END IF;

    v_total := v_row.total_successful_claims + 1;
    UPDATE public.ghc_claim_streak_state
    SET
      cycle_day = p_cycle_day,
      completed_cycles = GREATEST(p_completed_cycles, 0),
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
      'completedCycles', GREATEST(p_completed_cycles, 0),
      'lastClaimDayKey', p_claim_day_key,
      'totalSuccessfulClaims', v_total
    );
  END IF;

  -- Insert new row; unique day enforced by later checks
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (
    p_user_id, p_cycle_day, GREATEST(p_completed_cycles, 0), p_claim_day_key,
    1, COALESCE(p_economic_version, '1.2'), p_idempotency_key, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Re-read under race
  SELECT * INTO v_row
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_row.last_idempotency_key = p_idempotency_key
     OR v_row.last_claim_day_key = p_claim_day_key THEN
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', v_row.last_idempotency_key <> p_idempotency_key
        AND v_row.last_claim_day_key = p_claim_day_key,
      'idempotent', true,
      'cycleDay', v_row.cycle_day,
      'completedCycles', v_row.completed_cycles,
      'lastClaimDayKey', v_row.last_claim_day_key,
      'totalSuccessfulClaims', v_row.total_successful_claims
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'idempotent', false,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(p_completed_cycles, 0),
    'lastClaimDayKey', p_claim_day_key,
    'totalSuccessfulClaims', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_economic_population_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_get_claim_streak(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) TO service_role;

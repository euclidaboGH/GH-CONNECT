-- REVIEW_REQUIRED — Run #246 repair for payout lookup permissions and PIN recovery persistence.
-- This migration is additive and does not execute payouts or release reservations.
-- It deliberately keeps direct service_role access to the payout request table revoked.
BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

-- Keep PIN storage compatible with canonical GreenHaven/Pi identities (text IDs).
CREATE TABLE IF NOT EXISTS public.gh_withdrawal_pins (
  user_id text PRIMARY KEY,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  reset_cooldown_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_withdrawal_pins
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_salt text,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reset_cooldown_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove only the legacy auth.users FK on user_id before ensuring text identity storage.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT DISTINCT con.conname
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
     WHERE con.conrelid = 'public.gh_withdrawal_pins'::regclass
       AND con.contype = 'f'
       AND con.confrelid = to_regclass('auth.users')
       AND a.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.gh_withdrawal_pins DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='gh_withdrawal_pins'
       AND column_name='user_id' AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.gh_withdrawal_pins ALTER COLUMN user_id TYPE text USING user_id::text;
  END IF;
END $$;

ALTER TABLE public.gh_withdrawal_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_withdrawal_pins_deny_all ON public.gh_withdrawal_pins;
CREATE POLICY gh_withdrawal_pins_deny_all ON public.gh_withdrawal_pins
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_withdrawal_pins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_withdrawal_pins TO service_role;

-- Recovery answers are only accessed through narrow SECURITY DEFINER RPCs below.
CREATE TABLE IF NOT EXISTS public.gh_withdrawal_pin_recovery (
  user_id text PRIMARY KEY,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) = 3),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 50),
  locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_withdrawal_pin_recovery
  ADD COLUMN IF NOT EXISTS answers jsonb,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.gh_withdrawal_pin_recovery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_withdrawal_pin_recovery_deny_all ON public.gh_withdrawal_pin_recovery;
CREATE POLICY gh_withdrawal_pin_recovery_deny_all ON public.gh_withdrawal_pin_recovery
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_withdrawal_pin_recovery FROM PUBLIC, anon, authenticated, service_role;

-- The worker can read only the request belonging to the authenticated user.
-- No direct SELECT grant is restored on gh_pi_earnings_payout_requests.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_get_owned(p_request_id uuid, p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  SELECT * INTO v
    FROM public.gh_pi_earnings_payout_requests
   WHERE id = p_request_id AND user_id = trim(p_user_id)
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', v.id::text,
      'user_id', v.user_id,
      'gross_atomic', v.gross_atomic::text,
      'fee_atomic', v.fee_atomic::text,
      'net_atomic', v.net_atomic::text,
      'recipient_pi_app_uid', v.recipient_pi_app_uid,
      'network', v.network,
      'status', v.status,
      'provider_payment_id', v.provider_payment_id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_get_owned(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_get_owned(uuid, text) TO service_role;

-- Read recovery state without exposing table-level SELECT to the service key.
CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_recovery_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v public.gh_withdrawal_pin_recovery%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  SELECT * INTO v FROM public.gh_withdrawal_pin_recovery WHERE user_id = trim(p_user_id);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'configured', false); END IF;
  RETURN jsonb_build_object('ok', true, 'configured', true,
    'answers', v.answers, 'failed_attempts', v.failed_attempts, 'locked_until', v.locked_until);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_recovery_get(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_recovery_get(text) TO service_role;

-- Insert-only setup. The database independently checks distinct question IDs and hash formats.
CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_recovery_setup(p_user_id text, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_inserted integer;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160
     OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_INPUT_INVALID');
  END IF;
  IF jsonb_array_length(p_answers) <> 3
     OR (SELECT count(DISTINCT (e.value->>'qid')) FROM jsonb_array_elements(p_answers) AS e(value)) <> 3
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_answers) AS e(value)
        WHERE COALESCE(e.value->>'qid','') !~ '^[a-z_]{2,40}$'
           OR COALESCE(e.value->>'salt','') !~ '^[0-9a-f]{32}$'
           OR COALESCE(e.value->>'hash','') !~ '^[0-9a-f]{64}$'
     ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_INPUT_INVALID');
  END IF;
  INSERT INTO public.gh_withdrawal_pin_recovery(user_id, answers)
  VALUES (trim(p_user_id), p_answers)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_ALREADY_CONFIGURED'); END IF;
  RETURN jsonb_build_object('ok', true, 'configured', true);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_recovery_setup(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_recovery_setup(text, jsonb) TO service_role;

-- Failed attempts are incremented under a row lock; concurrent failures cannot overwrite each other.
CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_recovery_record_failure(
  p_user_id text, p_max_attempts integer DEFAULT 5, p_lock_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v public.gh_withdrawal_pin_recovery%ROWTYPE; v_attempts integer; v_locked timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160
     OR COALESCE(p_max_attempts, 0) NOT BETWEEN 2 AND 10 OR COALESCE(p_lock_seconds, 0) NOT BETWEEN 60 AND 3600 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  SELECT * INTO v FROM public.gh_withdrawal_pin_recovery WHERE user_id = trim(p_user_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_NOT_CONFIGURED'); END IF;
  IF v.locked_until IS NOT NULL AND v.locked_until > now() THEN
    RETURN jsonb_build_object('ok', true, 'locked', true, 'locked_until', v.locked_until,
      'failed_attempts', v.failed_attempts);
  END IF;
  v_attempts := LEAST(CASE WHEN v.locked_until IS NOT NULL AND v.locked_until <= now() THEN 0 ELSE COALESCE(v.failed_attempts,0) END + 1, COALESCE(p_max_attempts, 5));
  v_locked := CASE WHEN v_attempts >= p_max_attempts THEN now() + make_interval(secs => COALESCE(p_lock_seconds, 900)) ELSE NULL END;
  UPDATE public.gh_withdrawal_pin_recovery
     SET failed_attempts = v_attempts, locked_until = v_locked, updated_at = now()
   WHERE user_id = trim(p_user_id);
  RETURN jsonb_build_object('ok', true, 'locked', v_locked IS NOT NULL,
    'locked_until', v_locked, 'failed_attempts', v_attempts);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_recovery_record_failure(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_recovery_record_failure(text, integer, integer) TO service_role;

-- PIN replacement and recovery-counter reset commit together; a failed PIN update cannot clear the lock.
CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(
  p_user_id text, p_pin_hash text, p_pin_salt text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user text;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160
     OR COALESCE(p_pin_hash,'') !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_pin_salt,'') !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  PERFORM 1 FROM public.gh_withdrawal_pin_recovery
   WHERE user_id = trim(p_user_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_NOT_CONFIGURED'); END IF;
  UPDATE public.gh_withdrawal_pins
     SET pin_hash = p_pin_hash, pin_salt = p_pin_salt,
         failed_attempts = 0, locked_until = NULL,
         reset_cooldown_until = now() + interval '24 hours', updated_at = now()
   WHERE user_id = trim(p_user_id)
   RETURNING user_id INTO v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PIN_NOT_CONFIGURED'); END IF;
  UPDATE public.gh_withdrawal_pin_recovery
     SET failed_attempts = 0, locked_until = NULL, updated_at = now()
   WHERE user_id = trim(p_user_id);
  RETURN jsonb_build_object('ok', true, 'reset_cooldown_hours', 24);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(text, text, text) TO service_role;

-- Do not restore table-level payout access. All worker access is through ownership-bound RPCs.
REVOKE ALL ON TABLE public.gh_pi_earnings_payout_requests FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

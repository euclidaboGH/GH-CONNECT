-- REVIEW_REQUIRED — Wallet security hardening (apply after 20261105200001 and 20261107120001).
-- 1) gh_withdrawal_pins.user_id: app user ids are text and Pi-auth users are not guaranteed to exist in
--    auth.users, so the uuid FK can make PIN creation fail. Convert to text, drop FK.
-- 2) Atomic PIN attempt accounting (row lock) so parallel guesses cannot exceed the attempt limit.
-- 3) Post-recovery cooldown column.
-- 4) Self-service release of payout reservations that never started execution.
BEGIN;

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gh_withdrawal_pins'::regclass AND contype = 'f' LOOP
    EXECUTE format('ALTER TABLE public.gh_withdrawal_pins DROP CONSTRAINT %I', c);
  END LOOP;
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gh_withdrawal_pin_recovery'::regclass AND contype = 'f' LOOP
    EXECUTE format('ALTER TABLE public.gh_withdrawal_pin_recovery DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.gh_withdrawal_pins ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.gh_withdrawal_pin_recovery ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.gh_withdrawal_pins ADD COLUMN IF NOT EXISTS reset_cooldown_until timestamptz NULL;

-- Counts the attempt BEFORE the hash is compared; returns hash material only if not locked/cooling down.
CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_begin_attempt(
  p_user_id text, p_max_attempts integer DEFAULT 5, p_lock_seconds integer DEFAULT 900
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r public.gh_withdrawal_pins%ROWTYPE; v_n integer; v_lock timestamptz;
BEGIN
  SELECT * INTO r FROM public.gh_withdrawal_pins WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'PIN_NOT_CONFIGURED'); END IF;
  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_LOCKED', 'until', r.locked_until);
  END IF;
  IF r.reset_cooldown_until IS NOT NULL AND r.reset_cooldown_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_COOLDOWN', 'until', r.reset_cooldown_until);
  END IF;
  v_n := COALESCE(r.failed_attempts, 0) + 1;
  v_lock := CASE WHEN v_n >= p_max_attempts THEN now() + make_interval(secs => p_lock_seconds) ELSE NULL END;
  UPDATE public.gh_withdrawal_pins
     SET failed_attempts = LEAST(v_n, p_max_attempts), locked_until = v_lock, updated_at = now()
   WHERE user_id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'pinHash', r.pin_hash, 'pinSalt', r.pin_salt, 'attempts', v_n);
END $$;

CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_attempt_succeeded(p_user_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  UPDATE public.gh_withdrawal_pins SET failed_attempts = 0, locked_until = NULL, updated_at = now()
   WHERE user_id = p_user_id;
$$;

-- Releases ONLY reservations that never reached the provider (same criteria as the operator script).
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user text := NULLIF(trim(COALESCE(p_user_id,'')), ''); v_row record; v_rel jsonb;
        v_count integer := 0; v_total numeric(38,0) := 0;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT'); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pi_earnings_payout:'||v_user,0));
  FOR v_row IN
    SELECT id, gross_atomic FROM public.gh_pi_earnings_payout_requests
     WHERE user_id = v_user AND status = 'reserved' AND network = 'Pi Testnet'
       AND provider_payment_id IS NULL AND provider_txid IS NULL
       AND execution_started_at IS NULL AND execution_lease_token IS NULL
       AND COALESCE(execution_attempts, 0) = 0
     ORDER BY created_at FOR UPDATE
  LOOP
    v_rel := public.gh_earnings_release_reserve(v_user, v_row.gross_atomic,
      'pi_earnings_payout:release:' || v_row.id::text, v_row.id::text, 'Unstarted payout request cancelled by user');
    IF COALESCE((v_rel->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Release failed for %: %', v_row.id, COALESCE(v_rel->>'error','UNKNOWN');
    END IF;
    UPDATE public.gh_pi_earnings_payout_requests
       SET status = 'released', failure_code = 'CANCELLED_BY_USER_UNSTARTED', updated_at = now() WHERE id = v_row.id;
    v_count := v_count + 1; v_total := v_total + v_row.gross_atomic;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'released', v_count, 'releasedAtomic', v_total);
END $$;

REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_begin_attempt(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_attempt_succeeded(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_begin_attempt(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_attempt_succeeded(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) TO service_role;
COMMIT;

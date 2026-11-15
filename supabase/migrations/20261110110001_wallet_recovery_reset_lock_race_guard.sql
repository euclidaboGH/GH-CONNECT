-- REVIEW_REQUIRED — Run #249 closes a race between failed recovery attempts and PIN reset.
-- Additive function replacement only; no user rows are changed by applying this migration.
-- Requires 20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(
  p_user_id text, p_pin_hash text, p_pin_salt text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_recovery public.gh_withdrawal_pin_recovery%ROWTYPE;
  v_pin public.gh_withdrawal_pins%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 160
     OR COALESCE(p_pin_hash,'') !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_pin_salt,'') !~ '^[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Re-check the recovery lock while holding the same row lock used by failed attempts.
  SELECT * INTO v_recovery
    FROM public.gh_withdrawal_pin_recovery
   WHERE user_id = trim(p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_NOT_CONFIGURED');
  END IF;
  IF v_recovery.locked_until IS NOT NULL AND v_recovery.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECOVERY_LOCKED', 'until', v_recovery.locked_until);
  END IF;

  -- Lock the PIN row and refuse to extend an already-active post-reset cooldown.
  SELECT * INTO v_pin
    FROM public.gh_withdrawal_pins
   WHERE user_id = trim(p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_NOT_CONFIGURED');
  END IF;
  IF v_pin.reset_cooldown_until IS NOT NULL AND v_pin.reset_cooldown_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_COOLDOWN', 'until', v_pin.reset_cooldown_until);
  END IF;

  UPDATE public.gh_withdrawal_pins
     SET pin_hash = p_pin_hash,
         pin_salt = p_pin_salt,
         failed_attempts = 0,
         locked_until = NULL,
         reset_cooldown_until = now() + interval '24 hours',
         updated_at = now()
   WHERE user_id = trim(p_user_id);

  UPDATE public.gh_withdrawal_pin_recovery
     SET failed_attempts = 0,
         locked_until = NULL,
         updated_at = now()
   WHERE user_id = trim(p_user_id);

  RETURN jsonb_build_object('ok', true, 'reset_cooldown_hours', 24);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_recovery_reset_pin(text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

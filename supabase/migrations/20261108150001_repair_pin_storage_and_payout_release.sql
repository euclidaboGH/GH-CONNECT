-- REVIEW_REQUIRED — Repair: withdrawal-PIN storage + self-service payout release (idempotent, additive).
--
-- Why this exists: databases that did not receive 20261107130001 / 20261108110001 failed in production with
--   (a) "We couldn't save your PIN right now": gh_withdrawal_pins.user_id was uuid REFERENCES auth.users(id), but
--       Pi-authenticated app users are not guaranteed to exist in auth.users, so the first-PIN insert was rejected.
--   (b) "Couldn't verify the reservation state": RPC gh_pi_earnings_payout_cancel_unstarted did not exist, so
--       unstarted Pi payout reservations (status 'reserved', no provider ids, 0 execution attempts) could not be released.
-- This migration is safe to run on a fresh database, on a database that already has the earlier migrations, and
-- more than once. It supersedes the older cancel function in 20261107130001 with the Phase 3 version (explicit
-- reasons per active request) and never force-releases processing / uncertain / started requests.
-- Requires the payout request table and authoritative reserve-release RPC from
-- 20261030010002 and 20261105170001, plus PIN foundations from 20261105200001
-- and 20261107120001. Apply after 20261107130001 and 20261108110001 because
-- this migration deliberately supersedes their earlier RPC definitions.
-- Validate on a disposable PostgreSQL database before any Testnet deployment.
BEGIN;

-- 1) PIN tables: app user ids are text; drop uuid FK to auth.users.
DO $$
DECLARE
  v_table regclass;
  v_constraint record;
  v_table_name text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    to_regclass('public.gh_withdrawal_pins'),
    to_regclass('public.gh_withdrawal_pin_recovery')
  ] LOOP
    IF v_table IS NULL THEN
      CONTINUE;
    END IF;

    -- Only the legacy app-user FK to auth.users is incompatible with Pi-auth
    -- identities. Do not remove unrelated foreign keys from either table.
    FOR v_constraint IN
      SELECT DISTINCT c.conname
      FROM pg_catalog.pg_constraint AS c
      JOIN pg_catalog.pg_attribute AS a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = v_table
        AND c.contype = 'f'
        AND c.confrelid = to_regclass('auth.users')
        AND a.attname = 'user_id'
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_table, v_constraint.conname);
    END LOOP;

    SELECT c.relname INTO v_table_name
    FROM pg_catalog.pg_class AS c
    WHERE c.oid = v_table;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table_name
        AND column_name = 'user_id' AND data_type <> 'text'
    ) THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN user_id TYPE text USING user_id::text', v_table);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.gh_withdrawal_pins') IS NOT NULL THEN
    ALTER TABLE public.gh_withdrawal_pins ADD COLUMN IF NOT EXISTS reset_cooldown_until timestamptz NULL;
  END IF;
END $$;

-- 2) Atomic PIN attempt accounting (requires gh_withdrawal_pins from 20261105200001).
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

REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_begin_attempt(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_withdrawal_pin_attempt_succeeded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_begin_attempt(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_withdrawal_pin_attempt_succeeded(text) TO service_role;

-- 3) Self-service release of unstarted Pi Testnet payout reservations (Phase 3 version).
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_row public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_rel jsonb;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_total numeric(38,0) := 0;
  v_reason text;
  v_unlock text;
  v_result_status text;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Serialize against both request creation and worker execution for this account.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pi_earnings_payout:' || v_user, 0)
  );

  FOR v_row IN
    SELECT *
      FROM public.gh_pi_earnings_payout_requests
     WHERE user_id = v_user
       AND network = 'Pi Testnet'
       AND status IN ('reserved', 'processing', 'uncertain')
     ORDER BY created_at
     FOR UPDATE
  LOOP
    IF v_row.status = 'reserved'
       AND v_row.provider_payment_id IS NULL
       AND v_row.provider_txid IS NULL
       AND v_row.execution_started_at IS NULL
       AND v_row.execution_lease_token IS NULL
       AND COALESCE(v_row.execution_attempts, 0) = 0 THEN
      v_rel := public.gh_earnings_release_reserve(
        v_user,
        v_row.gross_atomic,
        'pi_earnings_payout:release:' || v_row.id::text,
        v_row.id::text,
        'Unstarted payout request safely released by account holder'
      );
      IF COALESCE((v_rel->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Release failed for %: %', v_row.id, COALESCE(v_rel->>'error', 'UNKNOWN');
      END IF;
      UPDATE public.gh_pi_earnings_payout_requests
         SET status = 'released',
             failure_code = 'CANCELLED_BY_USER_UNSTARTED',
             updated_at = now()
       WHERE id = v_row.id;
      v_count := v_count + 1;
      v_total := v_total + v_row.gross_atomic;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'requestId', v_row.id,
        'status', 'released',
        'grossAtomic', v_row.gross_atomic,
        'reasonCode', 'UNSTARTED_REQUEST_CANCELLED',
        'reason', 'The withdrawal request had not started Pi provider execution.',
        'unlockCondition', 'The reserved amount has been returned to Available.'
      ));
    ELSE
      v_result_status := v_row.status;
      IF v_row.status = 'uncertain' THEN
        v_reason := 'PROVIDER_OUTCOME_UNKNOWN';
        v_unlock := 'The server must look up the exact Pi Testnet payment. Funds unlock only after Pi confirms cancellation and no transaction; a verified payment settles the request instead.';
      ELSIF v_row.status = 'processing' THEN
        v_reason := 'PROVIDER_EXECUTION_IN_PROGRESS';
        v_unlock := 'Wait for the worker to verify the Pi receipt. If Pi authoritatively confirms cancellation with no transaction, the server releases the reservation.';
      ELSE
        v_reason := 'EXECUTION_ALREADY_STARTED';
        v_unlock := 'The server must reconcile the provider payment first. A verified payment settles the request; an authoritative cancellation with no transaction releases it.';
      END IF;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'requestId', v_row.id,
        'status', v_result_status,
        'grossAtomic', v_row.gross_atomic,
        'reasonCode', v_reason,
        'reason', CASE v_reason
          WHEN 'PROVIDER_OUTCOME_UNKNOWN' THEN 'Pi has not yet provided a conclusive payment outcome.'
          WHEN 'PROVIDER_EXECUTION_IN_PROGRESS' THEN 'The payout worker has started processing this request.'
          ELSE 'Provider execution has started, so a self-service cancellation cannot safely release it.'
        END,
        'unlockCondition', v_unlock
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'released', v_count,
    'releasedAtomic', v_total,
    'items', v_items,
    'message', CASE WHEN v_count > 0
      THEN 'Eligible unstarted reservations were returned to Available. Other requests remain protected until their Pi outcome is verified.'
      ELSE 'No unstarted reservations were eligible for release. Any active reservations are explained below.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) TO service_role;
COMMENT ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) IS
  'Self-service recovery: releases only provably unstarted Pi Testnet reservations and returns explicit reasons/unlock conditions for active requests.';

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_cancel_unstarted(text) TO service_role;

COMMIT;

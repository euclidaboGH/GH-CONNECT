-- Phase 2 completion: self-service payout consent is explicit-user-only.
-- Additive migration; do not edit the already-applied historical migration.
-- Serializes grants for the same GH account / Pi UID to avoid concurrent
-- supersede-and-insert races against the partial unique indexes.

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_grant(
  p_user_id text,
  p_pi_app_uid text,
  p_source text DEFAULT 'user_explicit'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_uid text := NULLIF(trim(COALESCE(p_pi_app_uid, '')), '');
  v_source text := COALESCE(NULLIF(trim(COALESCE(p_source, '')), ''), 'user_explicit');
  v_map public.gh_pi_identities%ROWTYPE;
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_user_lock bigint;
  v_uid_lock bigint;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_uid IS NULL OR length(v_uid) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- No auth_bridge or operator path may manufacture user consent.
  IF v_source <> 'user_explicit' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE');
  END IF;

  v_user_lock := hashtextextended('pi-wallet-auth-user:' || v_user, 0);
  v_uid_lock := hashtextextended('pi-wallet-auth-uid:' || v_uid, 0);
  IF v_user_lock < v_uid_lock THEN
    PERFORM pg_advisory_xact_lock(v_user_lock);
    PERFORM pg_advisory_xact_lock(v_uid_lock);
  ELSE
    PERFORM pg_advisory_xact_lock(v_uid_lock);
    PERFORM pg_advisory_xact_lock(v_user_lock);
  END IF;

  SELECT * INTO v_map
    FROM public.gh_pi_identities
    WHERE gh_user_id = v_user AND pi_app_uid = v_uid
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDENTITY_MAPPING_REQUIRED');
  END IF;

  UPDATE public.gh_pi_wallet_authorizations
    SET status = 'superseded',
        revoked_at = COALESCE(revoked_at, now()),
        updated_at = now(),
        revoke_reason = COALESCE(revoke_reason, 'superseded_by_new_consent')
    WHERE status = 'active'
      AND (gh_user_id = v_user OR pi_app_uid = v_uid);

  INSERT INTO public.gh_pi_wallet_authorizations (
    gh_user_id, pi_app_uid, status, consented_at, last_verified_at, consent_source
  ) VALUES (v_user, v_uid, 'active', now(), now(), 'user_explicit')
  RETURNING * INTO v_row;

  INSERT INTO public.gh_pi_identity_link_events (
    gh_user_id, event_type, pi_app_uid, detail
  ) VALUES (v_user, 'consent_granted', v_uid, 'user_explicit');

  RETURN jsonb_build_object(
    'ok', true,
    'authorizationId', v_row.id,
    'ghUserId', v_row.gh_user_id,
    'piAppUid', v_row.pi_app_uid,
    'status', v_row.status,
    'consentedAt', v_row.consented_at,
    'lastVerifiedAt', v_row.last_verified_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_grant(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_grant(text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.gh_pi_wallet_authorization_grant(text, text, text)
  IS 'Phase 2: records only user-explicit Pi payout consent for the current durable identity mapping.';

-- Phase 2: Pi identity wallet authorization + link event audit.
-- Additive only. Service-role RPCs. No client table access.
-- Never store Pi access tokens or wallet seeds.

CREATE TABLE IF NOT EXISTS public.gh_pi_wallet_authorizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id        text NOT NULL,
  pi_app_uid        text NOT NULL,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked', 'superseded')),
  consented_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  last_verified_at  timestamptz NOT NULL DEFAULT now(),
  consent_source    text NOT NULL DEFAULT 'user_explicit'
                    CHECK (consent_source IN ('user_explicit', 'auth_bridge', 'operator')),
  revoke_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pi_wallet_auth_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_pi_wallet_auth_uid_nonempty CHECK (length(trim(pi_app_uid)) > 0),
  CONSTRAINT gh_pi_wallet_auth_revoke_pair CHECK (
    (status = 'active' AND revoked_at IS NULL) OR
    (status <> 'active')
  )
);

-- At most one active authorization per GH user
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_wallet_auth_active_user
  ON public.gh_pi_wallet_authorizations (gh_user_id)
  WHERE status = 'active';

-- At most one active authorization per Pi app uid
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_wallet_auth_active_uid
  ON public.gh_pi_wallet_authorizations (pi_app_uid)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_gh_pi_wallet_auth_user_status
  ON public.gh_pi_wallet_authorizations (gh_user_id, status, updated_at DESC);

ALTER TABLE public.gh_pi_wallet_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_wallet_authorizations_no_client ON public.gh_pi_wallet_authorizations;
CREATE POLICY gh_pi_wallet_authorizations_no_client ON public.gh_pi_wallet_authorizations
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_pi_identity_link_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  event_type      text NOT NULL
                  CHECK (event_type IN (
                    'linked', 'verified', 'consent_granted', 'consent_revoked',
                    'uid_superseded', 'conflict_detected', 'relink_attempt'
                  )),
  pi_app_uid      text,
  prior_pi_app_uid text,
  detail          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pi_link_events_user_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_pi_identity_link_events_user
  ON public.gh_pi_identity_link_events (gh_user_id, created_at DESC);

ALTER TABLE public.gh_pi_identity_link_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_identity_link_events_no_client ON public.gh_pi_identity_link_events;
CREATE POLICY gh_pi_identity_link_events_no_client ON public.gh_pi_identity_link_events
  FOR ALL USING (false) WITH CHECK (false);

-- Grant or refresh active wallet authorization for the verified mapping only.
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
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_uid IS NULL OR length(v_uid) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_source NOT IN ('user_explicit', 'auth_bridge', 'operator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE');
  END IF;

  SELECT * INTO v_map FROM public.gh_pi_identities
    WHERE gh_user_id = v_user AND pi_app_uid = v_uid
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDENTITY_MAPPING_REQUIRED');
  END IF;

  -- Supersede any other active auth for this user or this uid
  UPDATE public.gh_pi_wallet_authorizations
    SET status = 'superseded', revoked_at = COALESCE(revoked_at, now()), updated_at = now(),
        revoke_reason = COALESCE(revoke_reason, 'superseded_by_new_consent')
    WHERE status = 'active' AND (gh_user_id = v_user OR pi_app_uid = v_uid);

  INSERT INTO public.gh_pi_wallet_authorizations (
    gh_user_id, pi_app_uid, status, consented_at, last_verified_at, consent_source
  ) VALUES (v_user, v_uid, 'active', now(), now(), v_source)
  RETURNING * INTO v_row;

  INSERT INTO public.gh_pi_identity_link_events (gh_user_id, event_type, pi_app_uid, detail)
  VALUES (v_user, 'consent_granted', v_uid, v_source);

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

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_revoke(
  p_user_id text,
  p_reason text DEFAULT 'user_revoked'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_reason text := left(COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'user_revoked'), 120);
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  UPDATE public.gh_pi_wallet_authorizations
    SET status = 'revoked', revoked_at = now(), updated_at = now(), revoke_reason = v_reason
    WHERE gh_user_id = v_user AND status = 'active'
    RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'revoked', false, 'error', 'NO_ACTIVE_AUTHORIZATION');
  END IF;

  INSERT INTO public.gh_pi_identity_link_events (gh_user_id, event_type, pi_app_uid, detail)
  VALUES (v_user, 'consent_revoked', v_row.pi_app_uid, v_reason);

  RETURN jsonb_build_object(
    'ok', true,
    'revoked', true,
    'authorizationId', v_row.id,
    'piAppUid', v_row.pi_app_uid,
    'status', 'revoked'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_get(
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_map public.gh_pi_identities%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id = v_user AND status = 'active'
    ORDER BY consented_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'hasMapping', FOUND OR v_map.pi_app_uid IS NOT NULL,
    'mappedPiAppUid', v_map.pi_app_uid,
    'mappedUsername', v_map.pi_username,
    'authorizationActive', v_row.id IS NOT NULL AND v_row.status = 'active',
    'authorizationId', v_row.id,
    'authorizedPiAppUid', v_row.pi_app_uid,
    'consentedAt', v_row.consented_at,
    'lastVerifiedAt', v_row.last_verified_at,
    'uidMatchesAuthorization',
      (v_row.id IS NOT NULL AND v_map.pi_app_uid IS NOT NULL AND v_row.pi_app_uid = v_map.pi_app_uid)
  );
END;
$$;

-- Payout gate: active authorization must match recipient uid and identity mapping.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_assert_payout(
  p_user_id text,
  p_recipient_uid text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_uid text := NULLIF(trim(COALESCE(p_recipient_uid, '')), '');
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_map public.gh_pi_identities%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_map FROM public.gh_pi_identities
    WHERE gh_user_id = v_user AND pi_app_uid = v_uid LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDENTITY_MAPPING_MISMATCH');
  END IF;

  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id = v_user AND status = 'active' AND pi_app_uid = v_uid
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WALLET_AUTHORIZATION_REQUIRED');
  END IF;

  UPDATE public.gh_pi_wallet_authorizations
    SET last_verified_at = now(), updated_at = now()
    WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'authorizationId', v_row.id,
    'piAppUid', v_row.pi_app_uid,
    'ghUserId', v_user
  );
END;
$$;

REVOKE ALL ON TABLE public.gh_pi_wallet_authorizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gh_pi_identity_link_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_grant(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_revoke(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_grant(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_revoke(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text, text) TO service_role;

COMMENT ON TABLE public.gh_pi_wallet_authorizations IS
  'Phase 2 explicit user consent for A2U payouts to a verified Pi app uid. Not a wallet seed store.';
COMMENT ON TABLE public.gh_pi_identity_link_events IS
  'Append-only audit of Pi identity link and consent lifecycle events.';

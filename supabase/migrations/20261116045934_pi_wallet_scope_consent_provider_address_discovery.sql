-- Run #302 candidate: Pi wallet-address scope consent without a pre-known address.
--
-- Pi's Platform API /v2/me returns the app-specific uid and the granted scopes
-- (credentials.scopes) but NOT the wallet address. The address is surfaced by Pi
-- on the A2U PaymentDTO.to_address after the user has granted the wallet_address
-- scope. The earlier gate required an address before any payout could exist, which
-- made withdrawals unreachable whenever the Pi SDK did not hand the address to the
-- browser.
--
-- This migration lets a payout authorization be active when the server has verified
-- (via /v2/me credentials.scopes) that this user's wallet_address scope was granted
-- for the same server-verified Pi UID. The destination address is then:
--   * adopted from Pi's own PaymentDTO.to_address on the first payout, or
--   * compared with the address already bound (SDK-reported or platform-verified).
-- Funds are only submitted after the provider address is known and valid. A later
-- change in the provider address versus the bound address still blocks and queues review.
--
-- Corrected after security review. Apply as this single migration to Testnet only.
-- Requires 20261110125500 to be applied. Do not apply to Mainnet: payout creation
-- remains explicitly fenced to Pi Testnet until separate Mainnet A2U approval.

ALTER TABLE public.gh_pi_wallet_authorizations
  ADD COLUMN IF NOT EXISTS wallet_scope_verified_at timestamptz;

-- Backfill only records whose stored provenance demonstrates an explicit user
-- consent and a recognized wallet-address source. Do not infer consent from an
-- address alone: operator/bridge/legacy records must re-consent.
UPDATE public.gh_pi_wallet_authorizations
  SET wallet_scope_verified_at = COALESCE(wallet_scope_verified_at, consented_at, now())
  WHERE pi_wallet_address IS NOT NULL
    AND wallet_scope_verified_at IS NULL
    AND consent_source = 'user_explicit'
    AND wallet_address_source IN ('pi_sdk_scope', 'platform_api', 'provider_payment')
    AND pi_wallet_address ~ '^G[A-Z2-7]{55}$';

-- Grant: same 5-argument signature. Blank address + source 'scope_only' records a
-- server-verified wallet_address scope grant with the address still to be confirmed
-- by Pi's A2U PaymentDTO.to_address.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_grant(
  p_user_id text,
  p_pi_app_uid text,
  p_source text,
  p_pi_wallet_address text,
  p_wallet_address_source text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_uid text := NULLIF(trim(COALESCE(p_pi_app_uid, '')), '');
  v_address text := NULLIF(upper(trim(COALESCE(p_pi_wallet_address, ''))), '');
  v_address_source text := NULLIF(trim(COALESCE(p_wallet_address_source, '')), '');
  v_source text := COALESCE(NULLIF(trim(COALESCE(p_source, '')), ''), 'user_explicit');
  v_map public.gh_pi_identities%ROWTYPE;
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_user_lock bigint;
  v_uid_lock bigint;
  v_address_verified_at timestamptz;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_uid IS NULL OR length(v_uid) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_source <> 'user_explicit' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE');
  END IF;
  IF v_address IS NULL THEN
    IF v_address_source IS DISTINCT FROM 'scope_only' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_REQUIRED');
    END IF;
    v_address_source := NULL;
    v_address_verified_at := NULL;
  ELSE
    IF v_address !~ '^G[A-Z2-7]{55}$'
       OR v_address_source IS NULL
       OR v_address_source NOT IN ('pi_sdk_scope','platform_api') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_REQUIRED');
    END IF;
    IF v_address_source='platform_api' THEN v_address_verified_at := now(); ELSE v_address_verified_at := NULL; END IF;
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

  SELECT * INTO v_map FROM public.gh_pi_identities
    WHERE gh_user_id = v_user AND pi_app_uid = v_uid LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDENTITY_MAPPING_REQUIRED');
  END IF;

  UPDATE public.gh_pi_wallet_authorizations
    SET status = 'superseded', revoked_at = COALESCE(revoked_at, now()), updated_at = now(),
        revoke_reason = COALESCE(revoke_reason, 'superseded_by_new_consent')
    WHERE status = 'active' AND (gh_user_id = v_user OR pi_app_uid = v_uid);

  INSERT INTO public.gh_pi_wallet_authorizations (
    gh_user_id, pi_app_uid, pi_wallet_address, wallet_address_source, wallet_address_verified_at,
    wallet_scope_verified_at, status, consented_at, last_verified_at, consent_source
  ) VALUES (
    v_user, v_uid, v_address, v_address_source, v_address_verified_at,
    now(), 'active', now(), now(), 'user_explicit'
  ) RETURNING * INTO v_row;

  INSERT INTO public.gh_pi_identity_link_events (gh_user_id, event_type, pi_app_uid, detail)
  VALUES (v_user, 'consent_granted', v_uid, 'user_explicit_wallet_address_scope');

  RETURN jsonb_build_object(
    'ok', true, 'authorizationId', v_row.id, 'ghUserId', v_row.gh_user_id,
    'piAppUid', v_row.pi_app_uid, 'piWalletAddress', v_row.pi_wallet_address,
    'walletAddressSource', v_row.wallet_address_source,
    'walletAddressVerifiedAt', v_row.wallet_address_verified_at,
    'walletScopeVerifiedAt', v_row.wallet_scope_verified_at,
    'status', v_row.status, 'consentedAt', v_row.consented_at, 'lastVerifiedAt', v_row.last_verified_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_map public.gh_pi_identities%ROWTYPE;
  v_uid_matches boolean := false;
  v_ready boolean := false;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT'); END IF;
  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id = v_user AND status = 'active' ORDER BY consented_at DESC LIMIT 1;
  v_uid_matches := v_row.id IS NOT NULL AND v_map.pi_app_uid IS NOT NULL AND v_row.pi_app_uid = v_map.pi_app_uid;
  -- Ready = server-verified wallet_address scope grant for the mapped UID. The address
  -- itself may still be pending provider confirmation.
  v_ready := v_uid_matches AND v_row.wallet_scope_verified_at IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true, 'hasMapping', v_map.gh_user_id IS NOT NULL,
    'mappedPiAppUid', v_map.pi_app_uid, 'mappedUsername', v_map.pi_username,
    'authorizationActive', v_row.id IS NOT NULL AND v_row.status='active' AND v_ready,
    'authorizationId', v_row.id, 'authorizedPiAppUid', v_row.pi_app_uid,
    'piWalletAddress', CASE WHEN v_uid_matches THEN v_row.pi_wallet_address ELSE NULL END,
    'walletAddressSource', CASE WHEN v_uid_matches THEN v_row.wallet_address_source ELSE NULL END,
    'walletAddressVerifiedAt', CASE WHEN v_uid_matches THEN v_row.wallet_address_verified_at ELSE NULL END,
    'walletAddressVerified', v_uid_matches AND v_row.wallet_address_verified_at IS NOT NULL,
    'walletScopeVerifiedAt', CASE WHEN v_uid_matches THEN v_row.wallet_scope_verified_at ELSE NULL END,
    'walletAddressPending', v_ready AND v_row.pi_wallet_address IS NULL,
    'consentedAt', v_row.consented_at, 'lastVerifiedAt', v_row.last_verified_at,
    'uidMatchesAuthorization', v_uid_matches
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_assert_payout(p_user_id text, p_recipient_uid text)
RETURNS jsonb
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
  IF v_user IS NULL OR v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT'); END IF;
  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id=v_user AND pi_app_uid=v_uid LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'IDENTITY_MAPPING_MISMATCH'); END IF;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id=v_user AND status='active' AND pi_app_uid=v_uid LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'WALLET_AUTHORIZATION_REQUIRED'); END IF;
  IF v_row.wallet_scope_verified_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_VERIFICATION_REQUIRED');
  END IF;
  UPDATE public.gh_pi_wallet_authorizations SET last_verified_at=now(),updated_at=now() WHERE id=v_row.id;
  RETURN jsonb_build_object(
    'ok',true,'authorizationId',v_row.id,'piAppUid',v_row.pi_app_uid,
    'piWalletAddress',v_row.pi_wallet_address,'walletAddressSource',v_row.wallet_address_source,
    'walletAddressVerifiedAt',v_row.wallet_address_verified_at,
    'walletScopeVerifiedAt',v_row.wallet_scope_verified_at,'ghUserId',v_user
  );
END;
$$;

-- First payout for a scope-only authorization: adopt Pi's own PaymentDTO.to_address
-- as the bound address (source provider_payment) and snapshot it onto the request.
-- If an address is already bound, it must match exactly or nothing changes.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(
  p_user_id text, p_pi_app_uid text, p_request_id uuid,
  p_provider_payment_id text, p_provider_to_address text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_uid text := NULLIF(trim(COALESCE(p_pi_app_uid,'')), '');
  v_actual text := upper(trim(COALESCE(p_provider_to_address,'')));
  v_payment_id text := NULLIF(trim(COALESCE(p_provider_payment_id,'')), '');
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_req public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_map public.gh_pi_identities%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_uid IS NULL OR p_request_id IS NULL
     OR v_payment_id IS NULL OR length(v_payment_id) NOT BETWEEN 1 AND 200
     OR v_actual !~ '^G[A-Z2-7]{55}$' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;

  -- The Pi identity must still be the current mapping for this GreenHaven user.
  SELECT * INTO v_map FROM public.gh_pi_identities
    WHERE gh_user_id=v_user AND pi_app_uid=v_uid LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','IDENTITY_MAPPING_MISMATCH');
  END IF;

  -- Address adoption is permitted only for the exact provider payment already
  -- bound to this payout request, on Testnet, while execution is still active.
  SELECT * INTO v_req FROM public.gh_pi_earnings_payout_requests
    WHERE id=p_request_id AND user_id=v_user AND recipient_pi_app_uid=v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v_req.network IS DISTINCT FROM 'Pi Testnet' THEN
    RETURN jsonb_build_object('ok',false,'error','TESTNET_ONLY');
  END IF;
  IF v_req.status NOT IN ('reserved','processing','uncertain') THEN
    RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_EXECUTABLE');
  END IF;
  IF v_req.provider_payment_id IS DISTINCT FROM v_payment_id THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_BINDING_MISMATCH');
  END IF;

  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id=v_user AND pi_app_uid=v_uid AND status='active' LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_row.wallet_scope_verified_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','WALLET_AUTHORIZATION_REQUIRED');
  END IF;
  IF v_row.pi_wallet_address IS NOT NULL AND v_row.pi_wallet_address IS DISTINCT FROM v_actual THEN
    RETURN jsonb_build_object('ok',false,'error','PI_PAYOUT_WALLET_ADDRESS_MISMATCH');
  END IF;
  IF v_req.recipient_wallet_address IS NOT NULL AND v_req.recipient_wallet_address IS DISTINCT FROM v_actual THEN
    RETURN jsonb_build_object('ok',false,'error','PI_PAYOUT_WALLET_ADDRESS_MISMATCH');
  END IF;
  IF v_row.pi_wallet_address IS NULL THEN
    UPDATE public.gh_pi_wallet_authorizations
      SET pi_wallet_address=v_actual,wallet_address_source='provider_payment',wallet_address_verified_at=now(),
          last_verified_at=now(),updated_at=now()
      WHERE id=v_row.id;
  END IF;
  IF v_req.recipient_wallet_address IS NULL THEN
    UPDATE public.gh_pi_earnings_payout_requests SET recipient_wallet_address=v_actual,updated_at=now() WHERE id=v_req.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'walletAddress',v_actual,'walletAddressSource','provider_payment');
END;
$$;

-- Backward-compatible service-only adapter for the currently deployed worker.
-- It never accepts a payment ID from the caller: it reads the already-bound ID
-- from this payout row, then delegates to the strict five-argument implementation.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(
  p_user_id text, p_pi_app_uid text, p_request_id uuid, p_provider_to_address text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment_id text;
BEGIN
  SELECT provider_payment_id INTO v_payment_id
    FROM public.gh_pi_earnings_payout_requests
    WHERE id=p_request_id AND user_id=NULLIF(trim(COALESCE(p_user_id,'')),'')
      AND recipient_pi_app_uid=NULLIF(trim(COALESCE(p_pi_app_uid,'')),'');
  IF v_payment_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_BINDING_MISMATCH');
  END IF;
  RETURN public.gh_pi_wallet_authorization_adopt_provider_address(
    p_user_id,p_pi_app_uid,p_request_id,v_payment_id,p_provider_to_address
  );
END;
$$;

-- Payout creation: a server-verified wallet_address scope grant is sufficient. The
-- destination snapshot may be NULL until Pi returns PaymentDTO.to_address.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_create(
  p_user_id text, p_idempotency_key text, p_request_fingerprint text,
  p_gross_atomic numeric, p_fee_atomic numeric, p_net_atomic numeric,
  p_network text DEFAULT 'Pi Testnet'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_key text := NULLIF(trim(COALESCE(p_idempotency_key,'')), '');
  v_fp text := lower(COALESCE(p_request_fingerprint,''));
  v_map public.gh_pi_identities%ROWTYPE;
  v_auth public.gh_pi_wallet_authorizations%ROWTYPE;
  v_row public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_active public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_reserve jsonb;
BEGIN
  IF v_user IS NULL OR length(v_user)>160 OR v_key IS NULL OR length(v_key)<16 OR length(v_key)>160
     OR v_fp !~ '^[0-9a-f]{64}$' OR p_gross_atomic IS NULL OR p_fee_atomic IS NULL OR p_net_atomic IS NULL
     OR trunc(p_gross_atomic)<>p_gross_atomic OR trunc(p_fee_atomic)<>p_fee_atomic OR trunc(p_net_atomic)<>p_net_atomic
     OR p_gross_atomic<=0 OR p_fee_atomic<0 OR p_net_atomic<=0 OR p_gross_atomic<>p_fee_atomic+p_net_atomic
     OR p_network IS DISTINCT FROM 'Pi Testnet' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pi_earnings_payout:'||v_user,0));
  SELECT * INTO v_row FROM public.gh_pi_earnings_payout_requests WHERE user_id=v_user AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_row.request_fingerprint<>v_fp OR v_row.gross_atomic<>p_gross_atomic OR v_row.fee_atomic<>p_fee_atomic
       OR v_row.net_atomic<>p_net_atomic OR v_row.network<>p_network THEN
      RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_row.id,'status',v_row.status,
      'grossAtomic',v_row.gross_atomic,'feeAtomic',v_row.fee_atomic,'netAtomic',v_row.net_atomic);
  END IF;
  SELECT * INTO v_active FROM public.gh_pi_earnings_payout_requests
    WHERE user_id=v_user AND status IN ('reserved','processing','uncertain') ORDER BY created_at ASC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','PAYOUT_ALREADY_IN_PROGRESS','requestId',v_active.id,'status',v_active.status,'createdAt',v_active.created_at);
  END IF;
  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id=v_user LIMIT 1;
  IF NOT FOUND OR NULLIF(trim(COALESCE(v_map.pi_app_uid,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','LINKED_PI_IDENTITY_REQUIRED');
  END IF;
  SELECT * INTO v_auth FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id=v_user AND pi_app_uid=v_map.pi_app_uid AND status='active' LIMIT 1;
  IF NOT FOUND OR v_auth.wallet_scope_verified_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','PI_WALLET_ADDRESS_VERIFICATION_REQUIRED');
  END IF;
  INSERT INTO public.gh_pi_earnings_payout_requests(
    user_id,idempotency_key,request_fingerprint,gross_atomic,fee_atomic,net_atomic,
    recipient_pi_app_uid,recipient_wallet_address,recipient_username,network,status
  ) VALUES (
    v_user,v_key,v_fp,p_gross_atomic,p_fee_atomic,p_net_atomic,
    v_map.pi_app_uid,v_auth.pi_wallet_address,v_map.pi_username,p_network,'reserved'
  ) RETURNING * INTO v_row;
  v_reserve := public.gh_earnings_reserve(v_user,p_gross_atomic,
    'pi_earnings_payout:reserve:'||v_row.id::text,v_row.id::text,'withdrawal','Pi earnings payout reservation');
  IF COALESCE((v_reserve->>'ok')::boolean,false) IS NOT TRUE OR COALESCE((v_reserve->>'duplicate')::boolean,false) THEN
    RAISE EXCEPTION 'Pi earnings payout reservation failed: %',COALESCE(v_reserve->>'error','RESERVATION_CONFLICT');
  END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_row.id,'status','reserved',
    'grossAtomic',v_row.gross_atomic,'feeAtomic',v_row.fee_atomic,'netAtomic',v_row.net_atomic,
    'recipientPiAppUid',v_row.recipient_pi_app_uid,'recipientWalletAddress',v_row.recipient_wallet_address,'network',v_row.network);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_RACE_RETRY');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_grant(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_get(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(text,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_grant(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_adopt_provider_address(text,text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) TO service_role;

COMMENT ON COLUMN public.gh_pi_wallet_authorizations.wallet_scope_verified_at IS
  'Set only after the server verified, via Pi /v2/me credentials.scopes for the mapped UID, that the wallet_address scope was granted. Legacy UID-only rows stay NULL and cannot pay out.';

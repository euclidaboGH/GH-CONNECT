-- Run #260: bind Pi's explicit wallet_address scope to the server-verified
-- app-specific UID, snapshot the destination on each payout request, and
-- require the Pi A2U PaymentDTO.to_address to match before submission/settlement.
-- Also add safe provider diagnostics and one-active-request/no-blind-retry gates.

ALTER TABLE public.gh_pi_wallet_authorizations
  ADD COLUMN IF NOT EXISTS pi_wallet_address text,
  ADD COLUMN IF NOT EXISTS wallet_address_source text,
  ADD COLUMN IF NOT EXISTS wallet_address_verified_at timestamptz;

ALTER TABLE public.gh_pi_earnings_payout_requests
  ADD COLUMN IF NOT EXISTS recipient_wallet_address text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.gh_pi_wallet_authorizations'::regclass AND conname='gh_pi_wallet_auth_wallet_address_format') THEN
    ALTER TABLE public.gh_pi_wallet_authorizations
      ADD CONSTRAINT gh_pi_wallet_auth_wallet_address_format
      CHECK (pi_wallet_address IS NULL OR pi_wallet_address ~ '^G[A-Z2-7]{55}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.gh_pi_wallet_authorizations'::regclass AND conname='gh_pi_wallet_auth_wallet_address_source') THEN
    ALTER TABLE public.gh_pi_wallet_authorizations
      ADD CONSTRAINT gh_pi_wallet_auth_wallet_address_source
      CHECK (wallet_address_source IS NULL OR wallet_address_source IN ('pi_sdk_scope','platform_api','provider_payment'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.gh_pi_wallet_authorizations'::regclass AND conname='gh_pi_wallet_auth_wallet_address_pair') THEN
    ALTER TABLE public.gh_pi_wallet_authorizations
      ADD CONSTRAINT gh_pi_wallet_auth_wallet_address_pair
      CHECK (
        (pi_wallet_address IS NULL AND wallet_address_source IS NULL AND wallet_address_verified_at IS NULL)
        OR (pi_wallet_address IS NOT NULL AND wallet_address_source='pi_sdk_scope' AND wallet_address_verified_at IS NULL)
        OR (pi_wallet_address IS NOT NULL AND wallet_address_source IN ('platform_api','provider_payment') AND wallet_address_verified_at IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.gh_pi_earnings_payout_requests'::regclass AND conname='gh_pi_earnings_payout_recipient_wallet_address_format') THEN
    ALTER TABLE public.gh_pi_earnings_payout_requests
      ADD CONSTRAINT gh_pi_earnings_payout_recipient_wallet_address_format
      CHECK (recipient_wallet_address IS NULL OR recipient_wallet_address ~ '^G[A-Z2-7]{55}$');
  END IF;
END;
$$;

-- Retire the old UID-only grant entry point. A new explicit consent must carry
-- the Pi SDK wallet_address scope, which is then provider-checked per payout.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_grant(
  p_user_id text,
  p_pi_app_uid text,
  p_source text DEFAULT 'user_explicit'
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_PROOF_REQUIRED');
$$;

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
  IF v_address IS NULL OR v_address !~ '^G[A-Z2-7]{55}$' OR v_address_source NOT IN ('pi_sdk_scope','platform_api') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_REQUIRED');
  END IF;
  IF v_address_source='platform_api' THEN v_address_verified_at := now(); ELSE v_address_verified_at := NULL; END IF;

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
    status, consented_at, last_verified_at, consent_source
  ) VALUES (
    v_user, v_uid, v_address, v_address_source, v_address_verified_at,
    'active', now(), now(), 'user_explicit'
  ) RETURNING * INTO v_row;

  INSERT INTO public.gh_pi_identity_link_events (gh_user_id, event_type, pi_app_uid, detail)
  VALUES (v_user, 'consent_granted', v_uid, 'user_explicit_wallet_address_scope');

  RETURN jsonb_build_object(
    'ok', true, 'authorizationId', v_row.id, 'ghUserId', v_row.gh_user_id,
    'piAppUid', v_row.pi_app_uid, 'piWalletAddress', v_row.pi_wallet_address,
    'walletAddressSource', v_row.wallet_address_source,
    'walletAddressVerifiedAt', v_row.wallet_address_verified_at,
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
  v_wallet_bound boolean := false;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT'); END IF;
  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id = v_user AND status = 'active' ORDER BY consented_at DESC LIMIT 1;
  v_uid_matches := v_row.id IS NOT NULL AND v_map.pi_app_uid IS NOT NULL AND v_row.pi_app_uid = v_map.pi_app_uid;
  v_wallet_bound := v_uid_matches AND v_row.pi_wallet_address IS NOT NULL AND v_row.wallet_address_source IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true, 'hasMapping', v_map.gh_user_id IS NOT NULL,
    'mappedPiAppUid', v_map.pi_app_uid, 'mappedUsername', v_map.pi_username,
    'authorizationActive', v_row.id IS NOT NULL AND v_row.status='active' AND v_wallet_bound,
    'authorizationId', v_row.id, 'authorizedPiAppUid', v_row.pi_app_uid,
    'piWalletAddress', CASE WHEN v_uid_matches THEN v_row.pi_wallet_address ELSE NULL END,
    'walletAddressSource', CASE WHEN v_uid_matches THEN v_row.wallet_address_source ELSE NULL END,
    'walletAddressVerifiedAt', CASE WHEN v_uid_matches THEN v_row.wallet_address_verified_at ELSE NULL END,
    'walletAddressVerified', v_uid_matches AND v_row.wallet_address_verified_at IS NOT NULL,
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
  IF v_row.pi_wallet_address IS NULL OR v_row.wallet_address_source IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PI_WALLET_ADDRESS_VERIFICATION_REQUIRED');
  END IF;
  UPDATE public.gh_pi_wallet_authorizations SET last_verified_at=now(),updated_at=now() WHERE id=v_row.id;
  RETURN jsonb_build_object(
    'ok',true,'authorizationId',v_row.id,'piAppUid',v_row.pi_app_uid,
    'piWalletAddress',v_row.pi_wallet_address,'walletAddressSource',v_row.wallet_address_source,
    'walletAddressVerifiedAt',v_row.wallet_address_verified_at,'ghUserId',v_user
  );
END;
$$;

-- Pi's A2U PaymentDTO.to_address is authoritative. It must equal the bound
-- wallet address before the payout worker can submit or complete the payment.
CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_confirm_provider_address(
  p_user_id text, p_pi_app_uid text, p_expected_wallet_address text, p_provider_to_address text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id,'')), '');
  v_uid text := NULLIF(trim(COALESCE(p_pi_app_uid,'')), '');
  v_expected text := upper(trim(COALESCE(p_expected_wallet_address,'')));
  v_actual text := upper(trim(COALESCE(p_provider_to_address,'')));
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
BEGIN
  IF v_user IS NULL OR v_uid IS NULL OR v_expected !~ '^G[A-Z2-7]{55}$' OR v_actual !~ '^G[A-Z2-7]{55}$' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  IF v_expected IS DISTINCT FROM v_actual THEN RETURN jsonb_build_object('ok',false,'error','PI_PAYOUT_WALLET_ADDRESS_MISMATCH'); END IF;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id=v_user AND pi_app_uid=v_uid AND status='active' AND pi_wallet_address=v_expected
    LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','WALLET_AUTHORIZATION_REQUIRED'); END IF;
  UPDATE public.gh_pi_wallet_authorizations
    SET wallet_address_source='provider_payment',wallet_address_verified_at=now(),last_verified_at=now(),updated_at=now()
    WHERE id=v_row.id;
  RETURN jsonb_build_object('ok',true,'walletAddressVerifiedAt',now(),'walletAddressSource','provider_payment');
END;
$$;

-- Ownership-scoped lookup includes attempt count and the original destination snapshot.
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
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests
   WHERE id=p_request_id AND user_id=trim(p_user_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND'); END IF;
  RETURN jsonb_build_object('ok',true,'request',jsonb_build_object(
    'id',v.id::text,'user_id',v.user_id,'gross_atomic',v.gross_atomic::text,'fee_atomic',v.fee_atomic::text,
    'net_atomic',v.net_atomic::text,'recipient_pi_app_uid',v.recipient_pi_app_uid,
    'recipient_wallet_address',v.recipient_wallet_address,'network',v.network,'status',v.status,
    'provider_payment_id',v.provider_payment_id,'execution_attempts',v.execution_attempts
  ));
END;
$$;

-- One active payout per Pioneer; snapshot the Pi-authorized destination at request creation.
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
  IF NOT FOUND OR v_auth.pi_wallet_address IS NULL OR v_auth.wallet_address_source IS NULL THEN
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

-- Defense in depth: settlement must include the exact provider to_address bound
-- to this request. Legacy requests without a snapshot use the current active
-- authorization address, and still require an exact match.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_settle_verified(
  p_request_id uuid, p_provider_payment_id text, p_provider_txid text,
  p_recipient_uid text, p_amount_pi numeric, p_network text,
  p_transaction_verified boolean, p_developer_completed boolean, p_receipt jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v public.gh_pi_earnings_payout_requests%ROWTYPE;
  v_settle jsonb;
  v_receipt_amount numeric;
  v_expected_wallet_address text;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='paid' THEN
    IF v.provider_payment_id=p_provider_payment_id AND v.provider_txid=p_provider_txid THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status','paid'); END IF;
    RETURN jsonb_build_object('ok',false,'error','PAID_RECEIPT_CONFLICT');
  END IF;
  IF p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH'); END IF;
  BEGIN v_receipt_amount := (p_receipt->>'amount')::numeric; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH'); END;
  v_expected_wallet_address := v.recipient_wallet_address;
  IF v_expected_wallet_address IS NULL THEN
    SELECT pi_wallet_address INTO v_expected_wallet_address FROM public.gh_pi_wallet_authorizations
      WHERE gh_user_id=v.user_id AND pi_app_uid=v.recipient_pi_app_uid AND status='active' LIMIT 1;
  END IF;
  IF v.status NOT IN ('reserved','processing','uncertain') OR v.network<>'Pi Testnet' OR p_network<>v.network
     OR p_recipient_uid<>v.recipient_pi_app_uid OR p_provider_payment_id IS NULL OR length(p_provider_payment_id) NOT BETWEEN 1 AND 200
     OR p_provider_txid IS NULL OR length(p_provider_txid) NOT BETWEEN 1 AND 300
     OR p_transaction_verified IS DISTINCT FROM true OR p_developer_completed IS DISTINCT FROM true
     OR p_amount_pi IS NULL OR abs(p_amount_pi-(v.net_atomic::numeric/10000000))>0.00000001
     OR p_receipt->>'identifier' IS DISTINCT FROM p_provider_payment_id
     OR p_receipt->>'direction' IS DISTINCT FROM 'app_to_user'
     OR p_receipt->>'network' IS DISTINCT FROM 'Pi Testnet'
     OR p_receipt->>'user_uid' IS DISTINCT FROM v.recipient_pi_app_uid
     OR abs(v_receipt_amount-(v.net_atomic::numeric/10000000))>0.00000001
     OR p_receipt->>'to_address' IS DISTINCT FROM v_expected_wallet_address
     OR v_expected_wallet_address IS NULL
     OR p_receipt->'metadata'->>'provider' IS DISTINCT FROM 'greenhaven'
     OR p_receipt->'metadata'->>'domain' IS DISTINCT FROM 'pi_earnings'
     OR p_receipt->'metadata'->>'direction' IS DISTINCT FROM 'a2u'
     OR p_receipt->'metadata'->>'payoutRequestId' IS DISTINCT FROM v.id::text
     OR p_receipt->'transaction'->>'txid' IS DISTINCT FROM p_provider_txid
     OR COALESCE(p_receipt->'status'->>'developer_completed'='true',false) IS NOT TRUE
     OR COALESCE(p_receipt->'status'->>'transaction_verified'='true' OR p_receipt->'transaction'->>'verified'='true',false) IS NOT TRUE
     OR COALESCE(p_receipt->'status'->>'cancelled','false')='true'
     OR COALESCE(p_receipt->'status'->>'user_cancelled','false')='true' THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH');
  END IF;
  v_settle := public.gh_earnings_settle(v.user_id,v.gross_atomic,'pi_earnings_payout:settle:'||v.id::text,v.id::text,'verified PI Testnet payout; net transferred, fee retained');
  IF COALESCE((v_settle->>'ok')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'verified PI payout ledger settlement failed: %',COALESCE(v_settle->>'error','UNKNOWN'); END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='paid',provider_payment_id=p_provider_payment_id,provider_txid=p_provider_txid,
    provider_receipt=p_receipt,provider_verified_at=now(),settled_at=now(),updated_at=now(),failure_code=NULL WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'status','paid','grossAtomic',v.gross_atomic,'feeAtomic',v.fee_atomic,'netAtomic',v.net_atomic,'ledgerEntryId',v_settle->>'entryId');
END;
$$;

REVOKE ALL ON TABLE public.gh_pi_wallet_authorizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_grant(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_grant(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_get(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_confirm_provider_address(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_get_owned(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_grant(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_assert_payout(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_confirm_provider_address(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_get_owned(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_create(text,text,text,numeric,numeric,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) TO service_role;

COMMENT ON COLUMN public.gh_pi_wallet_authorizations.pi_wallet_address IS
  'Pi SDK wallet_address scope public key bound to the same server-verified app-specific UID; not a secret.';
COMMENT ON COLUMN public.gh_pi_wallet_authorizations.wallet_address_source IS
  'platform_api when returned by /v2/me, pi_sdk_scope when returned by official Pi SDK, provider_payment after A2U to_address match.';
COMMENT ON COLUMN public.gh_pi_earnings_payout_requests.recipient_wallet_address IS
  'Immutable wallet destination snapshot from the active Pi wallet authorization at payout request creation.';
COMMENT ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) IS
  'Settles only a verified Pi Testnet A2U receipt whose to_address matches the wallet address snapshot bound to the payout request.';

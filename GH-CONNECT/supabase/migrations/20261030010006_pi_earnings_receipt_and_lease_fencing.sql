-- Phase 4 defense-in-depth: validate provider evidence inside PostgreSQL and fence leases atomically.
-- This migration does not execute payments or enable Mainnet.

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(p_request_id uuid,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE; lane public.gh_pi_a2u_execution_lane%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v.execution_lease_token IS DISTINCT FROM p_lease_token
     OR v.execution_lease_expires_at IS NULL OR v.execution_lease_expires_at<=now()
     OR v.status<>'processing' THEN
    RETURN jsonb_build_object('ok',false,'error','EXECUTION_LEASE_LOST');
  END IF;
  SELECT * INTO lane FROM public.gh_pi_a2u_execution_lane WHERE lane_key='global' FOR UPDATE;
  IF NOT FOUND OR lane.lease_token IS DISTINCT FROM p_lease_token OR lane.request_id IS DISTINCT FROM p_request_id OR lane.expires_at<=now() THEN
    RETURN jsonb_build_object('ok',false,'error','GLOBAL_EXECUTION_LEASE_LOST');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET execution_lease_expires_at=now()+interval '10 minutes',updated_at=now() WHERE id=p_request_id;
  UPDATE public.gh_pi_a2u_execution_lane SET expires_at=now()+interval '10 minutes',updated_at=now() WHERE lane_key='global';
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_settle_verified(
  p_request_id uuid, p_provider_payment_id text, p_provider_txid text,
  p_recipient_uid text, p_amount_pi numeric, p_network text,
  p_transaction_verified boolean, p_developer_completed boolean, p_receipt jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE; v_settle jsonb; v_receipt_amount numeric;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='paid' THEN
    IF v.provider_payment_id=p_provider_payment_id AND v.provider_txid=p_provider_txid THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status','paid'); END IF;
    RETURN jsonb_build_object('ok',false,'error','PAID_RECEIPT_CONFLICT');
  END IF;
  IF p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH'); END IF;
  BEGIN v_receipt_amount := (p_receipt->>'amount')::numeric; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH'); END;
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
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_release_verified_failure(
  p_request_id uuid,p_provider_payment_id text,p_network text,p_cancelled boolean,p_user_cancelled boolean,
  p_has_transaction boolean,p_failure_code text,p_receipt jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE; v_release jsonb; v_receipt_amount numeric;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status IN ('released','failed') THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',v.status); END IF;
  IF v.status='paid' THEN RETURN jsonb_build_object('ok',false,'error','ALREADY_PAID'); END IF;
  IF p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' THEN RETURN jsonb_build_object('ok',false,'error','AUTHORITATIVE_NO_PAYMENT_PROOF_REQUIRED'); END IF;
  BEGIN v_receipt_amount := (p_receipt->>'amount')::numeric; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','AUTHORITATIVE_NO_PAYMENT_PROOF_REQUIRED'); END;
  IF v.status NOT IN ('reserved','processing','uncertain') OR v.network<>'Pi Testnet' OR p_network<>v.network
     OR p_provider_payment_id IS NULL OR length(p_provider_payment_id) NOT BETWEEN 1 AND 200
     OR (p_cancelled IS DISTINCT FROM true AND p_user_cancelled IS DISTINCT FROM true) OR p_has_transaction IS DISTINCT FROM false
     OR p_receipt->>'identifier' IS DISTINCT FROM p_provider_payment_id OR p_receipt->>'direction' IS DISTINCT FROM 'app_to_user'
     OR p_receipt->>'network' IS DISTINCT FROM 'Pi Testnet' OR p_receipt->>'user_uid' IS DISTINCT FROM v.recipient_pi_app_uid
     OR abs(v_receipt_amount-(v.net_atomic::numeric/10000000))>0.00000001
     OR p_receipt->'metadata'->>'provider' IS DISTINCT FROM 'greenhaven'
     OR p_receipt->'metadata'->>'domain' IS DISTINCT FROM 'pi_earnings'
     OR p_receipt->'metadata'->>'direction' IS DISTINCT FROM 'a2u'
     OR p_receipt->'metadata'->>'payoutRequestId' IS DISTINCT FROM v.id::text
     OR COALESCE(p_receipt->'status'->>'cancelled','false') IS DISTINCT FROM COALESCE(p_cancelled::text,'false')
     OR COALESCE(p_receipt->'status'->>'user_cancelled','false') IS DISTINCT FROM COALESCE(p_user_cancelled::text,'false')
     OR NOT (COALESCE(p_receipt->'status'->>'cancelled','false')='true' OR COALESCE(p_receipt->'status'->>'user_cancelled','false')='true')
     OR p_receipt->'transaction'->>'txid' IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','AUTHORITATIVE_NO_PAYMENT_PROOF_REQUIRED');
  END IF;
  v_release := public.gh_earnings_release_reserve(v.user_id,v.gross_atomic,'pi_earnings_payout:release:'||v.id::text,v.id::text,'Pi provider confirms cancelled without transaction');
  IF COALESCE((v_release->>'ok')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'verified PI payout reservation release failed: %',COALESCE(v_release->>'error','UNKNOWN'); END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='released',failure_code=left(COALESCE(p_failure_code,'PROVIDER_CONFIRMED_CANCELLED'),120),
    provider_payment_id=p_provider_payment_id,provider_receipt=p_receipt,provider_verified_at=now(),updated_at=now() WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'status','released','reservationReleased',true,'ledgerEntryId',v_release->>'entryId');
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure(uuid,text,text,boolean,boolean,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_heartbeat_execution(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure(uuid,text,text,boolean,boolean,boolean,text,jsonb) TO service_role;

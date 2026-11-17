-- Phase 4 continuation: verified settlement and authoritative no-payment recovery.
-- The application must fetch the Pi payment independently before calling these RPCs.

CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_settle_verified(
  p_request_id uuid, p_provider_payment_id text, p_provider_txid text,
  p_recipient_uid text, p_amount_pi numeric, p_network text,
  p_transaction_verified boolean, p_developer_completed boolean, p_receipt jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE; v_settle jsonb;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='paid' THEN
    IF v.provider_payment_id=p_provider_payment_id AND v.provider_txid=p_provider_txid THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'status','paid');
    END IF;
    RETURN jsonb_build_object('ok',false,'error','PAID_RECEIPT_CONFLICT');
  END IF;
  IF v.status NOT IN ('reserved','processing','uncertain') THEN
    RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_SETTLEABLE');
  END IF;
  IF v.network <> 'Pi Testnet' OR p_network <> v.network
     OR p_recipient_uid <> v.recipient_pi_app_uid
     OR p_provider_payment_id IS NULL OR length(p_provider_payment_id)>200
     OR p_provider_txid IS NULL OR length(p_provider_txid)>300
     OR p_transaction_verified IS DISTINCT FROM true
     OR p_developer_completed IS DISTINCT FROM true
     OR p_amount_pi IS NULL OR abs(p_amount_pi - (v.net_atomic::numeric / 10000000)) > 0.00000001
     OR p_receipt IS NULL OR jsonb_typeof(p_receipt)<>'object' THEN
    RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECEIPT_MISMATCH');
  END IF;
  v_settle := public.gh_earnings_settle(v.user_id,v.gross_atomic,
    'pi_earnings_payout:settle:'||v.id::text,v.id::text,'verified PI Testnet payout; net transferred, fee retained');
  IF COALESCE((v_settle->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'verified PI payout ledger settlement failed: %',COALESCE(v_settle->>'error','UNKNOWN');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='paid',
    provider_payment_id=p_provider_payment_id,provider_txid=p_provider_txid,
    provider_receipt=p_receipt,provider_verified_at=now(),settled_at=now(),updated_at=now(),failure_code=NULL
    WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'status','paid','grossAtomic',v.gross_atomic,
    'feeAtomic',v.fee_atomic,'netAtomic',v.net_atomic,'ledgerEntryId',v_settle->>'entryId');
END; $$;

-- Release is allowed only after the caller has independently fetched the exact provider
-- payment and proved it is cancelled/user-cancelled with no transaction/txid.
CREATE OR REPLACE FUNCTION public.gh_pi_earnings_payout_release_verified_failure(
  p_request_id uuid, p_provider_payment_id text, p_network text,
  p_cancelled boolean, p_user_cancelled boolean, p_has_transaction boolean,
  p_failure_code text, p_receipt jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE v public.gh_pi_earnings_payout_requests%ROWTYPE; v_release jsonb;
BEGIN
  SELECT * INTO v FROM public.gh_pi_earnings_payout_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  IF v.status='released' OR v.status='failed' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',v.status); END IF;
  IF v.status='paid' THEN RETURN jsonb_build_object('ok',false,'error','ALREADY_PAID'); END IF;
  IF v.status NOT IN ('reserved','processing','uncertain') OR v.network<>'Pi Testnet'
     OR p_network<>v.network OR p_provider_payment_id IS NULL
     OR p_cancelled IS DISTINCT FROM true AND p_user_cancelled IS DISTINCT FROM true
     OR p_has_transaction IS DISTINCT FROM false OR p_receipt IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','AUTHORITATIVE_NO_PAYMENT_PROOF_REQUIRED');
  END IF;
  v_release := public.gh_earnings_release_reserve(v.user_id,v.gross_atomic,
    'pi_earnings_payout:release:'||v.id::text,v.id::text,'Pi provider confirms cancelled without transaction');
  IF COALESCE((v_release->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'verified PI payout reservation release failed: %',COALESCE(v_release->>'error','UNKNOWN');
  END IF;
  UPDATE public.gh_pi_earnings_payout_requests SET status='released',failure_code=left(COALESCE(p_failure_code,'PROVIDER_CONFIRMED_CANCELLED'),120),
    provider_payment_id=p_provider_payment_id,provider_receipt=p_receipt,provider_verified_at=now(),updated_at=now()
    WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'status','released','reservationReleased',true,'ledgerEntryId',v_release->>'entryId');
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure(uuid,text,text,boolean,boolean,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure(uuid,text,text,boolean,boolean,boolean,text,jsonb) TO service_role;
COMMENT ON FUNCTION public.gh_pi_earnings_payout_settle_verified(uuid,text,text,text,numeric,text,boolean,boolean,jsonb) IS 'Settles gross PI earnings only after exact Testnet net amount, recipient, network, transaction verification and developer completion are confirmed by the server.';
COMMENT ON FUNCTION public.gh_pi_earnings_payout_release_verified_failure(uuid,text,text,boolean,boolean,boolean,text,jsonb) IS 'Releases gross reservation only after authoritative Pi Testnet cancellation with no transaction.';

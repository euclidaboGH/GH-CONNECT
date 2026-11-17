-- REVIEW_REQUIRED: source hardening completed; must pass disposable PostgreSQL rehearsal and dependency checks before Testnet application.
-- Run 261: auditable five-recipient Pi Testnet A2U ecosystem qualification.
-- This records independently verified provider settlements; it does not execute payments
-- or claim that Pi exposes a machine-readable Pioneer KYC endpoint.
CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_qualification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id text NOT NULL UNIQUE,
  pi_app_uid text NOT NULL UNIQUE,
  kyc_status text NOT NULL DEFAULT 'fully_passed' CHECK (kyc_status = 'fully_passed'),
  kyc_evidence_ref text NOT NULL CHECK (kyc_evidence_ref ~ '^[A-Za-z0-9._:-]{4,160}$'),
  kyc_verified_at timestamptz NOT NULL,
  verified_by text NOT NULL CHECK (length(trim(verified_by)) BETWEEN 2 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_qualification_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_payment_id text NOT NULL UNIQUE,
  txid text NOT NULL UNIQUE,
  pi_app_uid text NOT NULL UNIQUE REFERENCES public.gh_pi_a2u_qualification_recipients(pi_app_uid) ON DELETE RESTRICT,
  recipient_wallet_address text NOT NULL CHECK (recipient_wallet_address ~ '^G[A-Z2-7]{55}$'),
  amount numeric(18,8) NOT NULL CHECK (amount > 0),
  network text NOT NULL CHECK (network = 'Pi Testnet'),
  direction text NOT NULL CHECK (direction = 'app_to_user'),
  transaction_verified boolean NOT NULL CHECK (transaction_verified IS TRUE),
  developer_completed boolean NOT NULL CHECK (developer_completed IS TRUE),
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(provider_metadata::text) <= 16384),
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by text NOT NULL CHECK (length(trim(verified_by)) BETWEEN 2 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_pi_a2u_qualification_transactions_created
  ON public.gh_pi_a2u_qualification_transactions(created_at DESC);
ALTER TABLE public.gh_pi_a2u_qualification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_pi_a2u_qualification_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_qualification_recipients_no_client ON public.gh_pi_a2u_qualification_recipients;
CREATE POLICY gh_pi_a2u_qualification_recipients_no_client ON public.gh_pi_a2u_qualification_recipients FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_pi_a2u_qualification_transactions_no_client ON public.gh_pi_a2u_qualification_transactions;
CREATE POLICY gh_pi_a2u_qualification_transactions_no_client ON public.gh_pi_a2u_qualification_transactions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_pi_a2u_qualification_recipients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gh_pi_a2u_qualification_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gh_pi_a2u_qualification_recipients TO service_role;
GRANT SELECT, INSERT ON TABLE public.gh_pi_a2u_qualification_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_qualification_attest_recipient(
  p_gh_user_id text, p_pi_app_uid text, p_kyc_evidence_ref text, p_verified_by text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_uid text;
BEGIN
  IF length(trim(coalesce(p_gh_user_id,''))) < 8 OR length(trim(coalesce(p_pi_app_uid,''))) < 3
     OR trim(coalesce(p_kyc_evidence_ref,'')) !~ '^[A-Za-z0-9._:-]{4,160}$'
     OR length(trim(coalesce(p_verified_by,''))) NOT BETWEEN 2 AND 100 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  SELECT pi_app_uid INTO v_uid FROM public.gh_pi_identities
   WHERE gh_user_id = trim(p_gh_user_id) LIMIT 1;
  IF v_uid IS NULL OR v_uid <> trim(p_pi_app_uid) THEN
    RETURN jsonb_build_object('ok',false,'error','PI_IDENTITY_MAPPING_MISMATCH');
  END IF;
  INSERT INTO public.gh_pi_a2u_qualification_recipients
    (gh_user_id,pi_app_uid,kyc_status,kyc_evidence_ref,kyc_verified_at,verified_by)
  VALUES (trim(p_gh_user_id),trim(p_pi_app_uid),'fully_passed',trim(p_kyc_evidence_ref),now(),trim(p_verified_by))
  ON CONFLICT (pi_app_uid) DO UPDATE SET
    kyc_evidence_ref=EXCLUDED.kyc_evidence_ref, kyc_verified_at=now(),
    verified_by=EXCLUDED.verified_by, updated_at=now()
  WHERE public.gh_pi_a2u_qualification_recipients.gh_user_id=EXCLUDED.gh_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','RECIPIENT_ALREADY_BOUND'); END IF;
  RETURN jsonb_build_object('ok',true,'piAppUid',trim(p_pi_app_uid),'kycStatus','fully_passed');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_qualification_recipient_get(p_pi_app_uid text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN r.pi_app_uid IS NULL THEN jsonb_build_object('ok',false,'error','RECIPIENT_NOT_ATTESTED')
    ELSE jsonb_build_object('ok',true,'ghUserId',r.gh_user_id,'piAppUid',r.pi_app_uid,'kycStatus',r.kyc_status) END
  FROM (SELECT trim(coalesce(p_pi_app_uid,'')) AS uid) q
  LEFT JOIN public.gh_pi_a2u_qualification_recipients r ON r.pi_app_uid=q.uid;
$$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_qualification_record_transaction(
  p_provider_payment_id text, p_txid text, p_pi_app_uid text, p_recipient_wallet_address text, p_amount numeric,
  p_network text, p_direction text, p_transaction_verified boolean,
  p_developer_completed boolean, p_provider_metadata jsonb, p_verified_by text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
  IF length(trim(coalesce(p_provider_payment_id,''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_txid,''))) NOT BETWEEN 8 AND 300
     OR length(trim(coalesce(p_pi_app_uid,''))) < 3 OR trim(coalesce(p_recipient_wallet_address,'')) !~ '^G[A-Z2-7]{55}$' OR coalesce(p_amount,0) <= 0
     OR p_network <> 'Pi Testnet' OR p_direction <> 'app_to_user'
     OR p_transaction_verified IS DISTINCT FROM true OR p_developer_completed IS DISTINCT FROM true
     OR octet_length(coalesce(p_provider_metadata,'{}'::jsonb)::text) > 16384
     OR length(trim(coalesce(p_verified_by,''))) NOT BETWEEN 2 AND 100 THEN
    RETURN jsonb_build_object('ok',false,'error','PAYMENT_NOT_QUALIFIED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_pi_a2u_qualification_recipients r WHERE r.pi_app_uid=trim(p_pi_app_uid) AND r.kyc_status='fully_passed') THEN
    RETURN jsonb_build_object('ok',false,'error','FULL_KYC_RECIPIENT_ATTESTATION_REQUIRED');
  END IF;
  INSERT INTO public.gh_pi_a2u_qualification_transactions
    (provider_payment_id,txid,pi_app_uid,recipient_wallet_address,amount,network,direction,transaction_verified,developer_completed,provider_metadata,verified_by)
  VALUES (trim(p_provider_payment_id),trim(p_txid),trim(p_pi_app_uid),trim(p_recipient_wallet_address),p_amount,p_network,p_direction,true,true,coalesce(p_provider_metadata,'{}'::jsonb),trim(p_verified_by))
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_OR_RECIPIENT_ALREADY_COUNTED'); END IF;
  SELECT count(*) INTO v_count FROM public.gh_pi_a2u_qualification_transactions;
  RETURN jsonb_build_object('ok',true,'transactionId',v_id,'qualifiedCount',v_count,'requiredCount',5,'qualified',v_count>=5);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_qualification_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object(
    'requiredCount',5,
    'qualifiedCount',(SELECT count(*) FROM public.gh_pi_a2u_qualification_transactions),
    'qualified',(SELECT count(*) FROM public.gh_pi_a2u_qualification_transactions)>=5,
    'recipients',coalesce((SELECT jsonb_agg(jsonb_build_object('ghUserId',r.gh_user_id,'piAppUid',r.pi_app_uid,'kycStatus',r.kyc_status,'kycEvidenceRef',r.kyc_evidence_ref,'kycVerifiedAt',r.kyc_verified_at,'verifiedBy',r.verified_by) ORDER BY r.created_at) FROM public.gh_pi_a2u_qualification_recipients r),'[]'::jsonb),
    'transactions',coalesce((SELECT jsonb_agg(jsonb_build_object('providerPaymentId',t.provider_payment_id,'txid',t.txid,'piAppUid',t.pi_app_uid,'recipientWalletAddress',t.recipient_wallet_address,'amount',t.amount,'network',t.network,'direction',t.direction,'transactionVerified',t.transaction_verified,'developerCompleted',t.developer_completed,'verifiedAt',t.verified_at,'verifiedBy',t.verified_by) ORDER BY t.created_at) FROM public.gh_pi_a2u_qualification_transactions t),'[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_qualification_attest_recipient(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_qualification_recipient_get(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_qualification_record_transaction(text,text,text,text,numeric,text,text,boolean,boolean,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_qualification_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_qualification_attest_recipient(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_qualification_recipient_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_qualification_record_transaction(text,text,text,text,numeric,text,text,boolean,boolean,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_qualification_summary() TO service_role;
COMMENT ON TABLE public.gh_pi_a2u_qualification_recipients IS 'Operator-attested fully KYC-passed Pi Pioneers for Testnet A2U ecosystem qualification. Evidence reference must not contain personal documents or sensitive data.';
COMMENT ON TABLE public.gh_pi_a2u_qualification_transactions IS 'Only independently verified, developer-completed Pi Testnet A2U payments to distinct attested recipients count toward the five-transaction qualification target.';

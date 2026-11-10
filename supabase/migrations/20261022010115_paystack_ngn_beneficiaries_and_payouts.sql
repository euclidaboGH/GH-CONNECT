-- Phase 22: Paystack NGN bank-beneficiary and payout adapter foundation.
-- Additive only. This does NOT convert GHC/PI into NGN or invent NGN proceeds.
-- An NGN obligation must be recorded by a trusted revenue/settlement integration with source evidence.

CREATE TABLE IF NOT EXISTS public.gh_bank_beneficiaries (
  id text PRIMARY KEY CHECK (id ~ '^gbn_[a-f0-9]{32}$'),
  user_id text NOT NULL CHECK (length(trim(user_id)) > 0),
  provider text NOT NULL DEFAULT 'paystack' CHECK (provider='paystack'),
  provider_recipient_code text NOT NULL UNIQUE CHECK (provider_recipient_code ~ '^RCP_[A-Za-z0-9]+$'),
  account_fingerprint text NOT NULL UNIQUE CHECK (account_fingerprint ~ '^[a-f0-9]{64}$'),
  bank_code text NOT NULL CHECK (length(trim(bank_code)) BETWEEN 2 AND 20),
  bank_name text NOT NULL CHECK (length(trim(bank_name)) BETWEEN 2 AND 120),
  account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 2 AND 120),
  account_last4 text NOT NULL CHECK (account_last4 ~ '^\d{4}$'),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_bank_beneficiaries_user ON public.gh_bank_beneficiaries(user_id,created_at DESC);
ALTER TABLE public.gh_bank_beneficiaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_beneficiaries_no_client ON public.gh_bank_beneficiaries;
CREATE POLICY gh_bank_beneficiaries_no_client ON public.gh_bank_beneficiaries FOR ALL USING(false) WITH CHECK(false);

-- Only trusted server-side accounting/revenue code may create this record. A GHC/PI order is not an NGN obligation.
CREATE TABLE IF NOT EXISTS public.gh_bank_payout_obligations (
  id text PRIMARY KEY CHECK (id ~ '^gbo_[a-f0-9]{32}$'),
  seller_id text NOT NULL CHECK (length(trim(seller_id)) > 0),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  source_type text NOT NULL CHECK (source_type IN ('ngn_marketplace_sale','ngn_creator_earning','approved_ngn_adjustment')),
  source_reference text NOT NULL UNIQUE CHECK (length(trim(source_reference)) BETWEEN 8 AND 180),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','paid','reversed','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_bank_obligations_seller ON public.gh_bank_payout_obligations(seller_id,status,created_at DESC);
ALTER TABLE public.gh_bank_payout_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_obligations_no_client ON public.gh_bank_payout_obligations;
CREATE POLICY gh_bank_payout_obligations_no_client ON public.gh_bank_payout_obligations FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_daily_limits (
  payout_date date PRIMARY KEY,
  total_reserved_kobo bigint NOT NULL DEFAULT 0 CHECK (total_reserved_kobo >= 0),
  limit_kobo bigint NOT NULL CHECK (limit_kobo >= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_daily_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_daily_limits_no_client ON public.gh_bank_payout_daily_limits;
CREATE POLICY gh_bank_payout_daily_limits_no_client ON public.gh_bank_payout_daily_limits FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_requests (
  id text PRIMARY KEY CHECK (id ~ '^gbp_[a-f0-9]{32}$'),
  obligation_id text NOT NULL REFERENCES public.gh_bank_payout_obligations(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  beneficiary_id text NOT NULL REFERENCES public.gh_bank_beneficiaries(id) ON DELETE RESTRICT,
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','pending','paid','failed','reversed','cancelled','disputed')),
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 160),
  provider_reference text UNIQUE,
  provider_transfer_id text UNIQUE,
  transfer_code text,
  provider_status text,
  provider_evidence_hash text CHECK (provider_evidence_hash IS NULL OR provider_evidence_hash ~ '^[a-f0-9]{64}$'),
  daily_limit_reserved boolean NOT NULL DEFAULT false,
  operator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE(seller_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_bank_payout_active_obligation ON public.gh_bank_payout_requests(obligation_id) WHERE status IN ('requested','approved','processing','pending','paid');
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_queue ON public.gh_bank_payout_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_seller ON public.gh_bank_payout_requests(seller_id,created_at DESC);
ALTER TABLE public.gh_bank_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_requests_no_client ON public.gh_bank_payout_requests;
CREATE POLICY gh_bank_payout_requests_no_client ON public.gh_bank_payout_requests FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_operator_actions (
  id text PRIMARY KEY CHECK (id ~ '^gbpa_[a-f0-9]{32}$'),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('release_failed_obligation','release_reversed_obligation')),
  operator_note text NOT NULL CHECK (length(trim(operator_note)) BETWEEN 12 AND 1000),
  prior_request_status text NOT NULL,
  prior_obligation_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_operator_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_operator_actions_no_client ON public.gh_bank_payout_operator_actions;
CREATE POLICY gh_bank_payout_operator_actions_no_client ON public.gh_bank_payout_operator_actions FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_webhook_events (
  event_key text PRIMARY KEY CHECK (length(trim(event_key)) BETWEEN 3 AND 180),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  event_name text NOT NULL CHECK (event_name IN ('transfer.success','transfer.failed','transfer.reversed')),
  provider_reference text NOT NULL,
  provider_transfer_id text NOT NULL,
  amount_kobo bigint NOT NULL,
  currency text NOT NULL CHECK (currency='NGN'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_webhook_events_no_client ON public.gh_bank_payout_webhook_events;
CREATE POLICY gh_bank_payout_webhook_events_no_client ON public.gh_bank_payout_webhook_events FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_reconciliations (
  id text PRIMARY KEY CHECK (id ~ '^gbpr_[a-f0-9]{32}$'),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  provider_reference text NOT NULL,
  provider_transfer_id text NOT NULL,
  provider_status text NOT NULL CHECK (provider_status IN ('success','failed','reversed')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL CHECK (currency='NGN'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payout_request_id,evidence_hash)
);
ALTER TABLE public.gh_bank_payout_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_reconciliations_no_client ON public.gh_bank_payout_reconciliations;
CREATE POLICY gh_bank_payout_reconciliations_no_client ON public.gh_bank_payout_reconciliations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_bank_payout_record_obligation(
 p_obligation_id text,p_seller_id text,p_amount_kobo bigint,p_source_type text,p_source_reference text,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.gh_bank_payout_obligations%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_obligation_id),'') !~ '^gbo_[a-f0-9]{32}$' OR COALESCE(trim(p_seller_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR
   COALESCE(p_source_type,'') NOT IN ('ngn_marketplace_sale','ngn_creator_earning','approved_ngn_adjustment') OR
   COALESCE(trim(p_source_reference),'')='' OR COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_NGN_OBLIGATION'); END IF;
 SELECT * INTO v_old FROM public.gh_bank_payout_obligations WHERE source_reference=trim(p_source_reference) FOR UPDATE;
 IF FOUND THEN
  IF v_old.seller_id=trim(p_seller_id) AND v_old.amount_kobo=p_amount_kobo AND v_old.source_type=p_source_type AND v_old.evidence_hash=trim(p_evidence_hash) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'obligationId',v_old.id,'status',v_old.status); END IF;
  RETURN jsonb_build_object('ok',false,'error','NGN_OBLIGATION_SOURCE_CONFLICT');
 END IF;
 INSERT INTO public.gh_bank_payout_obligations(id,seller_id,amount_kobo,source_type,source_reference,evidence_hash)
 VALUES(trim(p_obligation_id),trim(p_seller_id),p_amount_kobo,p_source_type,trim(p_source_reference),trim(p_evidence_hash));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'obligationId',trim(p_obligation_id),'status','available','amountKobo',p_amount_kobo,'currency','NGN');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','NGN_OBLIGATION_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_beneficiary_disable(p_user_id text,p_beneficiary_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_beneficiary public.gh_bank_beneficiaries%ROWTYPE;
BEGIN
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=trim(p_beneficiary_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_FOUND'); END IF;
 IF v_beneficiary.user_id<>trim(p_user_id) THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_OWNER_MISMATCH'); END IF;
 IF EXISTS(SELECT 1 FROM public.gh_bank_payout_requests WHERE beneficiary_id=v_beneficiary.id AND status IN ('requested','approved','processing','pending','disputed')) THEN
  RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_HAS_IN_FLIGHT_PAYOUT'); END IF;
 UPDATE public.gh_bank_beneficiaries SET status='disabled',updated_at=now() WHERE id=v_beneficiary.id;
 RETURN jsonb_build_object('ok',true,'beneficiaryId',v_beneficiary.id,'status','disabled');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_request(p_seller_id text,p_obligation_id text,p_beneficiary_id text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_obligation public.gh_bank_payout_obligations%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_old public.gh_bank_payout_requests%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_seller_id),'')='' OR COALESCE(trim(p_obligation_id),'') !~ '^gbo_[a-f0-9]{32}$' OR
  COALESCE(trim(p_beneficiary_id),'') !~ '^gbn_[a-f0-9]{32}$' OR length(trim(COALESCE(p_idempotency_key,''))) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_old FROM public.gh_bank_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN
  IF v_old.obligation_id=trim(p_obligation_id) AND v_old.beneficiary_id=trim(p_beneficiary_id) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_old.id,'status',v_old.status,'amountKobo',v_old.amount_kobo); END IF;
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_KEY_CONFLICT');
 END IF;
 SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=trim(p_obligation_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_FOUND'); END IF;
 -- Recheck after the obligation lock so concurrent retries with the same idempotency key converge.
 SELECT * INTO v_old FROM public.gh_bank_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN
  IF v_old.obligation_id=trim(p_obligation_id) AND v_old.beneficiary_id=trim(p_beneficiary_id) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_old.id,'status',v_old.status,'amountKobo',v_old.amount_kobo); END IF;
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_KEY_CONFLICT');
 END IF;
 IF v_obligation.seller_id<>trim(p_seller_id) THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_OWNER_MISMATCH'); END IF;
 IF v_obligation.status<>'available' THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_AVAILABLE'); END IF;
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=trim(p_beneficiary_id) FOR SHARE;
 IF NOT FOUND OR v_beneficiary.user_id<>trim(p_seller_id) OR v_beneficiary.status<>'verified' OR v_beneficiary.currency<>'NGN' OR v_beneficiary.provider<>'paystack' THEN
  RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
 v_id:='gbp_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_bank_payout_requests(id,obligation_id,seller_id,beneficiary_id,amount_kobo,idempotency_key)
 VALUES(v_id,v_obligation.id,v_obligation.seller_id,v_beneficiary.id,v_obligation.amount_kobo,trim(p_idempotency_key));
 UPDATE public.gh_bank_payout_obligations SET status='reserved',updated_at=now() WHERE id=v_obligation.id AND status='available';
 IF NOT FOUND THEN RAISE EXCEPTION 'NGN_OBLIGATION_RESERVATION_RACE'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amountKobo',v_obligation.amount_kobo,'currency','NGN');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_REQUEST_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_operator_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_obligation public.gh_bank_payout_obligations%ROWTYPE;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF p_next_status='approved' AND v_req.status='requested' THEN
  SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=v_req.beneficiary_id;
  IF NOT FOUND OR v_beneficiary.status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
  UPDATE public.gh_bank_payout_requests SET status='approved',operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),updated_at=now() WHERE id=v_req.id;
  RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','approved','paid',false);
 ELSIF p_next_status='cancelled' AND v_req.status='requested' THEN
  SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=v_req.obligation_id FOR UPDATE;
  IF NOT FOUND OR v_obligation.status<>'reserved' THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_RESERVATION_CONFLICT'); END IF;
  UPDATE public.gh_bank_payout_requests SET status='cancelled',operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_obligations SET status='available',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
  RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','cancelled','paid',false);
 END IF;
 RETURN jsonb_build_object('ok',false,'error','INVALID_OPERATOR_TRANSITION');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_begin_transfer(p_request_id text,p_max_transfer_kobo bigint,p_daily_limit_kobo bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_reference text; v_day date := (now() AT TIME ZONE 'UTC')::date; v_daily_reserved bigint;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.status NOT IN ('approved','processing','pending') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_APPROVED'); END IF;
 IF p_max_transfer_kobo IS NULL OR p_max_transfer_kobo<100 OR p_daily_limit_kobo IS NULL OR p_daily_limit_kobo<100 THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_LIMITS_NOT_CONFIGURED'); END IF;
 IF v_req.amount_kobo>p_max_transfer_kobo THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_EXCEEDS_SINGLE_TRANSFER_LIMIT','amountKobo',v_req.amount_kobo,'maxTransferKobo',p_max_transfer_kobo); END IF;
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=v_req.beneficiary_id FOR SHARE;
 IF NOT FOUND OR v_beneficiary.user_id<>v_req.seller_id OR v_beneficiary.status<>'verified' OR v_beneficiary.provider<>'paystack' THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
 IF v_req.status='approved' THEN
  INSERT INTO public.gh_bank_payout_daily_limits(payout_date,total_reserved_kobo,limit_kobo) VALUES(v_day,0,p_daily_limit_kobo) ON CONFLICT(payout_date) DO NOTHING;
  UPDATE public.gh_bank_payout_daily_limits SET total_reserved_kobo=total_reserved_kobo+v_req.amount_kobo,limit_kobo=LEAST(limit_kobo,p_daily_limit_kobo),updated_at=now()
   WHERE payout_date=v_day AND total_reserved_kobo+v_req.amount_kobo<=LEAST(limit_kobo,p_daily_limit_kobo) RETURNING total_reserved_kobo INTO v_daily_reserved;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_DAILY_LIMIT_EXCEEDED'); END IF;
  v_reference:='ghb_'||md5(v_req.id);
  UPDATE public.gh_bank_payout_requests SET status='processing',provider_reference=v_reference,daily_limit_reserved=true,updated_at=now() WHERE id=v_req.id;
 ELSE
  IF COALESCE(v_req.provider_reference,'') !~ '^ghb_[a-f0-9]{32}$' THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_PROVIDER_REFERENCE_MISSING'); END IF;
  v_reference:=v_req.provider_reference;
 END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status',CASE WHEN v_req.status='approved' THEN 'processing' ELSE v_req.status END,
  'providerReference',v_reference,'amountKobo',v_req.amount_kobo,'recipientCode',v_beneficiary.provider_recipient_code,'currency','NGN');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_record_submission(p_request_id text,p_provider_reference text,p_transfer_code text,p_provider_status text,p_provider_transfer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.provider_reference IS NOT DISTINCT FROM trim(p_provider_reference) AND v_req.status IN ('paid','failed','reversed') AND
   (v_req.provider_transfer_id IS NULL OR v_req.provider_transfer_id=trim(COALESCE(p_provider_transfer_id,''))) THEN
  RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_req.id,'status',v_req.status,'paid',v_req.status='paid'); END IF;
 IF v_req.status NOT IN ('processing','pending') OR v_req.provider_reference IS DISTINCT FROM trim(p_provider_reference) OR trim(COALESCE(p_provider_status,'')) NOT IN ('pending','otp','success') THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_SUBMISSION_BINDING_MISMATCH'); END IF;
 IF COALESCE(v_req.provider_transfer_id,'')<>'' AND v_req.provider_transfer_id<>trim(COALESCE(p_provider_transfer_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_TRANSFER_ID_CONFLICT'); END IF;
 UPDATE public.gh_bank_payout_requests SET status='pending',provider_transfer_id=NULLIF(trim(COALESCE(p_provider_transfer_id,'')),''),transfer_code=NULLIF(trim(COALESCE(p_transfer_code,'')),''),provider_status=trim(p_provider_status),updated_at=now() WHERE id=v_req.id;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','pending','paid',false);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_TRANSFER_ID_ALREADY_USED');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_resolve_exception(p_request_id text,p_resolution text,p_operator_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_obligation public.gh_bank_payout_obligations%ROWTYPE; v_action text; v_id text;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=v_req.obligation_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_FOUND'); END IF;
 IF length(trim(COALESCE(p_operator_note,''))) NOT BETWEEN 12 AND 1000 THEN RETURN jsonb_build_object('ok',false,'error','OPERATOR_NOTE_REQUIRED'); END IF;
 IF p_resolution='release_failed_obligation' AND v_req.status='failed' AND v_req.provider_status IN ('transfer.failed','reconciled:failed') AND v_obligation.status='reserved' THEN
  v_action:='release_failed_obligation';
 ELSIF p_resolution='release_reversed_obligation' AND v_req.status='reversed' AND v_req.provider_status IN ('transfer.reversed','reconciled:reversed') AND v_obligation.status IN ('reserved','reversed') THEN
  v_action:='release_reversed_obligation';
 ELSE RETURN jsonb_build_object('ok',false,'error','PAYOUT_EXCEPTION_NOT_RESOLVABLE'); END IF;
 v_id:='gbpa_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_bank_payout_operator_actions(id,payout_request_id,action,operator_note,prior_request_status,prior_obligation_status)
 VALUES(v_id,v_req.id,v_action,left(trim(p_operator_note),1000),v_req.status,v_obligation.status);
 UPDATE public.gh_bank_payout_obligations SET status='available',updated_at=now() WHERE id=v_obligation.id;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'obligationId',v_obligation.id,'status',v_req.status,'obligationStatus','available','actionId',v_id,'paid',false);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_apply_webhook(p_event_key text,p_event_name text,p_provider_reference text,p_provider_transfer_id text,p_transfer_code text,p_amount_kobo bigint,p_currency text,p_evidence_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_existing public.gh_bank_payout_webhook_events%ROWTYPE; v_next text;
BEGIN
 IF COALESCE(trim(p_event_key),'')='' OR COALESCE(p_event_name,'') NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR
  COALESCE(trim(p_provider_reference),'') !~ '^ghb_[a-f0-9]{32}$' OR COALESCE(trim(p_provider_transfer_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR COALESCE(p_currency,'')<>'NGN' OR
  COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_WEBHOOK_EVIDENCE'); END IF;
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE provider_reference=trim(p_provider_reference) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.amount_kobo<>p_amount_kobo OR v_req.currency<>p_currency OR (v_req.provider_transfer_id IS NOT NULL AND v_req.provider_transfer_id<>trim(p_provider_transfer_id)) THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_BINDING_MISMATCH'); END IF;
 SELECT * INTO v_existing FROM public.gh_bank_payout_webhook_events WHERE event_key=trim(p_event_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_req.id,'status',v_req.status,'paid',v_req.status='paid'); END IF;
 INSERT INTO public.gh_bank_payout_webhook_events(event_key,payout_request_id,event_name,provider_reference,provider_transfer_id,amount_kobo,currency,evidence_hash)
 VALUES(trim(p_event_key),v_req.id,p_event_name,trim(p_provider_reference),trim(p_provider_transfer_id),p_amount_kobo,p_currency,trim(p_evidence_hash));
 IF p_event_name='transfer.success' AND EXISTS(SELECT 1 FROM public.gh_bank_payout_requests other WHERE other.obligation_id=v_req.obligation_id AND other.id<>v_req.id AND other.status IN ('requested','approved','processing','pending','paid')) THEN
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='transfer.success_conflict',updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='transfer.success_conflict',updated_at=now() WHERE obligation_id=v_req.obligation_id AND id<>v_req.id AND status IN ('requested','approved','processing','pending','paid');
  UPDATE public.gh_bank_payout_obligations SET status='disputed',updated_at=now() WHERE id=v_req.obligation_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','disputed','paid',false,'manualReviewRequired',true);
 END IF;
 IF v_req.status='paid' AND p_event_name='transfer.failed' THEN RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','paid','paid',true); END IF;
 v_next:=CASE p_event_name WHEN 'transfer.success' THEN 'paid' WHEN 'transfer.failed' THEN 'failed' ELSE 'reversed' END;
 UPDATE public.gh_bank_payout_requests SET status=v_next,provider_transfer_id=COALESCE(provider_transfer_id,trim(p_provider_transfer_id)),transfer_code=COALESCE(transfer_code,NULLIF(trim(COALESCE(p_transfer_code,'')),'')),provider_status=p_event_name,provider_evidence_hash=trim(p_evidence_hash),updated_at=now(),paid_at=CASE WHEN v_next='paid' THEN now() ELSE paid_at END WHERE id=v_req.id;
 IF v_next='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='paid',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
 ELSIF v_next='reversed' AND v_req.status='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='reversed',updated_at=now() WHERE id=v_req.obligation_id AND status='paid'; END IF;
 -- Failed/reversed payouts keep the obligation reserved for explicit operator review; no automatic re-payout.
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status',v_next,'paid',v_next='paid');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','WEBHOOK_EVENT_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_apply_reconciliation(
 p_request_id text,p_provider_reference text,p_provider_transfer_id text,p_transfer_code text,p_amount_kobo bigint,p_currency text,p_provider_status text,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_id text; v_next text;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^gbp_[a-f0-9]{32}$' OR COALESCE(trim(p_provider_reference),'') !~ '^ghb_[a-f0-9]{32}$' OR
  COALESCE(trim(p_provider_transfer_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR COALESCE(p_currency,'')<>'NGN' OR
  COALESCE(p_provider_status,'') NOT IN ('success','failed','reversed') OR COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_PROVIDER_RECONCILIATION'); END IF;
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.provider_reference IS DISTINCT FROM trim(p_provider_reference) OR v_req.amount_kobo<>p_amount_kobo OR v_req.currency<>p_currency OR
  (v_req.provider_transfer_id IS NOT NULL AND v_req.provider_transfer_id<>trim(p_provider_transfer_id)) THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_BINDING_MISMATCH'); END IF;
 IF v_req.status NOT IN ('processing','pending','paid','failed','reversed') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_IN_FLIGHT'); END IF;
 IF v_req.status='paid' AND p_provider_status='failed' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_req.id,'status','paid','paid',true); END IF;
 INSERT INTO public.gh_bank_payout_reconciliations(id,payout_request_id,provider_reference,provider_transfer_id,provider_status,amount_kobo,currency,evidence_hash)
 VALUES('gbpr_'||replace(gen_random_uuid()::text,'-',''),v_req.id,trim(p_provider_reference),trim(p_provider_transfer_id),p_provider_status,p_amount_kobo,p_currency,trim(p_evidence_hash))
 ON CONFLICT(payout_request_id,evidence_hash) DO NOTHING;
 IF p_provider_status='success' AND EXISTS(SELECT 1 FROM public.gh_bank_payout_requests other WHERE other.obligation_id=v_req.obligation_id AND other.id<>v_req.id AND other.status IN ('requested','approved','processing','pending','paid')) THEN
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='reconciled:success_conflict',updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='reconciled:success_conflict',updated_at=now() WHERE obligation_id=v_req.obligation_id AND id<>v_req.id AND status IN ('requested','approved','processing','pending','paid');
  UPDATE public.gh_bank_payout_obligations SET status='disputed',updated_at=now() WHERE id=v_req.obligation_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','disputed','paid',false,'manualReviewRequired',true);
 END IF;
 v_next:=CASE p_provider_status WHEN 'success' THEN 'paid' WHEN 'failed' THEN 'failed' ELSE 'reversed' END;
 UPDATE public.gh_bank_payout_requests SET status=v_next,provider_transfer_id=COALESCE(provider_transfer_id,trim(p_provider_transfer_id)),transfer_code=COALESCE(transfer_code,NULLIF(trim(COALESCE(p_transfer_code,'')),'')),provider_status='reconciled:'||p_provider_status,provider_evidence_hash=trim(p_evidence_hash),updated_at=now(),paid_at=CASE WHEN v_next='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END WHERE id=v_req.id;
 IF v_next='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='paid',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
 ELSIF v_next='reversed' AND v_req.status='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='reversed',updated_at=now() WHERE id=v_req.obligation_id AND status='paid'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status',v_next,'paid',v_next='paid');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECONCILIATION_CONFLICT');
END; $$;

REVOKE ALL ON TABLE public.gh_bank_beneficiaries, public.gh_bank_payout_obligations, public.gh_bank_payout_daily_limits, public.gh_bank_payout_requests, public.gh_bank_payout_operator_actions, public.gh_bank_payout_webhook_events, public.gh_bank_payout_reconciliations FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.gh_bank_beneficiaries, public.gh_bank_payout_obligations, public.gh_bank_payout_daily_limits, public.gh_bank_payout_requests, public.gh_bank_payout_operator_actions, public.gh_bank_payout_webhook_events, public.gh_bank_payout_reconciliations TO service_role;

REVOKE ALL ON FUNCTION public.gh_bank_payout_record_obligation(text,text,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_beneficiary_disable(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_request(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_operator_transition(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_begin_transfer(text,bigint,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_record_submission(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_resolve_exception(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_webhook(text,text,text,text,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_reconciliation(text,text,text,text,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_record_obligation(text,text,bigint,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_beneficiary_disable(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_request(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_operator_transition(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_begin_transfer(text,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_record_submission(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_resolve_exception(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_apply_webhook(text,text,text,text,text,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_apply_reconciliation(text,text,text,text,bigint,text,text,text) TO service_role;

COMMENT ON TABLE public.gh_bank_payout_daily_limits IS 'UTC daily reserved NGN transfer limits. Failed attempts remain counted for the day to avoid retry-based limit evasion.';
COMMENT ON TABLE public.gh_bank_payout_obligations IS 'Verified NGN liabilities only. GHC/PI balances must never be converted into NGN without a separately funded and approved FX settlement.';
COMMENT ON TABLE public.gh_bank_payout_requests IS 'Paystack NGN transfer requests; only verified signed webhooks may mark a payout paid.';

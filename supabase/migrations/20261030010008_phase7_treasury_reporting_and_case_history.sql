-- Phase 7 completion: evidence-backed treasury aggregates + durable operator case history.
-- REVIEW_REQUIRED. Apply only after disposable PostgreSQL validation and migration-history review.
-- Reporting is read-only. Case notes never mutate payment/ledger source records.

CREATE TABLE IF NOT EXISTS public.gh_treasury_operator_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key text NOT NULL UNIQUE,
  source_kind text NOT NULL CHECK (source_kind IN ('a2u_review','seller_payout','earnings_payout','cashback_payout','reconciliation')),
  source_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 500),
  assigned_to text,
  opened_by text NOT NULL,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('resolved','dismissed')) = (resolved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_gh_treasury_cases_status_updated ON public.gh_treasury_operator_cases(status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_treasury_operator_case_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.gh_treasury_operator_cases(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('opened','note_added','status_changed','assigned','priority_changed')),
  actor text NOT NULL,
  note text,
  from_status text,
  to_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (note IS NULL OR length(note) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_gh_treasury_case_events_case ON public.gh_treasury_operator_case_events(case_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.gh_treasury_case_event_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'GH_TREASURY_CASE_HISTORY_APPEND_ONLY' USING ERRCODE='55000'; END; $$;
REVOKE ALL ON FUNCTION public.gh_treasury_case_event_reject_mutation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS gh_treasury_case_events_append_only ON public.gh_treasury_operator_case_events;
CREATE TRIGGER gh_treasury_case_events_append_only BEFORE UPDATE OR DELETE ON public.gh_treasury_operator_case_events
FOR EACH ROW EXECUTE FUNCTION public.gh_treasury_case_event_reject_mutation();
ALTER TABLE public.gh_treasury_operator_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_treasury_operator_case_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_treasury_cases_no_client ON public.gh_treasury_operator_cases;
CREATE POLICY gh_treasury_cases_no_client ON public.gh_treasury_operator_cases FOR ALL USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS gh_treasury_case_events_no_client ON public.gh_treasury_operator_case_events;
CREATE POLICY gh_treasury_case_events_no_client ON public.gh_treasury_operator_case_events FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON public.gh_treasury_operator_cases, public.gh_treasury_operator_case_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_treasury_case_upsert(
  p_case_key text, p_source_kind text, p_source_id text, p_summary text,
  p_actor text, p_event_type text DEFAULT 'note_added', p_note text DEFAULT NULL,
  p_status text DEFAULT NULL, p_priority text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_case public.gh_treasury_operator_cases%ROWTYPE; v_from text;
BEGIN
  IF length(trim(coalesce(p_case_key,''))) NOT BETWEEN 3 AND 220 OR length(trim(coalesce(p_source_id,''))) NOT BETWEEN 1 AND 160
    OR p_source_kind NOT IN ('a2u_review','seller_payout','earnings_payout','cashback_payout','reconciliation')
    OR length(trim(coalesce(p_actor,''))) NOT BETWEEN 1 AND 160
    OR p_event_type NOT IN ('opened','note_added','status_changed','assigned','priority_changed')
    OR (p_note IS NOT NULL AND length(p_note)>2000)
    OR (p_status IS NOT NULL AND p_status NOT IN ('open','investigating','resolved','dismissed'))
    OR (p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','critical')) THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_CASE_INPUT');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gh_treasury_case:'||trim(p_case_key)));
  SELECT * INTO v_case FROM public.gh_treasury_operator_cases WHERE case_key=trim(p_case_key) FOR UPDATE;
  IF NOT FOUND THEN
    IF p_event_type<>'opened' THEN RETURN jsonb_build_object('ok',false,'error','CASE_NOT_FOUND'); END IF;
    INSERT INTO public.gh_treasury_operator_cases(case_key,source_kind,source_id,summary,opened_by,priority)
      VALUES(trim(p_case_key),p_source_kind,trim(p_source_id),left(trim(p_summary),500),trim(p_actor),coalesce(p_priority,'normal')) RETURNING * INTO v_case;
    INSERT INTO public.gh_treasury_operator_case_events(case_id,event_type,actor,note,to_status)
      VALUES(v_case.id,'opened',trim(p_actor),nullif(trim(coalesce(p_note,'')),''),'open');
    RETURN jsonb_build_object('ok',true,'caseId',v_case.id,'status',v_case.status,'created',true);
  END IF;
  IF v_case.source_kind<>p_source_kind OR v_case.source_id<>trim(p_source_id) THEN
    RETURN jsonb_build_object('ok',false,'error','CASE_SOURCE_CONFLICT');
  END IF;
  v_from:=v_case.status;
  UPDATE public.gh_treasury_operator_cases SET
    status=coalesce(p_status,status), priority=coalesce(p_priority,priority),
    summary=CASE WHEN nullif(trim(coalesce(p_summary,'')),'') IS NULL THEN summary ELSE left(trim(p_summary),500) END,
    resolved_by=CASE WHEN p_status IN ('resolved','dismissed') THEN trim(p_actor) WHEN p_status IN ('open','investigating') THEN NULL ELSE resolved_by END,
    resolved_at=CASE WHEN p_status IN ('resolved','dismissed') THEN now() WHEN p_status IN ('open','investigating') THEN NULL ELSE resolved_at END,
    updated_at=now() WHERE id=v_case.id RETURNING * INTO v_case;
  INSERT INTO public.gh_treasury_operator_case_events(case_id,event_type,actor,note,from_status,to_status)
    VALUES(v_case.id,CASE WHEN p_status IS NOT NULL AND p_status<>v_from THEN 'status_changed' WHEN p_event_type='opened' THEN 'note_added' ELSE p_event_type END,
      trim(p_actor),nullif(trim(coalesce(p_note,'')),''),v_from,v_case.status);
  RETURN jsonb_build_object('ok',true,'caseId',v_case.id,'status',v_case.status,'created',false);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_treasury_case_list(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_items jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC),'[]'::jsonb) INTO v_items FROM (
  SELECT c.id,c.case_key,c.source_kind,c.source_id,c.status,c.priority,c.summary,c.assigned_to,c.opened_by,c.resolved_by,c.resolved_at,c.created_at,c.updated_at,
    (SELECT coalesce(jsonb_agg(to_jsonb(recent) ORDER BY recent.created_at ASC),'[]'::jsonb) FROM (SELECT e.* FROM public.gh_treasury_operator_case_events e WHERE e.case_id=c.id ORDER BY e.created_at DESC LIMIT 100) recent) AS history
  FROM public.gh_treasury_operator_cases c ORDER BY c.updated_at DESC LIMIT least(200,greatest(1,coalesce(p_limit,100)))
 ) x;
 RETURN jsonb_build_object('ok',true,'items',v_items);
END; $$;

-- One aggregate RPC: source tables remain authoritative; all monetary values are strings.
CREATE OR REPLACE FUNCTION public.gh_treasury_financial_report(p_starts_at timestamptz,p_ends_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_revenue jsonb; v_revenue_types jsonb; v_seller jsonb; v_earnings jsonb; v_cashback jsonb; v_tips jsonb; v_ghc jsonb;
BEGIN
 IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at<=p_starts_at OR p_ends_at-p_starts_at>interval '93 days' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_REPORTING_WINDOW'); END IF;
 SELECT coalesce(jsonb_object_agg(currency,totals),'{}'::jsonb) INTO v_revenue FROM (
  SELECT currency,jsonb_build_object('events',count(*),'grossMinor',coalesce(sum(gross_amount_minor),0)::text,
   'companyRevenueMinor',coalesce(sum(company_revenue_minor),0)::text,'providerFeesMinor',coalesce(sum(provider_fee_minor),0)::text,
   'taxMinor',coalesce(sum(tax_minor),0)::text,'companyNetMinor',coalesce(sum(company_net_minor),0)::text) totals
  FROM public.gh_company_revenue_events WHERE verified_at>=p_starts_at AND verified_at<p_ends_at GROUP BY currency
 ) q;
 SELECT coalesce(jsonb_object_agg(currency,events),'{}'::jsonb) INTO v_revenue_types FROM (
  SELECT currency,jsonb_object_agg(event_type,jsonb_build_object('events',event_count::text,'grossMinor',gross_minor::text,'companyRevenueMinor',revenue_minor::text,'companyNetMinor',net_minor::text)) events
  FROM (SELECT currency,event_type,count(*) event_count,coalesce(sum(gross_amount_minor),0) gross_minor,coalesce(sum(company_revenue_minor),0) revenue_minor,coalesce(sum(company_net_minor),0) net_minor
    FROM public.gh_company_revenue_events WHERE verified_at>=p_starts_at AND verified_at<p_ends_at GROUP BY currency,event_type) typed GROUP BY currency
 ) breakdown;
 SELECT coalesce(jsonb_object_agg(currency,totals),'{}'::jsonb) INTO v_seller FROM (
  SELECT c.currency,jsonb_build_object(
   'unallocatedCompletedVerifiedOrderGrossCurrentSnapshot',coalesce((SELECT sum(o.total_amount) FROM public.gh_marketplace_orders o WHERE upper(o.currency)=c.currency AND o.status='completed' AND o.payment_status='verified' AND NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id)),0)::text,
   'requested',coalesce((SELECT sum(r.amount) FROM public.gh_seller_payout_requests r WHERE r.currency=c.currency AND r.created_at>=p_starts_at AND r.created_at<p_ends_at AND r.status IN ('requested','under_review','approved','processing')),0)::text,
   'paid',coalesce((SELECT sum(r.amount) FROM public.gh_seller_payout_requests r WHERE r.currency=c.currency AND r.paid_at>=p_starts_at AND r.paid_at<p_ends_at AND r.status='paid'),0)::text,
   'failedOrHeld',coalesce((SELECT sum(r.amount) FROM public.gh_seller_payout_requests r WHERE r.currency=c.currency AND r.created_at>=p_starts_at AND r.created_at<p_ends_at AND r.status IN ('failed','rejected')),0)::text,
   'allocatedOrderAmount',coalesce((SELECT sum(a.amount) FROM public.gh_seller_payout_allocations a JOIN public.gh_seller_payout_requests r ON r.id=a.payout_request_id WHERE r.currency=c.currency AND r.created_at>=p_starts_at AND r.created_at<p_ends_at),0)::text,
   'allocationMismatchCount',(SELECT count(*) FROM public.gh_seller_payout_requests r LEFT JOIN (SELECT payout_request_id,sum(amount) allocated FROM public.gh_seller_payout_allocations GROUP BY payout_request_id) a ON a.payout_request_id=r.id WHERE r.currency=c.currency AND r.created_at>=p_starts_at AND r.created_at<p_ends_at AND coalesce(a.allocated,0)<>r.amount)::text,
   'requestCount',(SELECT count(*) FROM public.gh_seller_payout_requests r WHERE r.currency=c.currency AND r.created_at>=p_starts_at AND r.created_at<p_ends_at)::text) totals
  FROM (SELECT DISTINCT upper(currency) currency FROM public.gh_marketplace_orders UNION SELECT DISTINCT upper(currency) FROM public.gh_seller_payout_requests) c
 ) q;
 SELECT jsonb_build_object(
  'postedPositiveAmount',coalesce(sum(amount) FILTER(WHERE status='posted' AND amount>0),0)::text,
  'postedNegativeAmountAbs',abs(coalesce(sum(amount) FILTER(WHERE status='posted' AND amount<0),0))::text,
  'netPostedLedgerMovement',coalesce(sum(amount) FILTER(WHERE status='posted'),0)::text,
  'pendingPositiveAmount',coalesce(sum(amount) FILTER(WHERE status='pending' AND amount>0),0)::text,
  'pendingNegativeAmountAbs',abs(coalesce(sum(amount) FILTER(WHERE status='pending' AND amount<0),0))::text,
  'postedTransactionCount',count(*) FILTER(WHERE status='posted')::text,
  'pendingTransactionCount',count(*) FILTER(WHERE status='pending')::text,
  'transferPairMismatchCount',(SELECT count(*) FROM (SELECT reference_id,count(*) FILTER(WHERE kind='transfer_out') out_count,count(*) FILTER(WHERE kind='transfer_in') in_count,coalesce(sum(amount),0) net_amount FROM public.ghc_transactions WHERE status='posted' AND kind IN ('transfer_out','transfer_in') AND coalesce(posted_at,created_at)>=p_starts_at AND coalesce(posted_at,created_at)<p_ends_at GROUP BY reference_id HAVING count(*) FILTER(WHERE kind='transfer_out')<>count(*) FILTER(WHERE kind='transfer_in') OR coalesce(sum(amount),0)<>0) mismatches)::text,
  'period',jsonb_build_object('startsAt',p_starts_at,'endsAt',p_ends_at)) INTO v_ghc
 FROM public.ghc_transactions WHERE coalesce(posted_at,created_at)>=p_starts_at AND coalesce(posted_at,created_at)<p_ends_at;
 SELECT jsonb_build_object('reservedGrossAtomic',coalesce(sum(gross_atomic) FILTER(WHERE status IN ('reserved','processing','uncertain')),0)::text,
  'reservedFeeAtomic',coalesce(sum(fee_atomic) FILTER(WHERE status IN ('reserved','processing','uncertain')),0)::text,
  'reservedNetAtomic',coalesce(sum(net_atomic) FILTER(WHERE status IN ('reserved','processing','uncertain')),0)::text,
  'paidGrossAtomic',coalesce(sum(gross_atomic) FILTER(WHERE status='paid'),0)::text,
  'paidFeeAtomic',coalesce(sum(fee_atomic) FILTER(WHERE status='paid'),0)::text,
  'paidNetAtomic',coalesce(sum(net_atomic) FILTER(WHERE status='paid'),0)::text,
  'releasedGrossAtomic',coalesce(sum(gross_atomic) FILTER(WHERE status IN ('released','failed')),0)::text,
  'conservationMismatchCount',count(*) FILTER(WHERE gross_atomic<>fee_atomic+net_atomic)::text,
  'requestCount',count(*)::text) INTO v_earnings
 FROM public.gh_pi_earnings_payout_requests WHERE created_at>=p_starts_at AND created_at<p_ends_at;
 SELECT jsonb_build_object('calculatedLiabilityAtomic',coalesce(sum(e.cashback_amount_atomic) FILTER(WHERE e.status='calculated'),0)::text,
  'needsReviewAtomic',coalesce(sum(e.cashback_amount_atomic) FILTER(WHERE e.status='needs_review'),0)::text,
  'reservedAtomic',coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status IN ('processing','attention') AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0)::text,
  'paidAtomic',coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status='paid' AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0)::text,
  'coverageDeltaAtomic',(coalesce(sum(e.cashback_amount_atomic) FILTER(WHERE e.status='calculated'),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status IN ('processing','attention') AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status='paid' AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0))::text,
  'outstandingAtomic',greatest(0,coalesce(sum(e.cashback_amount_atomic) FILTER(WHERE e.status='calculated'),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status IN ('processing','attention') AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status='paid' AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0))::text,
  'overAllocatedAtomic',greatest(0,-(coalesce(sum(e.cashback_amount_atomic) FILTER(WHERE e.status='calculated'),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status IN ('processing','attention') AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0) - coalesce((SELECT sum(pay.amount_atomic) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status='paid' AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at),0)))::text,
  'payoutAttentionCount',(SELECT count(*) FROM public.gh_pi_cashback_a2u_payouts pay JOIN public.gh_pi_cashback_entitlements ent ON ent.id=pay.entitlement_id JOIN public.gh_pi_cashback_periods per ON per.id=ent.period_id WHERE pay.status='attention' AND per.starts_at<p_ends_at AND per.ends_at>p_starts_at)::text)
 INTO v_cashback FROM public.gh_pi_cashback_entitlements e JOIN public.gh_pi_cashback_periods p ON p.id=e.period_id
 WHERE p.ends_at>p_starts_at AND p.starts_at<p_ends_at;
 SELECT jsonb_build_object('creatorPayable',coalesce(sum(gross_amount) FILTER(WHERE status IN ('collected','payable')),0)::text,
  'paid',coalesce(sum(gross_amount) FILTER(WHERE status='paid'),0)::text,
  'disputedOrRefunded',coalesce(sum(gross_amount) FILTER(WHERE status IN ('disputed','refunded')),0)::text,
  'settlementCount',count(*)::text) INTO v_tips FROM public.gh_tip_settlements WHERE collected_at>=p_starts_at AND collected_at<p_ends_at;
 RETURN jsonb_build_object('ok',true,'generatedAt',now(),'window',jsonb_build_object('startsAt',p_starts_at,'endsAt',p_ends_at),
  'companyRevenueByCurrency',coalesce(v_revenue,'{}'::jsonb),'companyRevenueByTypeAndCurrency',coalesce(v_revenue_types,'{}'::jsonb),'ghcLedgerMovements',coalesce(v_ghc,'{}'::jsonb),'sellerPayoutsByAsset',coalesce(v_seller,'{}'::jsonb),
  'piEarningsPayouts',coalesce(v_earnings,'{}'::jsonb),'piCashback',coalesce(v_cashback,'{}'::jsonb),'cashbackScope','full_entitlement_periods_overlapping_reporting_window',
  'piCreatorTips',coalesce(v_tips,'{}'::jsonb),
  'notes',jsonb_build_array('Revenue journal amounts are source-currency minor units; do not combine currencies.','Seller paid totals use paid_at; payout requests are not a full seller balance sheet. Unallocated order gross is not net seller payable.','Cashback calculated liability is not a funding proof; attention and paid payouts are reported separately.','GHC ledger movements are reported independently and are not company revenue; period net movement is not a token-supply or per-user available-balance statement.'));
END; $$;

REVOKE ALL ON FUNCTION public.gh_treasury_case_upsert(text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_treasury_case_list(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_treasury_case_upsert(text,text,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_treasury_case_list(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) TO service_role;
COMMENT ON TABLE public.gh_treasury_operator_case_events IS 'Append-only operator investigation history. It records actions and notes; it never substitutes for source payment or ledger evidence.';
COMMENT ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) IS 'Read-only source-backed treasury aggregates. PI and GHC are kept separate; missing source records do not imply zero liabilities.';

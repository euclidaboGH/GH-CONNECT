-- Phase 23: treasury source reconciliation + community membership lifecycle journal.
-- REVIEW_REQUIRED: validate on disposable PostgreSQL and reconcile remote migration history before apply.
-- Read-only reporting; no historical money or entitlement rows are rewritten.

-- Preserve the prior report implementation as a stable base and wrap it with new source-backed sections.
ALTER FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz)
  RENAME TO gh_treasury_financial_report_phase7_base;

CREATE OR REPLACE FUNCTION public.gh_treasury_financial_report(p_starts_at timestamptz,p_ends_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_base jsonb; v_marketplace jsonb; v_communities jsonb; v_legacy jsonb;
BEGIN
 IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at<=p_starts_at OR p_ends_at-p_starts_at>interval '93 days' THEN
   RETURN jsonb_build_object('ok',false,'error','INVALID_REPORTING_WINDOW');
 END IF;
 v_base:=public.gh_treasury_financial_report_phase7_base(p_starts_at,p_ends_at);
 IF coalesce((v_base->>'ok')::boolean,false) IS NOT TRUE THEN RETURN v_base; END IF;

 SELECT coalesce(jsonb_object_agg(currency,totals),'{}'::jsonb) INTO v_marketplace FROM (
   SELECT c.currency,jsonb_build_object(
     'verifiedOrderCount',c.order_count::text,
     'gross',c.gross::text,
     'platformCommission',c.commission::text,
     'sellerNetBeforeAdjustments',c.seller_net::text,
     'grossAdjustments',c.gross_adjustments::text,
     'sellerNetAdjustments',c.net_adjustments::text,
     'sellerNetAfterAdjustments',greatest(0,c.seller_net-c.net_adjustments)::text,
     'reservedSellerNet',c.reserved::text,
     'settledSellerNet',c.settled::text,
     'unreservedSellerNet',greatest(0,c.seller_net-c.net_adjustments-c.reserved)::text,
     'allocationMismatchCount',c.allocation_mismatches::text,
     'proceedsSnapshotMissingCount',c.missing_snapshots::text,
     'overAdjustedOrderCount',c.over_adjusted::text
   ) totals
   FROM (
     SELECT upper(o.currency) currency,count(*) FILTER(WHERE o.payment_status='verified') order_count,
       coalesce(sum(p.gross_amount) FILTER(WHERE o.payment_status='verified'),0) gross,
       coalesce(sum(p.platform_commission) FILTER(WHERE o.payment_status='verified'),0) commission,
       coalesce(sum(p.seller_net) FILTER(WHERE o.payment_status='verified'),0) seller_net,
       coalesce(sum(adj.gross_adjusted),0) gross_adjustments,
       coalesce(sum(adj.net_adjusted),0) net_adjustments,
       coalesce(sum(alloc.reserved_amount),0) reserved,
       coalesce(sum(alloc.settled_amount),0) settled,
       count(*) FILTER(WHERE alloc.order_id IS NOT NULL AND alloc.amount<>greatest(0,p.seller_net-coalesce(adj.net_adjusted,0))) allocation_mismatches,
       count(*) FILTER(WHERE o.payment_status='verified' AND p.order_id IS NULL) missing_snapshots,
       count(*) FILTER(WHERE coalesce(adj.net_adjusted,0)>coalesce(p.seller_net,0)) over_adjusted
     FROM public.gh_marketplace_orders o
     LEFT JOIN public.gh_marketplace_order_proceeds p ON p.order_id=o.id
     LEFT JOIN LATERAL (SELECT sum(a.gross_amount) gross_adjusted,sum(a.seller_net_reduction) net_adjusted
       FROM public.gh_marketplace_order_adjustments a WHERE a.order_id=o.id AND a.created_at<p_ends_at) adj ON true
     LEFT JOIN LATERAL (SELECT sum(a.amount) FILTER(WHERE r.status IN ('requested','under_review','approved','processing')) reserved_amount,
         sum(a.amount) FILTER(WHERE r.status='paid') settled_amount,a.order_id
       FROM public.gh_seller_payout_allocations a JOIN public.gh_seller_payout_requests r ON r.id=a.payout_request_id
       WHERE a.order_id=o.id AND r.created_at<p_ends_at GROUP BY a.order_id) alloc ON true
     WHERE o.created_at>=p_starts_at AND o.created_at<p_ends_at
     GROUP BY upper(o.currency)
   ) c
 ) q;

 -- Membership events are an audit journal; payment intent and entitlement remain authoritative.
 SELECT jsonb_build_object(
   'paymentIntentCount',(SELECT count(DISTINCT i.id) FROM public.ghc_payment_intents i
     WHERE (i.purpose='membership' OR lower(coalesce(i.metadata->>'productId','')) ~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$')
       AND i.status IN ('COMPLETED','FULFILLED') AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)>=p_starts_at
       AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)<p_ends_at)::text,
   'completedPaymentsByCurrency',(SELECT coalesce(jsonb_object_agg(currency,totals),'{}'::jsonb) FROM (SELECT upper(i.currency) currency,jsonb_build_object('amount',coalesce(sum(i.amount),0)::text,'count',count(*)::text) totals FROM public.ghc_payment_intents i
     WHERE (i.purpose='membership' OR lower(coalesce(i.metadata->>'productId','')) ~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$')
       AND i.status IN ('COMPLETED','FULFILLED') AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)>=p_starts_at
       AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)<p_ends_at GROUP BY upper(i.currency)) currency_totals),
   'completedPaymentCount',(SELECT count(*) FROM public.ghc_payment_intents i
     WHERE (i.purpose='membership' OR lower(coalesce(i.metadata->>'productId','')) ~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$')
       AND i.status IN ('COMPLETED','FULFILLED') AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)>=p_starts_at
       AND coalesce(i.completed_at,i.fulfilled_at,i.created_at)<p_ends_at)::text,
   'activeEntitlementCount',(SELECT count(*) FROM public.ghc_membership_entitlements e WHERE e.active AND (e.expires_at IS NULL OR e.expires_at>now()))::text,
   'expiredEntitlementCount',(SELECT count(*) FROM public.ghc_membership_entitlements e WHERE e.tier<>'free' AND e.expires_at IS NOT NULL AND e.expires_at<=now())::text,
   'renewalEventCount',(SELECT count(*) FROM public.ghc_membership_entitlement_events ev WHERE ev.event_type='renewed' AND ev.created_at>=p_starts_at AND ev.created_at<p_ends_at)::text,
   'grantEventCount',(SELECT count(*) FROM public.ghc_membership_entitlement_events ev WHERE ev.event_type='granted' AND ev.created_at>=p_starts_at AND ev.created_at<p_ends_at)::text,
   'paymentIntentMismatchCount',(SELECT count(*) FROM public.ghc_membership_entitlements e LEFT JOIN public.ghc_payment_intents i ON i.id=e.payment_intent_id
     WHERE e.payment_intent_id IS NOT NULL AND i.id IS NULL)::text,
   'entitlementEvents',(SELECT count(*) FROM public.ghc_membership_entitlement_events ev WHERE ev.created_at>=p_starts_at AND ev.created_at<p_ends_at)::text
 ) INTO v_communities;

 -- Historical payout audit: report legacy allocations that cannot be proven against net snapshots.
 SELECT jsonb_build_object(
   'legacyGrossAllocationCount',count(*) FILTER(WHERE p.order_id IS NULL AND a.amount>0)::text,
   'legacyAllocatedAmount',coalesce(sum(a.amount) FILTER(WHERE p.order_id IS NULL),0)::text,
   'netAllocationMismatchCount',count(*) FILTER(WHERE p.order_id IS NOT NULL AND a.amount<>greatest(0,p.seller_net-coalesce(adj.net_adjusted,0)))::text,
   'unmatchedPayoutRequestCount',(SELECT count(*) FROM public.gh_seller_payout_requests r
     LEFT JOIN (SELECT payout_request_id,sum(amount) allocated FROM public.gh_seller_payout_allocations GROUP BY payout_request_id) x ON x.payout_request_id=r.id
     WHERE r.created_at>=p_starts_at AND r.created_at<p_ends_at AND coalesce(x.allocated,0)<>r.amount)::text,
   'reconciliationRequired',true
 ) INTO v_legacy
 FROM public.gh_seller_payout_allocations a
 LEFT JOIN public.gh_marketplace_order_proceeds p ON p.order_id=a.order_id
 LEFT JOIN LATERAL (SELECT sum(seller_net_reduction) net_adjusted FROM public.gh_marketplace_order_adjustments z WHERE z.order_id=a.order_id AND z.created_at<p_ends_at) adj ON true
 JOIN public.gh_seller_payout_requests r ON r.id=a.payout_request_id
 WHERE r.created_at>=p_starts_at AND r.created_at<p_ends_at;

 RETURN v_base || jsonb_build_object(
   'marketplaceFinancialReconciliation',coalesce(v_marketplace,'{}'::jsonb),
   'communityMembershipReconciliation',coalesce(v_communities,'{}'::jsonb),
   'historicalPayoutReconciliation',coalesce(v_legacy,'{}'::jsonb),
   'phase23Notes',jsonb_build_array(
     'Marketplace totals use immutable verified proceeds snapshots and append-only adjustments; currencies are never combined.',
     'Reservations are payout allocations; settled amounts include only payout requests marked paid.',
     'Legacy allocations without proceeds snapshots are flagged and are not rewritten or treated as verified seller net.',
     'Membership payment totals are grouped by currency; PI and GHC are never added together.' ,
     'Membership report links current entitlement rows to payment intent IDs and lifecycle events; it does not grant or renew access.',
     'Expired entitlement counts are computed at report time; expiry does not mutate historical payment or entitlement evidence.'
   )
 );
END; $$;

-- Membership lifecycle journal captures durable entitlement changes without duplicating payment amounts.
CREATE TABLE IF NOT EXISTS public.ghc_membership_entitlement_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('granted','renewed','tier_changed','expired','revoked','payment_linked')),
  tier text NOT NULL CHECK(tier IN ('free','vip','vvip')),
  source text NOT NULL,
  purchase_ref text,
  payment_intent_id text,
  started_at timestamptz,
  expires_at timestamptz,
  previous_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_fingerprint text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_ghc_membership_events_user_time
  ON public.ghc_membership_entitlement_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghc_membership_events_payment
  ON public.ghc_membership_entitlement_events(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
ALTER TABLE public.ghc_membership_entitlement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_membership_events_no_client ON public.ghc_membership_entitlement_events;
CREATE POLICY ghc_membership_events_no_client ON public.ghc_membership_entitlement_events FOR ALL USING(false) WITH CHECK(false);
REVOKE ALL ON public.ghc_membership_entitlement_events FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ghc_membership_entitlement_event_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_type text; v_fingerprint text;
BEGIN
 IF TG_OP='INSERT' THEN
   v_type:=CASE WHEN NEW.tier='free' THEN 'granted' ELSE 'granted' END;
 ELSE
   IF OLD.tier<>'free' AND OLD.expires_at IS NOT NULL AND OLD.expires_at<=now() AND NEW.tier='free' THEN v_type:='expired';
   ELSIF OLD.expires_at IS DISTINCT FROM NEW.expires_at AND NEW.expires_at>coalesce(OLD.expires_at,'-infinity'::timestamptz) THEN v_type:='renewed';
   ELSIF OLD.tier IS DISTINCT FROM NEW.tier THEN v_type:='tier_changed';
   ELSIF OLD.active AND NOT NEW.active THEN v_type:='revoked';
   ELSIF OLD.payment_intent_id IS DISTINCT FROM NEW.payment_intent_id THEN v_type:='payment_linked';
   ELSE RETURN NEW; END IF;
 END IF;
 v_fingerprint:=md5(concat_ws('|',NEW.user_id,v_type,NEW.tier,coalesce(NEW.purchase_ref,''),coalesce(NEW.payment_intent_id,''),coalesce(NEW.started_at::text,''),coalesce(NEW.expires_at::text,'')));
 INSERT INTO public.ghc_membership_entitlement_events(user_id,event_type,tier,source,purchase_ref,payment_intent_id,started_at,expires_at,previous_expires_at,event_fingerprint)
 VALUES(NEW.user_id,v_type,NEW.tier,NEW.source,NEW.purchase_ref,NEW.payment_intent_id,NEW.started_at,NEW.expires_at,CASE WHEN TG_OP='UPDATE' THEN OLD.expires_at ELSE NULL END,v_fingerprint)
 ON CONFLICT(event_fingerprint) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_entitlement_event_capture() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_ghc_membership_entitlement_event_capture ON public.ghc_membership_entitlements;
CREATE TRIGGER trg_ghc_membership_entitlement_event_capture
AFTER INSERT OR UPDATE OF tier,active,source,purchase_ref,payment_intent_id,started_at,expires_at
ON public.ghc_membership_entitlements FOR EACH ROW EXECUTE FUNCTION public.ghc_membership_entitlement_event_capture();

CREATE OR REPLACE FUNCTION public.ghc_membership_event_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'MEMBERSHIP_ENTITLEMENT_EVENT_IMMUTABLE' USING ERRCODE='55000'; END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_event_reject_mutation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_ghc_membership_events_immutable ON public.ghc_membership_entitlement_events;
CREATE TRIGGER trg_ghc_membership_events_immutable BEFORE UPDATE OR DELETE
ON public.ghc_membership_entitlement_events FOR EACH ROW EXECUTE FUNCTION public.ghc_membership_event_reject_mutation();

-- Explicit bounded expiry sweep. It never invents a refund or changes the payment journal.
CREATE OR REPLACE FUNCTION public.ghc_membership_expire_due(p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_count integer;
BEGIN
 WITH due AS (
   SELECT user_id FROM public.ghc_membership_entitlements
   WHERE tier IN ('vip','vvip') AND active=true AND expires_at IS NOT NULL AND expires_at<=now()
   ORDER BY expires_at,user_id LIMIT least(2000,greatest(1,coalesce(p_limit,500)))
   FOR UPDATE SKIP LOCKED
 )
 UPDATE public.ghc_membership_entitlements e SET tier='free',active=true,source='default',billing_period=NULL,updated_at=now(),
   audit=coalesce(e.audit,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'action','EXPIRED','detail',e.tier))
 FROM due WHERE e.user_id=due.user_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('ok',true,'expiredCount',v_count,'mutatesPaymentRecords',false);
END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_expire_due(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_expire_due(integer) TO service_role;

-- Read-only exception queue for paid membership intents with no matching entitlement/payment link.
CREATE OR REPLACE FUNCTION public.ghc_membership_reconciliation_report(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_rows jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.completed_at DESC),'[]'::jsonb) INTO v_rows FROM (
   SELECT i.id AS payment_intent_id,i.user_id,i.currency,i.amount,i.status,i.completed_at,i.fulfilled_at,
     i.metadata->>'productId' AS product_id,
     CASE WHEN e.user_id IS NULL THEN 'MISSING_ENTITLEMENT' ELSE 'ENTITLEMENT_LINKED' END AS reconciliation_status
   FROM public.ghc_payment_intents i
   LEFT JOIN public.ghc_membership_entitlements e ON e.payment_intent_id=i.id
   WHERE (i.purpose='membership' OR lower(coalesce(i.metadata->>'productId','')) ~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$')
     AND i.status IN ('COMPLETED','FULFILLED')
   ORDER BY coalesce(i.completed_at,i.fulfilled_at,i.created_at) DESC LIMIT least(500,greatest(1,coalesce(p_limit,100)))
 ) x;
 RETURN jsonb_build_object('ok',true,'items',v_rows,'mutatesEntitlements',false);
END; $$;
REVOKE ALL ON FUNCTION public.ghc_membership_reconciliation_report(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_reconciliation_report(integer) TO service_role;

REVOKE ALL ON FUNCTION public.gh_treasury_financial_report_phase7_base(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) TO service_role;
COMMENT ON TABLE public.ghc_membership_entitlement_events IS 'Append-only lifecycle journal for canonical membership entitlements; payment intent remains the payment authority.';
COMMENT ON FUNCTION public.ghc_membership_expire_due(integer) IS 'Bounded service-role-only expiry sweep; updates expired paid entitlements to free and writes an append-only expiry event without altering payment records.';
COMMENT ON FUNCTION public.ghc_membership_reconciliation_report(integer) IS 'Read-only queue of completed membership payment intents and their entitlement linkage; never grants access.';
COMMENT ON FUNCTION public.gh_treasury_financial_report(timestamptz,timestamptz) IS 'Extends the Phase 7 report with marketplace gross/commission/net/adjustments/reservations/settlements, legacy payout reconciliation and community membership linkage.';

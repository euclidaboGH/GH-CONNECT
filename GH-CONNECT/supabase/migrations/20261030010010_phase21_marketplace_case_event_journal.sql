-- Phase 21: append-only, database-authored marketplace lifecycle event journal.
-- REVIEW_REQUIRED: validate trigger behavior, RLS, ACLs and actor attribution on disposable PostgreSQL/Testnet.
-- This records order lifecycle changes; it does not authorize refunds, move funds or resolve disputes.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'ORDER_CREATED','PAYMENT_STATE_CHANGED','ORDER_STATE_CHANGED','DELIVERY_STATE_CHANGED',
    'ESCROW_STATE_CHANGED','DISPUTE_OPENED','DISPUTE_STATE_CHANGED','ORDER_COMPLETED','ORDER_CANCELLED'
  )),
  actor_id text,
  actor_source text NOT NULL CHECK (actor_source IN ('authenticated_claim','service_context','unknown')),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_marketplace_order_events_state_object CHECK (
    jsonb_typeof(before_state)='object' AND jsonb_typeof(after_state)='object'
  )
);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_order_events_order_time
  ON public.gh_marketplace_order_events(order_id,created_at DESC,id DESC);
ALTER TABLE public.gh_marketplace_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events;
CREATE POLICY gh_marketplace_order_events_no_client ON public.gh_marketplace_order_events
  FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_record_order_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor text;
  v_source text;
  v_type text;
BEGIN
  IF TG_OP='INSERT' THEN
    v_before := '{}'::jsonb;
    v_after := jsonb_build_object(
      'status',NEW.status,'payment_status',NEW.payment_status,'escrow_status',NEW.escrow_status,
      'delivery_status',NEW.delivery_status,'currency',NEW.currency,'total_amount',NEW.total_amount
    );
    v_type := 'ORDER_CREATED';
  ELSE
    v_before := jsonb_build_object(
      'status',OLD.status,'payment_status',OLD.payment_status,'escrow_status',OLD.escrow_status,
      'delivery_status',OLD.delivery_status
    );
    v_after := jsonb_build_object(
      'status',NEW.status,'payment_status',NEW.payment_status,'escrow_status',NEW.escrow_status,
      'delivery_status',NEW.delivery_status
    );
    IF v_before=v_after THEN RETURN NEW; END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='disputed' THEN
      v_type := 'DISPUTE_OPENED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed' THEN
      v_type := 'ORDER_COMPLETED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='cancelled' THEN
      v_type := 'ORDER_CANCELLED';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND (OLD.status='disputed' OR NEW.status='disputed') THEN
      v_type := 'DISPUTE_STATE_CHANGED';
    ELSIF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      v_type := 'PAYMENT_STATE_CHANGED';
    ELSIF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
      v_type := 'DELIVERY_STATE_CHANGED';
    ELSIF OLD.escrow_status IS DISTINCT FROM NEW.escrow_status THEN
      v_type := 'ESCROW_STATE_CHANGED';
    ELSE
      v_type := 'ORDER_STATE_CHANGED';
    END IF;
  END IF;

  v_actor := NULLIF(current_setting('request.jwt.claim.sub',true),'');
  IF v_actor IS NOT NULL THEN
    v_source := 'authenticated_claim';
  ELSIF current_user='service_role' OR session_user='service_role' THEN
    v_actor := 'service_role';
    v_source := 'service_context';
  ELSE
    v_source := 'unknown';
  END IF;

  INSERT INTO public.gh_marketplace_order_events(
    order_id,event_type,actor_id,actor_source,before_state,after_state
  ) VALUES (NEW.id,v_type,v_actor,v_source,v_before,v_after);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_marketplace_record_order_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_gh_marketplace_order_event_insert ON public.gh_marketplace_orders;
DROP TRIGGER IF EXISTS trg_gh_marketplace_order_event_update ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_order_event_insert
AFTER INSERT ON public.gh_marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_record_order_event();
CREATE TRIGGER trg_gh_marketplace_order_event_update
AFTER UPDATE OF status,payment_status,escrow_status,delivery_status ON public.gh_marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_record_order_event();
COMMENT ON TABLE public.gh_marketplace_order_events IS
  'Append-only database-authored order, payment, delivery, escrow and dispute lifecycle history. Not a refund or settlement ledger.';

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_event_reject_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'MARKETPLACE_ORDER_EVENT_IMMUTABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_event_reject_mutation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_gh_marketplace_order_event_immutable ON public.gh_marketplace_order_events;
CREATE TRIGGER trg_gh_marketplace_order_event_immutable
BEFORE UPDATE OR DELETE ON public.gh_marketplace_order_events
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_order_event_reject_mutation();

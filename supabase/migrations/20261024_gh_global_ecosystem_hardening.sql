-- Global ecosystem hardening (additive, service-role only).
-- Review existing Testnet/Mainnet migration state before applying. This file is not auto-applied.

-- Versioned, retry-safe domain outbox. Existing curation migration creates the base table;
-- ALTERs below are additive and safe when that migration has already been applied.
CREATE TABLE IF NOT EXISTS public.gh_domain_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,100}$'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  idempotency_key text NOT NULL UNIQUE,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text
);
ALTER TABLE public.gh_domain_event_outbox ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.gh_domain_event_outbox ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.gh_domain_event_outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE public.gh_domain_event_outbox ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.gh_domain_event_outbox ADD COLUMN IF NOT EXISTS last_error text;
CREATE INDEX IF NOT EXISTS idx_gh_domain_outbox_pending ON public.gh_domain_event_outbox (available_at, created_at) WHERE processed_at IS NULL;
ALTER TABLE public.gh_domain_event_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_domain_event_outbox_no_client ON public.gh_domain_event_outbox;
CREATE POLICY gh_domain_event_outbox_no_client ON public.gh_domain_event_outbox FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_domain_event_receipts (
  event_id uuid PRIMARY KEY REFERENCES public.gh_domain_event_outbox(id) ON DELETE RESTRICT,
  consumer text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_domain_event_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_domain_event_receipts_no_client ON public.gh_domain_event_receipts;
CREATE POLICY gh_domain_event_receipts_no_client ON public.gh_domain_event_receipts FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_domain_event_enqueue(
  p_event_type text, p_idempotency_key text, p_aggregate_type text, p_aggregate_id text,
  p_actor_id text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb, p_schema_version integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF COALESCE(trim(p_event_type),'') = '' OR COALESCE(trim(p_idempotency_key),'') = '' OR
     COALESCE(trim(p_aggregate_type),'') = '' OR COALESCE(trim(p_aggregate_id),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_EVENT');
  END IF;
  INSERT INTO public.gh_domain_event_outbox(event_type,schema_version,idempotency_key,aggregate_type,aggregate_id,actor_id,payload)
  VALUES (lower(trim(p_event_type)), GREATEST(1,COALESCE(p_schema_version,1)), trim(p_idempotency_key),
          trim(p_aggregate_type), trim(p_aggregate_id), NULLIF(trim(COALESCE(p_actor_id,'')),''), COALESCE(p_payload,'{}'::jsonb))
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM public.gh_domain_event_outbox WHERE idempotency_key=trim(p_idempotency_key); END IF;
  RETURN jsonb_build_object('ok',true,'eventId',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_domain_event_claim(p_worker text, p_limit integer DEFAULT 50)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(trim(p_worker),'') = '' THEN RETURN; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.gh_domain_event_outbox
    WHERE processed_at IS NULL AND available_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(100,GREATEST(1,COALESCE(p_limit,50)))
  ), locked AS (
    UPDATE public.gh_domain_event_outbox e SET locked_at=now(), locked_by=trim(p_worker), attempts=e.attempts+1
    FROM picked WHERE e.id=picked.id
    RETURNING e.*
  )
  SELECT jsonb_build_object('id',id,'eventType',event_type,'schemaVersion',schema_version,
    'idempotencyKey',idempotency_key,'aggregateType',aggregate_type,'aggregateId',aggregate_id,
    'actorId',actor_id,'payload',payload,'attempts',attempts,'createdAt',created_at)
  FROM locked ORDER BY created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.gh_domain_event_ack(p_event_id uuid, p_worker text, p_consumer text, p_result jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.gh_domain_event_receipts(event_id,consumer,result)
  SELECT id,COALESCE(NULLIF(trim(p_consumer),''),'global-ecosystem-v1'),COALESCE(p_result,'{}'::jsonb)
  FROM public.gh_domain_event_outbox WHERE id=p_event_id AND locked_by=trim(COALESCE(p_worker,'')) AND processed_at IS NULL
  ON CONFLICT(event_id) DO NOTHING;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.gh_domain_event_outbox WHERE id=p_event_id AND processed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'error','LEASE_NOT_OWNED');
  END IF;
  UPDATE public.gh_domain_event_outbox SET processed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL
    WHERE id=p_event_id AND locked_by=trim(COALESCE(p_worker,'')) AND processed_at IS NULL;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_domain_event_retry(p_event_id uuid, p_worker text, p_error text DEFAULT 'consumer failed')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gh_domain_event_outbox SET locked_at=NULL,locked_by=NULL,
    available_at=now() + make_interval(secs => LEAST(3600, GREATEST(5, power(2, LEAST(attempts,10))::integer))),
    last_error=left(COALESCE(p_error,'consumer failed'),1000)
  WHERE id=p_event_id AND locked_by=trim(COALESCE(p_worker,'')) AND processed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LEASE_NOT_OWNED'); END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;

REVOKE ALL ON FUNCTION public.gh_domain_event_enqueue(text,text,text,text,text,jsonb,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_domain_event_claim(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_domain_event_ack(uuid,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_domain_event_retry(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_domain_event_enqueue(text,text,text,text,text,jsonb,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_domain_event_claim(text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_domain_event_ack(uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_domain_event_retry(uuid,text,text) TO service_role;

-- Marketplace reservations make finite stock concurrency-safe and idempotent.
CREATE TABLE IF NOT EXISTS public.gh_marketplace_stock_reservations (
  order_id text PRIMARY KEY,
  listing_id text NOT NULL REFERENCES public.gh_marketplace_listings(id) ON DELETE RESTRICT,
  buyer_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status IN ('reserved','committed','released','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_market_reservations_expiry ON public.gh_marketplace_stock_reservations(expires_at) WHERE status='reserved';
ALTER TABLE public.gh_marketplace_stock_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_stock_reservations_no_client ON public.gh_marketplace_stock_reservations;
CREATE POLICY gh_marketplace_stock_reservations_no_client ON public.gh_marketplace_stock_reservations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_reserve(p_listing_id text,p_order_id text,p_buyer_id text,p_quantity integer,p_ttl_seconds integer DEFAULT 900)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.gh_marketplace_listings%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_listing_id),'')='' OR COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_buyer_id),'')='' OR COALESCE(p_quantity,0)<1 OR p_quantity>99 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_RESERVATION');
  END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(p_order_id) FOR UPDATE;
  IF FOUND THEN
    IF r.listing_id=trim(p_listing_id) AND r.buyer_id=trim(p_buyer_id) AND r.quantity=p_quantity AND r.status='reserved' AND r.expires_at>now() THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'expiresAt',r.expires_at);
    END IF;
    RETURN jsonb_build_object('ok',false,'error','RESERVATION_CONFLICT');
  END IF;
  SELECT * INTO l FROM public.gh_marketplace_listings WHERE id=trim(p_listing_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_NOT_FOUND'); END IF;
  IF l.status<>'active' THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE','status',l.status); END IF;
  IF l.availability<p_quantity THEN RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_STOCK','available',l.availability); END IF;
  UPDATE public.gh_marketplace_listings SET availability=availability-p_quantity,
    status=CASE WHEN availability-p_quantity<=0 THEN 'sold_out' ELSE status END,updated_at=now() WHERE id=l.id;
  INSERT INTO public.gh_marketplace_stock_reservations(order_id,listing_id,buyer_id,quantity,status,expires_at)
  VALUES(trim(p_order_id),l.id,trim(p_buyer_id),p_quantity,'reserved',now()+make_interval(secs=>LEAST(3600,GREATEST(60,COALESCE(p_ttl_seconds,900)))));
  RETURN jsonb_build_object('ok',true,'duplicate',false,'expiresAt',now()+make_interval(secs=>LEAST(3600,GREATEST(60,COALESCE(p_ttl_seconds,900)))),'remaining',l.availability-p_quantity);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_commit(p_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gh_marketplace_stock_reservations SET status='committed',updated_at=now()
    WHERE order_id=trim(COALESCE(p_order_id,'')) AND status='reserved';
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'committed',true); END IF;
  IF EXISTS(SELECT 1 FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(COALESCE(p_order_id,'')) AND status='committed') THEN
    RETURN jsonb_build_object('ok',true,'committed',true,'duplicate',true);
  END IF;
  RETURN jsonb_build_object('ok',false,'error','RESERVATION_NOT_FOUND');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_release(p_order_id text,p_final_status text DEFAULT 'released')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_stock_reservations%ROWTYPE;
BEGIN
  IF p_final_status NOT IN ('released','expired') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_FINAL_STATUS'); END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'released',false,'reason','NOT_FOUND'); END IF;
  IF r.status IN ('released','expired') THEN RETURN jsonb_build_object('ok',true,'released',false,'duplicate',true); END IF;
  IF r.status='committed' THEN RETURN jsonb_build_object('ok',false,'error','STOCK_ALREADY_COMMITTED'); END IF;
  UPDATE public.gh_marketplace_stock_reservations SET status=p_final_status,updated_at=now() WHERE order_id=r.order_id;
  UPDATE public.gh_marketplace_listings SET availability=availability+r.quantity,
    status=CASE WHEN status='sold_out' THEN 'active' ELSE status END,updated_at=now() WHERE id=r.listing_id;
  RETURN jsonb_build_object('ok',true,'released',true,'quantity',r.quantity);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_expire(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT order_id FROM public.gh_marketplace_stock_reservations WHERE status='reserved' AND expires_at<=now()
    ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT LEAST(500,GREATEST(1,COALESCE(p_limit,100))) LOOP
    PERFORM public.gh_marketplace_stock_release(r.order_id,'expired'); n:=n+1;
  END LOOP;
  RETURN n;
END; $$;

-- Atomic compare-and-transition; callers still enforce buyer/seller roles from authenticated session.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_transition_atomic(p_order_id text,p_expected_status text,p_to_status text,p_actor_id text,p_detail text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE; allowed boolean:=false; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF r.status=p_to_status THEN RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',true); END IF;
  IF r.status<>p_expected_status THEN RETURN jsonb_build_object('ok',false,'error','STATE_CONFLICT','status',r.status); END IF;
  allowed := CASE r.status
    WHEN 'created' THEN p_to_status IN ('payment_pending','cancelled')
    WHEN 'payment_pending' THEN p_to_status IN ('payment_verified','cancelled')
    WHEN 'payment_verified' THEN p_to_status IN ('confirmed','cancelled','refunded')
    WHEN 'confirmed' THEN p_to_status IN ('fulfilling','cancelled','disputed')
    WHEN 'fulfilling' THEN p_to_status IN ('completed','disputed')
    WHEN 'completed' THEN p_to_status IN ('refunded')
    WHEN 'disputed' THEN p_to_status IN ('refunded','completed','cancelled')
    ELSE false END;
  IF NOT allowed THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
  IF p_to_status IN ('confirmed','fulfilling','completed','disputed','refunded') AND r.payment_status<>'verified' AND p_to_status<>'refunded' THEN
    RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED');
  END IF;
  UPDATE public.gh_marketplace_orders SET status=p_to_status,updated_at=now_ts,
    confirmed_at=CASE WHEN p_to_status='confirmed' THEN now_ts ELSE confirmed_at END,
    fulfilled_at=CASE WHEN p_to_status='fulfilling' THEN now_ts ELSE fulfilled_at END,
    completed_at=CASE WHEN p_to_status='completed' THEN now_ts ELSE completed_at END,
    cancelled_at=CASE WHEN p_to_status='cancelled' THEN now_ts ELSE cancelled_at END,
    audit=COALESCE(audit,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('at',extract(epoch from now_ts)*1000,'action',p_to_status,'detail',trim(COALESCE(p_actor_id,'') || CASE WHEN COALESCE(p_detail,'')<>'' THEN ':'||p_detail ELSE '' END)))
    WHERE id=r.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||r.id||':'||p_to_status,'marketplace_order',r.id,p_actor_id,
    jsonb_build_object('from',r.status,'to',p_to_status,'buyerId',r.buyer_id,'sellerId',r.seller_id,'totalAmount',r.total_amount,'currency',r.currency),1);
  IF p_to_status='cancelled' THEN PERFORM public.gh_marketplace_stock_release(r.id,'released'); END IF;
  RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',false);
END; $$;

-- Growth referrals: qualification is server evidence, never client-submitted points or payment status.
CREATE TABLE IF NOT EXISTS public.gh_growth_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id text NOT NULL,
  referred_user_id text NOT NULL UNIQUE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rejected','paid','appealed')),
  qualification_event text,
  qualified_at timestamptz,
  reward_event_id text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_growth_referrals_referrer ON public.gh_growth_referrals(referrer_id,created_at DESC);
ALTER TABLE public.gh_growth_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_growth_referrals_no_client ON public.gh_growth_referrals;
CREATE POLICY gh_growth_referrals_no_client ON public.gh_growth_referrals FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  target_event_id text,
  category text NOT NULL CHECK (category IN ('incorrect_penalty','wrong_identity','duplicate_event','context_missing','other')),
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 20 AND 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','upheld','reversed','withdrawn')),
  resolution_note text,
  reviewer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_reputation_appeals_user ON public.gh_reputation_appeals(user_id,created_at DESC);
ALTER TABLE public.gh_reputation_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_appeals_no_client ON public.gh_reputation_appeals;
CREATE POLICY gh_reputation_appeals_no_client ON public.gh_reputation_appeals FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
  reviewer_id text NOT NULL,
  seller_id text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL CHECK (length(trim(review_text)) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','under_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,reviewer_id),
  CHECK (reviewer_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_market_reviews_seller ON public.gh_marketplace_reviews(seller_id,created_at DESC);
ALTER TABLE public.gh_marketplace_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_reviews_no_client ON public.gh_marketplace_reviews;
CREATE POLICY gh_marketplace_reviews_no_client ON public.gh_marketplace_reviews FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_ranking_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id text NOT NULL,
  post_id text NOT NULL,
  rank_position integer NOT NULL CHECK (rank_position BETWEEN 1 AND 500),
  ranking_version text NOT NULL DEFAULT 'for-you-v1',
  reason_category text NOT NULL DEFAULT 'personalization',
  dwell_ms integer CHECK (dwell_ms IS NULL OR dwell_ms BETWEEN 0 AND 3600000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_ranking_impressions_viewer_created ON public.gh_ranking_impressions(viewer_id,created_at DESC);
ALTER TABLE public.gh_ranking_impressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_ranking_impressions_no_client ON public.gh_ranking_impressions;
CREATE POLICY gh_ranking_impressions_no_client ON public.gh_ranking_impressions FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_reward_risk_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source_event_id text NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('velocity','self_dealing','sybil_suspected','provider_mismatch','manual_review','policy_limit')),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','reversed','appealed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(user_id,source_event_id)
);
ALTER TABLE public.gh_reward_risk_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reward_risk_holds_no_client ON public.gh_reward_risk_holds;
CREATE POLICY gh_reward_risk_holds_no_client ON public.gh_reward_risk_holds FOR ALL USING(false) WITH CHECK(false);

-- Append-only progression provenance, distinct from money, reputation and membership.
CREATE TABLE IF NOT EXISTS public.gh_progression_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  event_type text NOT NULL,
  xp integer NOT NULL CHECK (xp BETWEEN 0 AND 10000),
  rules_version text NOT NULL DEFAULT 'progression-v1',
  idempotency_key text NOT NULL UNIQUE,
  source_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_progression_user_created ON public.gh_progression_events(user_id,created_at DESC);
ALTER TABLE public.gh_progression_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_progression_events_no_client ON public.gh_progression_events;
CREATE POLICY gh_progression_events_no_client ON public.gh_progression_events FOR ALL USING(false) WITH CHECK(false);

-- Service-role only grants for every table/RPC in this migration.
GRANT SELECT,INSERT,UPDATE ON public.gh_domain_event_outbox TO service_role;
GRANT SELECT,INSERT ON public.gh_domain_event_receipts TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_marketplace_stock_reservations TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_growth_referrals TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_reputation_appeals TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_marketplace_reviews TO service_role;
GRANT SELECT,INSERT ON public.gh_ranking_impressions TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_reward_risk_holds TO service_role;
GRANT SELECT,INSERT ON public.gh_progression_events TO service_role;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_reserve(text,text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_commit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_release(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_expire(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_transition_atomic(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_reserve(text,text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_commit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_release(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_expire(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_transition_atomic(text,text,text,text,text) TO service_role;

COMMENT ON TABLE public.gh_progression_events IS 'Server-authoritative XP provenance. XP is non-financial and cannot grant wallet value.';
COMMENT ON TABLE public.gh_reward_risk_holds IS 'Auditable reward review holds; holds do not silently debit balances.';
COMMENT ON TABLE public.gh_ranking_impressions IS 'Privacy-minimized ranking evaluation telemetry; do not store sensitive attributes.';

-- Referral codes are scoped to a real account and cannot be self-referred.
CREATE TABLE IF NOT EXISTS public.gh_growth_referral_codes (
  user_id text PRIMARY KEY,
  referral_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_growth_referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_growth_referral_codes_no_client ON public.gh_growth_referral_codes;
CREATE POLICY gh_growth_referral_codes_no_client ON public.gh_growth_referral_codes FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT ON public.gh_growth_referral_codes TO service_role;

CREATE OR REPLACE FUNCTION public.gh_growth_referral_code_get_or_create(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_existing public.gh_growth_referral_codes%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_user_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','USER_REQUIRED'); END IF;
  SELECT * INTO v_existing FROM public.gh_growth_referral_codes WHERE user_id=trim(p_user_id);
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'code',v_existing.referral_code); END IF;
  LOOP
    v_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
    BEGIN
      INSERT INTO public.gh_growth_referral_codes(user_id,referral_code) VALUES(trim(p_user_id),v_code);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      SELECT referral_code INTO v_code FROM public.gh_growth_referral_codes WHERE user_id=trim(p_user_id);
      IF v_code IS NOT NULL THEN EXIT; END IF;
    END;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'code',v_code);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_growth_referral_register(p_referred_user_id text,p_referral_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer text; v_id uuid;
BEGIN
  IF COALESCE(trim(p_referred_user_id),'')='' OR COALESCE(trim(p_referral_code),'')='' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
  SELECT user_id INTO v_referrer FROM public.gh_growth_referral_codes WHERE referral_code=upper(trim(p_referral_code));
  IF v_referrer IS NULL THEN RETURN jsonb_build_object('ok',false,'error','REFERRAL_CODE_NOT_FOUND'); END IF;
  IF v_referrer=trim(p_referred_user_id) THEN RETURN jsonb_build_object('ok',false,'error','SELF_REFERRAL'); END IF;
  INSERT INTO public.gh_growth_referrals(referrer_id,referred_user_id,referral_code,status)
    VALUES(v_referrer,trim(p_referred_user_id),upper(trim(p_referral_code)),'pending')
    ON CONFLICT(referred_user_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','REFERRAL_ALREADY_REGISTERED'); END IF;
  PERFORM public.gh_domain_event_enqueue('growth.referral_created','growth.referral-created:'||v_id::text,'referral',v_id::text,trim(p_referred_user_id),jsonb_build_object('referrerId',v_referrer,'referredUserId',trim(p_referred_user_id)),1);
  RETURN jsonb_build_object('ok',true,'referralId',v_id,'status','pending');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_growth_referral_qualify(p_referred_user_id text,p_qualification_event text,p_evidence_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref public.gh_growth_referrals%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_referred_user_id),'')='' OR COALESCE(trim(p_qualification_event),'')='' OR COALESCE(trim(p_evidence_ref),'')='' THEN
    RETURN jsonb_build_object('ok',false,'error','EVIDENCE_REQUIRED');
  END IF;
  IF p_qualification_event NOT IN ('profile_verified','first_original_post','retained_7d','completed_marketplace_order') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_QUALIFICATION_EVENT');
  END IF;
  SELECT * INTO v_ref FROM public.gh_growth_referrals WHERE referred_user_id=trim(p_referred_user_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REFERRAL_NOT_FOUND'); END IF;
  IF v_ref.status IN ('qualified','paid') THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',v_ref.status); END IF;
  IF v_ref.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'error','REFERRAL_NOT_ELIGIBLE'); END IF;
  UPDATE public.gh_growth_referrals SET status='qualified',qualification_event=p_qualification_event,qualified_at=now(),updated_at=now()
    WHERE id=v_ref.id;
  PERFORM public.gh_domain_event_enqueue('growth.referral_qualified','growth.referral-qualified:'||v_ref.id::text,'referral',v_ref.id::text,v_ref.referrer_id,
    jsonb_build_object('referrerId',v_ref.referrer_id,'referredUserId',v_ref.referred_user_id,'qualificationEvent',p_qualification_event,'evidenceRef',p_evidence_ref),1);
  RETURN jsonb_build_object('ok',true,'status','qualified','referralId',v_ref.id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_progression_award_xp(p_user_id text,p_event_type text,p_xp integer,p_idempotency_key text,p_source_ref text DEFAULT NULL,p_rules_version text DEFAULT 'progression-v1',p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_total integer; v_existing public.gh_progression_events%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_user_id),'')='' OR COALESCE(trim(p_event_type),'')='' OR COALESCE(trim(p_idempotency_key),'')='' OR COALESCE(p_xp,-1)<0 OR p_xp>10000 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  IF p_event_type NOT IN ('profile_completed','original_post_published','helpful_reply_verified','community_contribution_verified','marketplace_order_completed','learning_milestone') THEN
    RETURN jsonb_build_object('ok',false,'error','EVENT_NOT_AWARDABLE');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gh_xp:'||trim(p_user_id)));
  SELECT * INTO v_existing FROM public.gh_progression_events WHERE idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
    RETURN jsonb_build_object('ok',true,'duplicate',true,'eventId',v_existing.id,'totalXp',v_total,'rulesVersion',v_existing.rules_version);
  END IF;
  INSERT INTO public.gh_progression_events(user_id,event_type,xp,rules_version,idempotency_key,source_ref,metadata)
    VALUES(trim(p_user_id),p_event_type,p_xp,COALESCE(NULLIF(trim(p_rules_version),''),'progression-v1'),trim(p_idempotency_key),NULLIF(trim(COALESCE(p_source_ref,'')),''),COALESCE(p_metadata,'{}'::jsonb))
    RETURNING id INTO v_id;
  SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
  PERFORM public.gh_domain_event_enqueue('progression.xp_awarded','progression.xp:'||trim(p_idempotency_key),'progression',v_id::text,trim(p_user_id),
    jsonb_build_object('userId',trim(p_user_id),'eventType',p_event_type,'xp',p_xp,'totalXp',v_total,'rulesVersion',COALESCE(p_rules_version,'progression-v1')),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'eventId',v_id,'xpAwarded',p_xp,'totalXp',v_total,'rulesVersion',COALESCE(p_rules_version,'progression-v1'));
END; $$;

-- Completed eligible order reviews are unique per buyer/order and cannot be self-authored.
CREATE OR REPLACE FUNCTION public.gh_marketplace_review_create(p_order_id text,p_reviewer_id text,p_rating integer,p_review_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; v_id uuid;
BEGIN
  IF COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_reviewer_id),'')='' OR COALESCE(p_rating,0) NOT BETWEEN 1 AND 5 OR length(trim(COALESCE(p_review_text,''))) NOT BETWEEN 3 AND 2000 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_REVIEW');
  END IF;
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','BUYER_ONLY'); END IF;
  IF o.seller_id=trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','SELF_REVIEW'); END IF;
  IF o.status<>'completed' OR o.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_COMPLETED_ORDER_REQUIRED'); END IF;
  INSERT INTO public.gh_marketplace_reviews(order_id,reviewer_id,seller_id,rating,review_text)
    VALUES(o.id,trim(p_reviewer_id),o.seller_id,p_rating,trim(p_review_text)) RETURNING id INTO v_id;
  PERFORM public.gh_domain_event_enqueue('marketplace.review_submitted','marketplace.review-submitted:'||v_id::text,'marketplace_review',v_id::text,trim(p_reviewer_id),
    jsonb_build_object('orderId',o.id,'reviewerId',trim(p_reviewer_id),'sellerId',o.seller_id,'rating',p_rating),1);
  RETURN jsonb_build_object('ok',true,'reviewId',v_id,'status','published');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','REVIEW_ALREADY_EXISTS');
END; $$;

REVOKE ALL ON FUNCTION public.gh_growth_referral_code_get_or_create(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_growth_referral_register(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_growth_referral_qualify(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_progression_award_xp(text,text,integer,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_review_create(text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_growth_referral_code_get_or_create(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_growth_referral_register(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_growth_referral_qualify(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_progression_award_xp(text,text,integer,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_review_create(text,text,integer,text) TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.gh_marketplace_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.gh_progression_get(p_user_id text,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total integer; v_events jsonb;
BEGIN
  IF COALESCE(trim(p_user_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','USER_REQUIRED'); END IF;
  SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'eventType',event_type,'xp',xp,'rulesVersion',rules_version,'sourceRef',source_ref,'createdAt',created_at) ORDER BY created_at DESC),'[]'::jsonb)
    INTO v_events FROM (SELECT * FROM public.gh_progression_events WHERE user_id=trim(p_user_id) ORDER BY created_at DESC LIMIT LEAST(100,GREATEST(1,COALESCE(p_limit,50)))) recent;
  RETURN jsonb_build_object('ok',true,'totalXp',v_total,'rulesVersion','progression-v1','events',v_events);
END; $$;
REVOKE ALL ON FUNCTION public.gh_progression_get(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_progression_get(text,integer) TO service_role;

-- Prevent listing edits from restoring/overwriting units currently held by active checkout reservations.
CREATE OR REPLACE FUNCTION public.gh_marketplace_guard_reserved_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reserved integer;
BEGIN
  IF current_setting('ghc.marketplace_reserving', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.availability IS DISTINCT FROM OLD.availability THEN
    SELECT COALESCE(sum(quantity),0)::integer INTO v_reserved FROM public.gh_marketplace_stock_reservations
      WHERE listing_id=OLD.id AND status='reserved' AND expires_at>now();
    IF v_reserved > 0 THEN
      RAISE EXCEPTION 'ACTIVE_STOCK_RESERVATIONS: listing inventory cannot be edited until checkout reservations settle';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS gh_marketplace_guard_reserved_stock_trg ON public.gh_marketplace_listings;
CREATE TRIGGER gh_marketplace_guard_reserved_stock_trg BEFORE UPDATE OF availability ON public.gh_marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_guard_reserved_stock();

-- Redefine reserve/release to bypass the seller-edit guard only within these trusted atomic functions.
CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_reserve(p_listing_id text,p_order_id text,p_buyer_id text,p_quantity integer,p_ttl_seconds integer DEFAULT 900)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.gh_marketplace_listings%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE; v_exp timestamptz;
BEGIN
  IF COALESCE(trim(p_listing_id),'')='' OR COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_buyer_id),'')='' OR COALESCE(p_quantity,0)<1 OR p_quantity>99 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_RESERVATION');
  END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(p_order_id) FOR UPDATE;
  IF FOUND THEN
    IF r.listing_id=trim(p_listing_id) AND r.buyer_id=trim(p_buyer_id) AND r.quantity=p_quantity AND r.status='reserved' AND r.expires_at>now() THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'expiresAt',r.expires_at);
    END IF;
    RETURN jsonb_build_object('ok',false,'error','RESERVATION_CONFLICT');
  END IF;
  SELECT * INTO l FROM public.gh_marketplace_listings WHERE id=trim(p_listing_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_NOT_FOUND'); END IF;
  IF l.status<>'active' THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE','status',l.status); END IF;
  IF l.availability<p_quantity THEN RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_STOCK','available',l.availability); END IF;
  PERFORM set_config('ghc.marketplace_reserving','on',true);
  UPDATE public.gh_marketplace_listings SET availability=availability-p_quantity,
    status=CASE WHEN availability-p_quantity<=0 THEN 'sold_out' ELSE status END,updated_at=now() WHERE id=l.id;
  v_exp:=now()+make_interval(secs=>LEAST(3600,GREATEST(60,COALESCE(p_ttl_seconds,900))));
  INSERT INTO public.gh_marketplace_stock_reservations(order_id,listing_id,buyer_id,quantity,status,expires_at)
  VALUES(trim(p_order_id),l.id,trim(p_buyer_id),p_quantity,'reserved',v_exp);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'expiresAt',v_exp,'remaining',l.availability-p_quantity);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_release(p_order_id text,p_final_status text DEFAULT 'released')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_stock_reservations%ROWTYPE;
BEGIN
  IF p_final_status NOT IN ('released','expired') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_FINAL_STATUS'); END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'released',false,'reason','NOT_FOUND'); END IF;
  IF r.status IN ('released','expired') THEN RETURN jsonb_build_object('ok',true,'released',false,'duplicate',true); END IF;
  IF r.status='committed' THEN RETURN jsonb_build_object('ok',false,'error','STOCK_ALREADY_COMMITTED'); END IF;
  UPDATE public.gh_marketplace_stock_reservations SET status=p_final_status,updated_at=now() WHERE order_id=r.order_id;
  PERFORM set_config('ghc.marketplace_reserving','on',true);
  UPDATE public.gh_marketplace_listings SET availability=availability+r.quantity,
    status=CASE WHEN status='sold_out' THEN 'active' ELSE status END,updated_at=now() WHERE id=r.listing_id;
  RETURN jsonb_build_object('ok',true,'released',true,'quantity',r.quantity);
END; $$;

-- Refunds must go through a provider-verified refund workflow. Do not allow a status-only refund.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_transition_atomic(p_order_id text,p_expected_status text,p_to_status text,p_actor_id text,p_detail text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE; allowed boolean:=false; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF r.status=p_to_status THEN RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',true); END IF;
  IF r.status<>p_expected_status THEN RETURN jsonb_build_object('ok',false,'error','STATE_CONFLICT','status',r.status); END IF;
  IF p_to_status='completed' AND trim(COALESCE(p_actor_id,''))<>r.buyer_id THEN RETURN jsonb_build_object('ok',false,'error','BUYER_CONFIRMATION_REQUIRED'); END IF;
  IF p_to_status='refunded' THEN RETURN jsonb_build_object('ok',false,'error','REFUND_PROVIDER_WORKFLOW_REQUIRED'); END IF;
  IF p_to_status='cancelled' AND r.payment_status='verified' THEN RETURN jsonb_build_object('ok',false,'error','PAID_ORDER_CANCEL_REQUIRES_REFUND'); END IF;
  allowed := CASE r.status
    WHEN 'created' THEN p_to_status IN ('payment_pending','cancelled')
    WHEN 'payment_pending' THEN p_to_status IN ('payment_verified','cancelled')
    WHEN 'payment_verified' THEN p_to_status IN ('confirmed','cancelled')
    WHEN 'confirmed' THEN p_to_status IN ('fulfilling','cancelled','disputed')
    WHEN 'fulfilling' THEN p_to_status IN ('completed','disputed')
    WHEN 'completed' THEN false
    WHEN 'disputed' THEN p_to_status IN ('completed','cancelled')
    ELSE false END;
  IF NOT allowed THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
  IF p_to_status IN ('confirmed','fulfilling','completed','disputed') AND r.payment_status<>'verified' THEN
    RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED');
  END IF;
  UPDATE public.gh_marketplace_orders SET status=p_to_status,updated_at=now_ts,
    confirmed_at=CASE WHEN p_to_status='confirmed' THEN now_ts ELSE confirmed_at END,
    fulfilled_at=CASE WHEN p_to_status='fulfilling' THEN now_ts ELSE fulfilled_at END,
    completed_at=CASE WHEN p_to_status='completed' THEN now_ts ELSE completed_at END,
    cancelled_at=CASE WHEN p_to_status='cancelled' THEN now_ts ELSE cancelled_at END,
    audit=COALESCE(audit,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('at',extract(epoch from now_ts)*1000,'action',p_to_status,'detail',trim(COALESCE(p_actor_id,'') || CASE WHEN COALESCE(p_detail,'')<>'' THEN ':'||p_detail ELSE '' END)))
    WHERE id=r.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||r.id||':'||p_to_status,'marketplace_order',r.id,p_actor_id,
    jsonb_build_object('from',r.status,'to',p_to_status,'buyerId',r.buyer_id,'sellerId',r.seller_id,'totalAmount',r.total_amount,'currency',r.currency),1);
  IF p_to_status='cancelled' THEN PERFORM public.gh_marketplace_stock_release(r.id,'released'); END IF;
  RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',false);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_validate(p_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_stock_reservations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(COALESCE(p_order_id,''));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','RESERVATION_NOT_FOUND'); END IF;
  IF r.status<>'reserved' THEN RETURN jsonb_build_object('ok',false,'error','RESERVATION_NOT_ACTIVE','status',r.status); END IF;
  IF r.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'error','RESERVATION_EXPIRED'); END IF;
  RETURN jsonb_build_object('ok',true,'expiresAt',r.expires_at,'quantity',r.quantity);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_validate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_validate(text) TO service_role;

-- Ledger-linked GHC marketplace refund. It only operates on a disputed GHC order;
-- Pi refunds remain blocked until a provider-verified refund integration exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_transaction_reversal_of
  ON public.ghc_transactions ((metadata->>'reversal_of'))
  WHERE kind='reversed' AND metadata ? 'reversal_of';

CREATE OR REPLACE FUNCTION public.gh_marketplace_refund_ghc(p_order_id text,p_actor_id text,p_reason text DEFAULT 'Marketplace dispute resolution')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; original public.ghc_transactions%ROWTYPE; reversal_id uuid; v_ref text;
BEGIN
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF trim(COALESCE(p_actor_id,'')) NOT IN (o.buyer_id,o.seller_id) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF o.status='refunded' AND o.payment_status='refunded' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'orderId',o.id); END IF;
  IF o.status<>'disputed' THEN RETURN jsonb_build_object('ok',false,'error','DISPUTE_REQUIRED'); END IF;
  IF o.payment_status<>'verified' OR o.payment_method<>'ghc' OR COALESCE(o.ghc_spend_ref,'')='' THEN
    RETURN jsonb_build_object('ok',false,'error','GHC_PAYMENT_REQUIRED');
  END IF;
  v_ref:=o.ghc_spend_ref;
  PERFORM pg_advisory_xact_lock(hashtext('ghc_refund:'||o.buyer_id));
  SELECT * INTO original FROM public.ghc_transactions
    WHERE user_id=o.buyer_id AND reference_id=v_ref AND kind='spent' AND status='posted' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORIGINAL_SPEND_NOT_FOUND'); END IF;
  IF EXISTS(SELECT 1 FROM public.ghc_transactions WHERE kind='reversed' AND metadata->>'reversal_of'=original.id::text) THEN
    UPDATE public.gh_marketplace_orders SET status='refunded',payment_status='refunded',updated_at=now() WHERE id=o.id;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'orderId',o.id);
  END IF;
  INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,metadata,created_at,posted_at)
  VALUES(o.buyer_id,'reversed',abs(original.amount),'posted',left(COALESCE(NULLIF(trim(p_reason),''),'Marketplace refund'),240),
    'MARKETPLACE_REFUND','refund:'||o.id,jsonb_build_object('reversal_of',original.id::text,'order_id',o.id,'original_reference_id',v_ref,'actor_id',p_actor_id),now(),now())
  RETURNING id INTO reversal_id;
  UPDATE public.gh_marketplace_orders SET status='refunded',payment_status='refunded',updated_at=now(),
    audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'action','refunded','detail',p_actor_id||':ledger-reversal:'||reversal_id::text))
    WHERE id=o.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.refund_completed','marketplace.refund:'||o.id,'marketplace_order',o.id,p_actor_id,
    jsonb_build_object('orderId',o.id,'buyerId',o.buyer_id,'sellerId',o.seller_id,'amount',abs(original.amount),'currency','GHC','reversalTransactionId',reversal_id),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'orderId',o.id,'reversalTransactionId',reversal_id,'amount',abs(original.amount));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','REFUND_CONFLICT');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_refund_ghc(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_refund_ghc(text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_reward_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source_event_id text NOT NULL,
  category text NOT NULL CHECK (category IN ('missing_reward','incorrect_amount','false_positive_hold','settlement_delay','other')),
  explanation text NOT NULL CHECK (length(trim(explanation)) BETWEEN 20 AND 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','upheld','released','reversed','withdrawn')),
  resolution_note text,
  reviewer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_reward_appeals_user ON public.gh_reward_appeals(user_id,created_at DESC);
ALTER TABLE public.gh_reward_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reward_appeals_no_client ON public.gh_reward_appeals;
CREATE POLICY gh_reward_appeals_no_client ON public.gh_reward_appeals FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT,UPDATE ON public.gh_reward_appeals TO service_role;

-- Final guarded progression award function: idempotency is global, actor-bound, and daily capped.
CREATE OR REPLACE FUNCTION public.gh_progression_award_xp(p_user_id text,p_event_type text,p_xp integer,p_idempotency_key text,p_source_ref text DEFAULT NULL,p_rules_version text DEFAULT 'progression-v1',p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_total integer; v_today integer; v_existing public.gh_progression_events%ROWTYPE; v_xp integer:=COALESCE(p_xp,0);
BEGIN
  IF COALESCE(trim(p_user_id),'')='' OR COALESCE(trim(p_event_type),'')='' OR COALESCE(trim(p_idempotency_key),'')='' OR v_xp<0 OR v_xp>10000 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  IF p_event_type NOT IN ('profile_completed','original_post_published','helpful_reply_verified','community_contribution_verified','marketplace_order_completed','learning_milestone') THEN
    RETURN jsonb_build_object('ok',false,'error','EVENT_NOT_AWARDABLE');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gh_xp:'||trim(p_user_id)));
  SELECT * INTO v_existing FROM public.gh_progression_events WHERE idempotency_key=trim(p_idempotency_key);
  IF FOUND THEN
    IF v_existing.user_id<>trim(p_user_id) THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT'); END IF;
    SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
    RETURN jsonb_build_object('ok',true,'duplicate',true,'eventId',v_existing.id,'totalXp',v_total,'rulesVersion',v_existing.rules_version);
  END IF;
  SELECT COALESCE(sum(xp),0)::integer INTO v_today FROM public.gh_progression_events WHERE user_id=trim(p_user_id) AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF p_event_type='marketplace_order_completed' AND (SELECT count(*) FROM public.gh_progression_events WHERE user_id=trim(p_user_id) AND event_type='marketplace_order_completed' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=3 THEN
    RETURN jsonb_build_object('ok',false,'error','DAILY_XP_EVENT_CAP');
  END IF;
  IF v_today+v_xp>100 THEN RETURN jsonb_build_object('ok',false,'error','DAILY_XP_CAP'); END IF;
  INSERT INTO public.gh_progression_events(user_id,event_type,xp,rules_version,idempotency_key,source_ref,metadata)
    VALUES(trim(p_user_id),p_event_type,v_xp,COALESCE(NULLIF(trim(p_rules_version),''),'progression-v1'),trim(p_idempotency_key),NULLIF(trim(COALESCE(p_source_ref,'')),''),COALESCE(p_metadata,'{}'::jsonb)) RETURNING id INTO v_id;
  SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
  PERFORM public.gh_domain_event_enqueue('progression.xp_awarded','progression.xp:'||trim(p_idempotency_key),'progression',v_id::text,trim(p_user_id),
    jsonb_build_object('userId',trim(p_user_id),'eventType',p_event_type,'xp',v_xp,'totalXp',v_total,'rulesVersion',COALESCE(p_rules_version,'progression-v1')),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'eventId',v_id,'xpAwarded',v_xp,'totalXp',v_total,'rulesVersion',COALESCE(p_rules_version,'progression-v1'));
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_transition_atomic(p_order_id text,p_expected_status text,p_to_status text,p_actor_id text,p_detail text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE; allowed boolean:=false; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF r.status=p_to_status THEN RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',true); END IF;
  IF r.status<>p_expected_status THEN RETURN jsonb_build_object('ok',false,'error','STATE_CONFLICT','status',r.status); END IF;
  IF p_to_status='completed' AND trim(COALESCE(p_actor_id,''))<>r.buyer_id THEN RETURN jsonb_build_object('ok',false,'error','BUYER_CONFIRMATION_REQUIRED'); END IF;
  IF p_to_status='refunded' THEN RETURN jsonb_build_object('ok',false,'error','REFUND_PROVIDER_WORKFLOW_REQUIRED'); END IF;
  IF p_to_status='cancelled' AND r.payment_status='verified' THEN RETURN jsonb_build_object('ok',false,'error','PAID_ORDER_CANCEL_REQUIRES_REFUND'); END IF;
  allowed := CASE r.status
    WHEN 'created' THEN p_to_status IN ('payment_pending','cancelled')
    WHEN 'payment_pending' THEN p_to_status IN ('payment_verified','cancelled')
    WHEN 'payment_verified' THEN p_to_status IN ('confirmed','cancelled')
    WHEN 'confirmed' THEN p_to_status IN ('fulfilling','cancelled','disputed')
    WHEN 'fulfilling' THEN p_to_status IN ('completed','disputed')
    WHEN 'completed' THEN false
    WHEN 'disputed' THEN p_to_status IN ('completed','cancelled')
    ELSE false END;
  IF NOT allowed THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
  IF p_to_status IN ('confirmed','fulfilling','completed','disputed') AND r.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_REQUIRED'); END IF;
  UPDATE public.gh_marketplace_orders SET status=p_to_status,updated_at=now_ts,
    confirmed_at=CASE WHEN p_to_status='confirmed' THEN now_ts ELSE confirmed_at END,
    fulfilled_at=CASE WHEN p_to_status='fulfilling' THEN now_ts ELSE fulfilled_at END,
    completed_at=CASE WHEN p_to_status='completed' THEN now_ts ELSE completed_at END,
    cancelled_at=CASE WHEN p_to_status='cancelled' THEN now_ts ELSE cancelled_at END,
    audit=COALESCE(audit,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('at',extract(epoch from now_ts)*1000,'action',p_to_status,'detail',trim(COALESCE(p_actor_id,'') || CASE WHEN COALESCE(p_detail,'')<>'' THEN ':'||p_detail ELSE '' END)))
    WHERE id=r.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||r.id||':'||p_to_status,'marketplace_order',r.id,p_actor_id,
    jsonb_build_object('from',r.status,'to',p_to_status,'buyerId',r.buyer_id,'sellerId',r.seller_id,'totalAmount',r.total_amount,'currency',r.currency),1);
  IF p_to_status='cancelled' THEN PERFORM public.gh_marketplace_stock_release(r.id,'released'); END IF;
  IF p_to_status='completed' THEN
    -- Acquire per-user progression locks in stable lexical order to avoid cross-order deadlocks.
    IF r.buyer_id < r.seller_id THEN
      PERFORM public.gh_progression_award_xp(r.buyer_id,'marketplace_order_completed',5,'marketplace-order:'||r.id||':buyer','order:'||r.id,'progression-v1',jsonb_build_object('side','buyer'));
      PERFORM public.gh_progression_award_xp(r.seller_id,'marketplace_order_completed',5,'marketplace-order:'||r.id||':seller','order:'||r.id,'progression-v1',jsonb_build_object('side','seller'));
    ELSE
      PERFORM public.gh_progression_award_xp(r.seller_id,'marketplace_order_completed',5,'marketplace-order:'||r.id||':seller','order:'||r.id,'progression-v1',jsonb_build_object('side','seller'));
      PERFORM public.gh_progression_award_xp(r.buyer_id,'marketplace_order_completed',5,'marketplace-order:'||r.id||':buyer','order:'||r.id,'progression-v1',jsonb_build_object('side','buyer'));
    END IF;
    PERFORM public.gh_growth_referral_qualify(r.buyer_id,'completed_marketplace_order','order:'||r.id);
    PERFORM public.gh_growth_referral_qualify(r.seller_id,'completed_marketplace_order','order:'||r.id);
  END IF;
  RETURN public.gh_marketplace_order_get(r.id) || jsonb_build_object('ok',true,'duplicate',false);
END; $$;

REVOKE ALL ON FUNCTION public.gh_progression_award_xp(text,text,integer,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_progression_award_xp(text,text,integer,text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_transition_atomic(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_transition_atomic(text,text,text,text,text) TO service_role;

-- Contextual trust dimensions; intentionally separate from money, membership, XP and privileges.
CREATE TABLE IF NOT EXISTS public.gh_trust_dimension_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('helpfulness','reliability','safety','expertise','transaction_trust')),
  delta integer NOT NULL CHECK (delta BETWEEN -100 AND 100),
  source_type text NOT NULL CHECK (source_type IN ('verified_order_review','moderation_decision','verified_helpful_contribution','verified_reliability_event','admin_correction')),
  source_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_trust_dimension_user ON public.gh_trust_dimension_events(user_id,dimension,created_at DESC);
ALTER TABLE public.gh_trust_dimension_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_trust_dimension_events_no_client ON public.gh_trust_dimension_events;
CREATE POLICY gh_trust_dimension_events_no_client ON public.gh_trust_dimension_events FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT ON public.gh_trust_dimension_events TO service_role;

CREATE OR REPLACE FUNCTION public.gh_trust_dimension_record(p_user_id text,p_dimension text,p_delta integer,p_source_type text,p_source_ref text,p_idempotency_key text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF COALESCE(trim(p_user_id),'')='' OR p_dimension NOT IN ('helpfulness','reliability','safety','expertise','transaction_trust') OR COALESCE(p_delta,0) NOT BETWEEN -100 AND 100 OR COALESCE(trim(p_source_ref),'')='' OR COALESCE(trim(p_idempotency_key),'')='' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_TRUST_EVENT');
  END IF;
  IF p_source_type NOT IN ('verified_order_review','moderation_decision','verified_helpful_contribution','verified_reliability_event','admin_correction') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_SOURCE_TYPE');
  END IF;
  INSERT INTO public.gh_trust_dimension_events(user_id,dimension,delta,source_type,source_ref,idempotency_key,metadata)
    VALUES(trim(p_user_id),p_dimension,p_delta,p_source_type,trim(p_source_ref),trim(p_idempotency_key),COALESCE(p_metadata,'{}'::jsonb))
    ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'eventId',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_trust_dimensions_get(p_user_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('ok',true,'dimensions',COALESCE((
    SELECT jsonb_object_agg(dimension,score) FROM (
      SELECT dimension,GREATEST(-1000,LEAST(1000,sum(delta)))::integer AS score
      FROM public.gh_trust_dimension_events WHERE user_id=trim(COALESCE(p_user_id,'')) GROUP BY dimension
    ) totals
  ),'{}'::jsonb),'eventCount',(SELECT count(*) FROM public.gh_trust_dimension_events WHERE user_id=trim(COALESCE(p_user_id,''))))
$$;
REVOKE ALL ON FUNCTION public.gh_trust_dimension_record(text,text,integer,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_trust_dimensions_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_trust_dimension_record(text,text,integer,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_trust_dimensions_get(text) TO service_role;

-- Attach a bounded contextual trust signal to a completed, verified order review.
CREATE OR REPLACE FUNCTION public.gh_marketplace_review_create(p_order_id text,p_reviewer_id text,p_rating integer,p_review_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; v_id uuid; v_delta integer;
BEGIN
  IF COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_reviewer_id),'')='' OR COALESCE(p_rating,0) NOT BETWEEN 1 AND 5 OR length(trim(COALESCE(p_review_text,''))) NOT BETWEEN 3 AND 2000 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_REVIEW');
  END IF;
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','BUYER_ONLY'); END IF;
  IF o.seller_id=trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','SELF_REVIEW'); END IF;
  IF o.status<>'completed' OR o.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_COMPLETED_ORDER_REQUIRED'); END IF;
  INSERT INTO public.gh_marketplace_reviews(order_id,reviewer_id,seller_id,rating,review_text)
    VALUES(o.id,trim(p_reviewer_id),o.seller_id,p_rating,trim(p_review_text)) RETURNING id INTO v_id;
  v_delta:=p_rating-3;
  PERFORM public.gh_trust_dimension_record(o.seller_id,'transaction_trust',v_delta,'verified_order_review',o.id,'marketplace-review-trust:'||v_id::text,jsonb_build_object('reviewId',v_id,'ratingBand',CASE WHEN p_rating>=4 THEN 'positive' WHEN p_rating<=2 THEN 'negative' ELSE 'neutral' END));
  PERFORM public.gh_domain_event_enqueue('marketplace.review_submitted','marketplace.review-submitted:'||v_id::text,'marketplace_review',v_id::text,trim(p_reviewer_id),jsonb_build_object('orderId',o.id,'reviewerId',trim(p_reviewer_id),'sellerId',o.seller_id,'rating',p_rating),1);
  RETURN jsonb_build_object('ok',true,'reviewId',v_id,'status','published');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','REVIEW_ALREADY_EXISTS');
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_review_create(text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_review_create(text,text,integer,text) TO service_role;

-- Consistent hard privacy/block/mute filters on the server feed and post search.
CREATE OR REPLACE FUNCTION public.gh_post_list_feed(p_viewer_id text,p_limit integer DEFAULT 40,p_before_ms bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,40),1),100); v_rows jsonb;
BEGIN
  IF COALESCE(trim(p_viewer_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','VIEWER_REQUIRED','posts','[]'::jsonb); END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC),'[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id,p.author_id AS "authorId",p.author_name AS "authorName",p.author_photo AS "authorPhoto",p.content,p.images,p.video,p.pdf,p.pdf_name AS "pdfName",p.visibility,
      p.like_count AS likes,p.comment_count AS "commentCount",p.share_count AS shares,p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",(extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS(SELECT 1 FROM public.gh_post_reactions r WHERE r.post_id=p.id AND r.user_id=trim(p_viewer_id) AND r.reaction='like') AS "likedByMe"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (p.visibility='public' OR p.author_id=trim(p_viewer_id)
        OR (p.visibility='followers' AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id))
        OR (p.visibility='mutuals' AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id)
          AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=p.author_id AND f.following_id=trim(p_viewer_id))))
      AND NOT EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=trim(p_viewer_id)))
      AND NOT EXISTS(SELECT 1 FROM public.gh_user_mutes m WHERE m.muter_id=trim(p_viewer_id) AND m.muted_id=p.author_id)
      AND (p_before_ms IS NULL OR (extract(epoch from p.created_at)*1000)<p_before_ms)
    ORDER BY p.created_at DESC LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok',true,'posts',v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_list_feed(text,integer,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text,integer,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_search_posts(p_actor_id text,p_query text,p_limit integer DEFAULT 20,p_video_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q text:=lower(trim(COALESCE(p_query,''))); v_actor text:=trim(COALESCE(p_actor_id,'')); v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,20),1),40); v_rows jsonb;
BEGIN
  IF length(v_q)<2 OR length(v_q)>80 OR v_actor='' THEN RETURN jsonb_build_object('ok',true,'posts','[]'::jsonb); END IF;
  v_q:=replace(replace(replace(v_q,'\','\\'),'%','\%'),'_','\_');
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb),'[]'::jsonb) INTO v_rows FROM (
    SELECT p.id,p.author_id AS "authorId",p.author_name AS "authorName",p.author_photo AS "authorPhoto",left(p.content,280) AS "content",p.video,p.content_type AS "contentType",(extract(epoch from p.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL AND (lower(p.content) LIKE '%'||v_q||'%' ESCAPE '\' OR lower(COALESCE(p.author_name,'')) LIKE '%'||v_q||'%' ESCAPE '\')
      AND (NOT p_video_only OR (p.video IS NOT NULL AND length(trim(p.video))>0 AND p.video NOT LIKE 'blob:%'))
      AND (p.visibility='public' OR p.author_id=v_actor
        OR (p.visibility='followers' AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=v_actor AND f.following_id=p.author_id))
        OR (p.visibility='mutuals' AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=v_actor AND f.following_id=p.author_id)
          AND EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=p.author_id AND f.following_id=v_actor)))
      AND NOT EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=v_actor AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=v_actor))
      AND NOT EXISTS(SELECT 1 FROM public.gh_user_mutes m WHERE m.muter_id=v_actor AND m.muted_id=p.author_id)
    ORDER BY p.created_at DESC LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok',true,'posts',v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_search_posts(text,text,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_posts(text,text,integer,boolean) TO service_role;

ALTER TABLE public.gh_marketplace_reviews ADD COLUMN IF NOT EXISTS published_at timestamptz;
-- Keep reviews blind for seven days to reduce immediate retaliation; trust updates only on publication.
CREATE OR REPLACE FUNCTION public.gh_marketplace_review_create(p_order_id text,p_reviewer_id text,p_rating integer,p_review_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; v_id uuid;
BEGIN
  IF COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_reviewer_id),'')='' OR COALESCE(p_rating,0) NOT BETWEEN 1 AND 5 OR length(trim(COALESCE(p_review_text,''))) NOT BETWEEN 3 AND 2000 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_REVIEW'); END IF;
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(p_order_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','BUYER_ONLY'); END IF;
  IF o.seller_id=trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','SELF_REVIEW'); END IF;
  IF o.status<>'completed' OR o.payment_status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_COMPLETED_ORDER_REQUIRED'); END IF;
  INSERT INTO public.gh_marketplace_reviews(order_id,reviewer_id,seller_id,rating,review_text,status)
    VALUES(o.id,trim(p_reviewer_id),o.seller_id,p_rating,trim(p_review_text),'under_review') RETURNING id INTO v_id;
  PERFORM public.gh_domain_event_enqueue('marketplace.review_submitted','marketplace.review-submitted:'||v_id::text,'marketplace_review',v_id::text,trim(p_reviewer_id),jsonb_build_object('orderId',o.id,'reviewerId',trim(p_reviewer_id),'sellerId',o.seller_id,'rating',p_rating,'publicationDelayDays',7),1);
  RETURN jsonb_build_object('ok',true,'reviewId',v_id,'status','under_review','publicationDelayDays',7);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','REVIEW_ALREADY_EXISTS');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_reviews_publish_matured(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT id,user_id,seller_id,rating,order_id FROM (
      SELECT id,reviewer_id AS user_id,seller_id,rating,order_id,created_at FROM public.gh_marketplace_reviews
      WHERE status='under_review' AND created_at<=now()-interval '7 days'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(500,GREATEST(1,COALESCE(p_limit,100)))
    ) mature LOOP
    UPDATE public.gh_marketplace_reviews SET status='published',published_at=now() WHERE id=r.id AND status='under_review';
    IF FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM public.gh_trust_dimension_events te WHERE te.user_id=r.seller_id AND te.dimension='transaction_trust' AND te.metadata->>'reviewerId'=r.user_id AND te.created_at>now()-interval '24 hours') THEN
        PERFORM public.gh_trust_dimension_record(r.seller_id,'transaction_trust',r.rating-3,'verified_order_review',r.order_id,'marketplace-review-trust:'||r.id::text,jsonb_build_object('reviewId',r.id,'reviewerId',r.user_id,'ratingBand',CASE WHEN r.rating>=4 THEN 'positive' WHEN r.rating<=2 THEN 'negative' ELSE 'neutral' END));
      END IF;
      PERFORM public.gh_domain_event_enqueue('reputation.review_verified','reputation.review-published:'||r.id::text,'marketplace_review',r.id::text,NULL,jsonb_build_object('reviewId',r.id,'sellerId',r.seller_id,'rating',r.rating),1);
      n:=n+1;
    END IF;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_reviews_publish_matured(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_reviews_publish_matured(integer) TO service_role;

-- Policy registry for audited emergency switches and versioned server-owned economy rules.
CREATE TABLE IF NOT EXISTS public.gh_ecosystem_policy (
  policy_key text PRIMARY KEY CHECK (length(trim(policy_key)) BETWEEN 1 AND 100),
  policy_value jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(policy_value)='object'),
  rules_version text NOT NULL DEFAULT 'v1',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_ecosystem_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_ecosystem_policy_no_client ON public.gh_ecosystem_policy;
CREATE POLICY gh_ecosystem_policy_no_client ON public.gh_ecosystem_policy FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT,UPDATE ON public.gh_ecosystem_policy TO service_role;
INSERT INTO public.gh_ecosystem_policy(policy_key,policy_value,rules_version) VALUES
  ('rewards',jsonb_build_object('enabled',true,'dailyCapGhc',5),'rewards-v1'),
  ('ranking',jsonb_build_object('enabled',true,'version','for-you-v2-diversity'),'ranking-v2'),
  ('progression',jsonb_build_object('enabled',true,'dailyXpCap',100),'progression-v1'),
  ('growth',jsonb_build_object('enabled',true,'referralRewardsEnabled',false),'growth-v1'),
  ('reputation',jsonb_build_object('enabled',true,'clientMutationEnabled',false),'reputation-v1'),
  ('marketplace',jsonb_build_object('enabled',true,'finiteStockRequiresReservation',true,'piRefundEnabled',false),'marketplace-v1')
ON CONFLICT(policy_key) DO NOTHING;

-- Append-only transaction provenance events are emitted in the same ledger transaction.
CREATE OR REPLACE FUNCTION public.ghc_ledger_outbox_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='posted' AND NEW.kind IN ('earned','pending','reversed','adjusted') THEN
    PERFORM public.gh_domain_event_enqueue('ledger.entry_recorded','ledger-entry:'||NEW.id::text,'ghc_transaction',NEW.id::text,NEW.user_id,
      jsonb_build_object('transactionId',NEW.id,'userId',NEW.user_id,'kind',NEW.kind,'amount',NEW.amount,'status',NEW.status,'sourceEvent',left(NEW.source_event,80),'referenceId',left(COALESCE(NEW.reference_id,''),128)),1);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ghc_ledger_outbox_after_insert_trg ON public.ghc_transactions;
CREATE TRIGGER ghc_ledger_outbox_after_insert_trg AFTER INSERT ON public.ghc_transactions
FOR EACH ROW EXECUTE FUNCTION public.ghc_ledger_outbox_after_insert();

-- Operations-only reconciliation summary; balances are derived from posted ledger rows.
CREATE OR REPLACE FUNCTION public.ghc_ledger_reconciliation_report(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_users integer; v_negative integer; v_total numeric; v_posted integer; v_pending integer;
BEGIN
  SELECT count(*)::integer,COALESCE(sum(balance),0),count(*) FILTER(WHERE balance<0)::integer
  INTO v_users,v_total,v_negative FROM (
    SELECT user_id,COALESCE(sum(amount) FILTER(WHERE status='posted' AND kind<>'transfer_request'),0) AS balance
    FROM public.ghc_transactions GROUP BY user_id
  ) balances;
  SELECT count(*)::integer INTO v_posted FROM public.ghc_transactions WHERE status='posted';
  SELECT count(*)::integer INTO v_pending FROM public.ghc_transactions WHERE status='pending';
  RETURN jsonb_build_object('ok',true,'users',v_users,'negativeBalanceUsers',v_negative,'aggregateLedgerBalance',v_total,'postedTransactions',v_posted,'pendingTransactions',v_pending,'checkedAt',now(),'alertRequired',v_negative>0);
END; $$;
REVOKE ALL ON FUNCTION public.ghc_ledger_reconciliation_report(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_ledger_reconciliation_report(integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_marketplace_listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.gh_marketplace_listings(id) ON DELETE RESTRICT,
  reporter_id text NOT NULL,
  seller_id text NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('prohibited_item','counterfeit','scam','misleading_listing','unsafe_service','wrong_category','other')),
  details text NOT NULL CHECK (length(trim(details)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','upheld','dismissed')),
  reviewer_id text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> seller_id),
  UNIQUE(listing_id,reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_market_listing_reports_status ON public.gh_marketplace_listing_reports(status,created_at DESC);
ALTER TABLE public.gh_marketplace_listing_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_market_listing_reports_no_client ON public.gh_marketplace_listing_reports;
CREATE POLICY gh_market_listing_reports_no_client ON public.gh_marketplace_listing_reports FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT,UPDATE ON public.gh_marketplace_listing_reports TO service_role;

-- Atomic GHC marketplace settlement: ledger debit, stock commit, order confirmation and outbox share one transaction.
CREATE OR REPLACE FUNCTION public.gh_marketplace_pay_ghc_atomic(p_order_id text,p_buyer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE; v_spend jsonb; v_ref text; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(COALESCE(p_buyer_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF o.payment_status='verified' AND o.payment_method='ghc' AND o.status IN ('payment_verified','confirmed','fulfilling','completed') THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'order',public.gh_marketplace_order_get(o.id),'referenceId',o.ghc_spend_ref);
  END IF;
  IF o.status NOT IN ('created','payment_pending') OR o.payment_status NOT IN ('none','pending','failed') THEN RETURN jsonb_build_object('ok',false,'error','NOT_PAYABLE'); END IF;
  IF o.currency<>'GHC' OR o.total_amount<=0 OR o.unit_price<=0 OR o.total_amount<>round(o.total_amount,4) OR o.total_amount<>round(o.unit_price*o.quantity,4) THEN RETURN jsonb_build_object('ok',false,'error','INVALID_GHC_ORDER_AMOUNT'); END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=o.id FOR UPDATE;
  IF NOT FOUND OR r.status<>'reserved' OR r.expires_at<=now_ts OR r.buyer_id<>o.buyer_id OR r.quantity<>o.quantity OR r.listing_id<>o.listing_id THEN
    RETURN jsonb_build_object('ok',false,'error','STOCK_RESERVATION_INVALID');
  END IF;
  PERFORM 1 FROM public.gh_marketplace_listings WHERE id=o.listing_id AND status IN ('active','sold_out') AND seller_id=o.seller_id AND seller_id<>o.buyer_id AND currency=o.currency FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE'); END IF;
  v_ref:='market_order_'||o.id;
  v_spend:=public.ghc_execute_spend(o.buyer_id,o.total_amount,v_ref,'Marketplace order '||left(o.listing_title,180),'MARKETPLACE_PURCHASE');
  IF COALESCE(v_spend->>'ok','false')<>'true' THEN RETURN jsonb_build_object('ok',false,'error',COALESCE(v_spend->>'error','SPEND_FAILED'),'detail',v_spend); END IF;
  UPDATE public.gh_marketplace_stock_reservations SET status='committed',updated_at=now_ts WHERE order_id=o.id AND status='reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_COMMIT_RACE'; END IF;
  UPDATE public.gh_marketplace_orders SET payment_method='ghc',payment_status='verified',ghc_spend_ref=v_ref,status='confirmed',confirmed_at=now_ts,updated_at=now_ts,
    audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','PAY_GHC','detail',v_ref),
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','confirmed','detail','system:atomic_payment_confirmation'))
    WHERE id=o.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':payment_verified','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from',o.status,'to','payment_verified','paymentMethod','ghc'),1);
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':confirmed','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from','payment_verified','to','confirmed','paymentMethod','ghc'),1);
  RETURN jsonb_build_object('ok',true,'duplicate',COALESCE((v_spend->>'idempotent')::boolean,false),'order',public.gh_marketplace_order_get(o.id),'spend',v_spend,'referenceId',v_ref);
END; $$;

-- Atomic finalization of a provider-completed PI intent against the exact order/amount/currency.
CREATE OR REPLACE FUNCTION public.gh_marketplace_pay_pi_atomic(p_order_id text,p_buyer_id text,p_intent_id text,p_payment_id text DEFAULT NULL,p_txid text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE; i public.ghc_payment_intents%ROWTYPE; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(COALESCE(p_buyer_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF o.payment_status='verified' AND o.payment_method='pi' AND o.payment_intent_id=trim(COALESCE(p_intent_id,'')) AND o.status IN ('payment_verified','confirmed','fulfilling','completed') THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'order',public.gh_marketplace_order_get(o.id));
  END IF;
  IF o.status NOT IN ('created','payment_pending') OR o.currency<>'PI' OR o.total_amount<=0 OR o.unit_price<=0 OR o.total_amount<>round(o.total_amount,8) OR o.total_amount<>round(o.unit_price*o.quantity,8) THEN RETURN jsonb_build_object('ok',false,'error','NOT_PAYABLE'); END IF;
  SELECT * INTO i FROM public.ghc_payment_intents WHERE id=trim(COALESCE(p_intent_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','INTENT_NOT_FOUND'); END IF;
  IF i.user_id<>o.buyer_id OR i.provider<>'pi' OR i.purpose<>'marketplace' OR i.currency<>'PI' OR i.reference_id<>'market_order_'||o.id OR i.status NOT IN ('COMPLETED','FULFILLED') OR COALESCE(trim(i.provider_payment_id),'')='' OR COALESCE(trim(i.txid),'')='' OR abs(i.amount-o.total_amount)>0.00000001 THEN
    RETURN jsonb_build_object('ok',false,'error','PAYMENT_INTENT_ORDER_MISMATCH');
  END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=o.id FOR UPDATE;
  IF NOT FOUND OR r.status<>'reserved' OR r.expires_at<=now_ts OR r.buyer_id<>o.buyer_id OR r.quantity<>o.quantity OR r.listing_id<>o.listing_id THEN
    RETURN jsonb_build_object('ok',false,'error','STOCK_RESERVATION_INVALID');
  END IF;
  PERFORM 1 FROM public.gh_marketplace_listings WHERE id=o.listing_id AND status IN ('active','sold_out') AND seller_id=o.seller_id AND seller_id<>o.buyer_id AND currency=o.currency FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE'); END IF;
  UPDATE public.gh_marketplace_stock_reservations SET status='committed',updated_at=now_ts WHERE order_id=o.id AND status='reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_COMMIT_RACE'; END IF;
  UPDATE public.gh_marketplace_orders SET payment_method='pi',payment_status='verified',payment_intent_id=i.id,
    payment_id=i.provider_payment_id,txid=i.txid,
    status='confirmed',confirmed_at=now_ts,updated_at=now_ts,
    audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','PAY_PI','detail',i.id),
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','confirmed','detail','system:atomic_payment_confirmation'))
    WHERE id=o.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':payment_verified','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from',o.status,'to','payment_verified','paymentMethod','pi'),1);
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':confirmed','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from','payment_verified','to','confirmed','paymentMethod','pi'),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'order',public.gh_marketplace_order_get(o.id),'paymentIntentId',i.id);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_pay_ghc_atomic(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_pay_pi_atomic(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_pay_ghc_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_pay_pi_atomic(text,text,text,text,text) TO service_role;

-- Expiry must never release a stock reservation for a payment-verified order.
CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_expire(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT s.order_id FROM public.gh_marketplace_stock_reservations s
    WHERE s.status='reserved' AND s.expires_at<=now()
      AND NOT EXISTS(SELECT 1 FROM public.gh_marketplace_orders o WHERE o.id=s.order_id AND o.payment_status='verified')
    ORDER BY s.expires_at FOR UPDATE SKIP LOCKED LIMIT LEAST(500,GREATEST(1,COALESCE(p_limit,100))) LOOP
    PERFORM public.gh_marketplace_stock_release(r.order_id,'expired'); n:=n+1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_expire(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_expire(integer) TO service_role;

-- Mark the provider intent fulfilled in the same transaction as marketplace order finalization.
CREATE OR REPLACE FUNCTION public.gh_marketplace_pay_pi_atomic(p_order_id text,p_buyer_id text,p_intent_id text,p_payment_id text DEFAULT NULL,p_txid text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.gh_marketplace_orders%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE; i public.ghc_payment_intents%ROWTYPE; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO o FROM public.gh_marketplace_orders WHERE id=trim(COALESCE(p_order_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','ORDER_NOT_FOUND'); END IF;
  IF o.buyer_id<>trim(COALESCE(p_buyer_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF o.payment_status='verified' AND o.payment_method='pi' AND o.payment_intent_id=trim(COALESCE(p_intent_id,'')) AND o.status IN ('payment_verified','confirmed','fulfilling','completed') THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'order',public.gh_marketplace_order_get(o.id));
  END IF;
  IF o.status NOT IN ('created','payment_pending') OR o.currency<>'PI' OR o.total_amount<=0 OR o.unit_price<=0 OR o.total_amount<>round(o.total_amount,8) OR o.total_amount<>round(o.unit_price*o.quantity,8) THEN RETURN jsonb_build_object('ok',false,'error','NOT_PAYABLE'); END IF;
  SELECT * INTO i FROM public.ghc_payment_intents WHERE id=trim(COALESCE(p_intent_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','INTENT_NOT_FOUND'); END IF;
  IF i.user_id<>o.buyer_id OR i.provider<>'pi' OR i.purpose<>'marketplace' OR i.currency<>'PI' OR i.reference_id<>'market_order_'||o.id OR i.status NOT IN ('COMPLETED','FULFILLED') OR COALESCE(trim(i.provider_payment_id),'')='' OR COALESCE(trim(i.txid),'')='' OR abs(i.amount-o.total_amount)>0.00000001 THEN
    RETURN jsonb_build_object('ok',false,'error','PAYMENT_INTENT_ORDER_MISMATCH');
  END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=o.id FOR UPDATE;
  IF NOT FOUND OR r.status<>'reserved' OR r.expires_at<=now_ts OR r.buyer_id<>o.buyer_id OR r.quantity<>o.quantity OR r.listing_id<>o.listing_id THEN
    RETURN jsonb_build_object('ok',false,'error','STOCK_RESERVATION_INVALID');
  END IF;
  PERFORM 1 FROM public.gh_marketplace_listings WHERE id=o.listing_id AND status IN ('active','sold_out') AND seller_id=o.seller_id AND seller_id<>o.buyer_id AND currency=o.currency FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE'); END IF;
  UPDATE public.gh_marketplace_stock_reservations SET status='committed',updated_at=now_ts WHERE order_id=o.id AND status='reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_COMMIT_RACE'; END IF;
  UPDATE public.ghc_payment_intents SET status='FULFILLED',fulfilled_at=COALESCE(fulfilled_at,now_ts),updated_at=now_ts,
    audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','MARKETPLACE_FULFILLED','detail',o.id))
    WHERE id=i.id AND status IN ('COMPLETED','FULFILLED');
  UPDATE public.gh_marketplace_orders SET payment_method='pi',payment_status='verified',payment_intent_id=i.id,
    payment_id=i.provider_payment_id,txid=i.txid,status='confirmed',confirmed_at=now_ts,updated_at=now_ts,
    audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','PAY_PI','detail',i.id),
      jsonb_build_object('at',extract(epoch from now_ts)*1000,'action','confirmed','detail','system:atomic_payment_confirmation'))
    WHERE id=o.id;
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':payment_verified','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from',o.status,'to','payment_verified','paymentMethod','pi'),1);
  PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||o.id||':confirmed','marketplace_order',o.id,o.buyer_id,jsonb_build_object('from','payment_verified','to','confirmed','paymentMethod','pi'),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'order',public.gh_marketplace_order_get(o.id),'paymentIntentId',i.id);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_pay_pi_atomic(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_pay_pi_atomic(text,text,text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_marketplace_order_idempotency (
  buyer_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  request_fingerprint text NOT NULL CHECK (length(trim(request_fingerprint)) BETWEEN 1 AND 256),
  order_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(buyer_id,idempotency_key)
);
ALTER TABLE public.gh_marketplace_order_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_market_order_idempotency_no_client ON public.gh_marketplace_order_idempotency;
CREATE POLICY gh_market_order_idempotency_no_client ON public.gh_marketplace_order_idempotency FOR ALL USING(false) WITH CHECK(false);
GRANT SELECT,INSERT ON public.gh_marketplace_order_idempotency TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_idempotency_claim(p_buyer_id text,p_idempotency_key text,p_request_fingerprint text,p_proposed_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_order_idempotency%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_buyer_id),'')='' OR length(trim(COALESCE(p_idempotency_key,''))) NOT BETWEEN 8 AND 128 OR COALESCE(trim(p_request_fingerprint),'')='' OR COALESCE(trim(p_proposed_order_id),'')='' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_IDEMPOTENCY_INPUT');
  END IF;
  INSERT INTO public.gh_marketplace_order_idempotency(buyer_id,idempotency_key,request_fingerprint,order_id)
    VALUES(trim(p_buyer_id),trim(p_idempotency_key),trim(p_request_fingerprint),trim(p_proposed_order_id))
    ON CONFLICT(buyer_id,idempotency_key) DO NOTHING;
  SELECT * INTO r FROM public.gh_marketplace_order_idempotency WHERE buyer_id=trim(p_buyer_id) AND idempotency_key=trim(p_idempotency_key);
  IF r.request_fingerprint<>trim(p_request_fingerprint) THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',r.order_id<>trim(p_proposed_order_id),'orderId',r.order_id);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_idempotency_claim(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_idempotency_claim(text,text,text,text) TO service_role;

-- Permit safe recovery of a claimed idempotency key if order persistence failed after stock was released.
CREATE OR REPLACE FUNCTION public.gh_marketplace_stock_reserve(p_listing_id text,p_order_id text,p_buyer_id text,p_quantity integer,p_ttl_seconds integer DEFAULT 900)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.gh_marketplace_listings%ROWTYPE; r public.gh_marketplace_stock_reservations%ROWTYPE; v_exp timestamptz;
BEGIN
  IF COALESCE(trim(p_listing_id),'')='' OR COALESCE(trim(p_order_id),'')='' OR COALESCE(trim(p_buyer_id),'')='' OR COALESCE(p_quantity,0)<1 OR p_quantity>99 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RESERVATION'); END IF;
  SELECT * INTO r FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(p_order_id) FOR UPDATE;
  IF FOUND THEN
    IF r.listing_id=trim(p_listing_id) AND r.buyer_id=trim(p_buyer_id) AND r.quantity=p_quantity AND r.status='reserved' AND r.expires_at>now() THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'expiresAt',r.expires_at); END IF;
    IF r.status IN ('released','expired') AND NOT EXISTS(SELECT 1 FROM public.gh_marketplace_orders WHERE id=trim(p_order_id)) THEN
      DELETE FROM public.gh_marketplace_stock_reservations WHERE order_id=trim(p_order_id);
    ELSE
      RETURN jsonb_build_object('ok',false,'error','RESERVATION_CONFLICT');
    END IF;
  END IF;
  SELECT * INTO l FROM public.gh_marketplace_listings WHERE id=trim(p_listing_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','LISTING_NOT_FOUND'); END IF;
  IF l.status<>'active' THEN RETURN jsonb_build_object('ok',false,'error','LISTING_UNAVAILABLE','status',l.status); END IF;
  IF l.availability<p_quantity THEN RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_STOCK','available',l.availability); END IF;
  PERFORM set_config('ghc.marketplace_reserving','on',true);
  UPDATE public.gh_marketplace_listings SET availability=availability-p_quantity,status=CASE WHEN availability-p_quantity<=0 THEN 'sold_out' ELSE status END,updated_at=now() WHERE id=l.id;
  v_exp:=now()+make_interval(secs=>LEAST(3600,GREATEST(60,COALESCE(p_ttl_seconds,900))));
  INSERT INTO public.gh_marketplace_stock_reservations(order_id,listing_id,buyer_id,quantity,status,expires_at) VALUES(trim(p_order_id),l.id,trim(p_buyer_id),p_quantity,'reserved',v_exp);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'expiresAt',v_exp,'remaining',l.availability-p_quantity);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_stock_reserve(text,text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_stock_reserve(text,text,text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_progression_level_from_xp(p_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(p_xp,0)>=15500 THEN 20
    WHEN p_xp>=13800 THEN 19
    WHEN p_xp>=12200 THEN 18
    WHEN p_xp>=10700 THEN 17
    WHEN p_xp>=9300 THEN 16
    WHEN p_xp>=8000 THEN 15
    WHEN p_xp>=6800 THEN 14
    WHEN p_xp>=5700 THEN 13
    WHEN p_xp>=4700 THEN 12
    WHEN p_xp>=3800 THEN 11
    WHEN p_xp>=3000 THEN 10
    WHEN p_xp>=2300 THEN 9
    WHEN p_xp>=1700 THEN 8
    WHEN p_xp>=1200 THEN 7
    WHEN p_xp>=800 THEN 6
    WHEN p_xp>=500 THEN 5
    WHEN p_xp>=300 THEN 4
    WHEN p_xp>=150 THEN 3
    WHEN p_xp>=50 THEN 2
    ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.gh_progression_get(p_user_id text,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total integer; v_events jsonb; v_level integer; v_next_floor integer; v_floor integer;
BEGIN
  IF COALESCE(trim(p_user_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','USER_REQUIRED'); END IF;
  SELECT COALESCE(sum(xp),0)::integer INTO v_total FROM public.gh_progression_events WHERE user_id=trim(p_user_id);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'eventType',event_type,'xp',xp,'rulesVersion',rules_version,'sourceRef',source_ref,'createdAt',created_at) ORDER BY created_at DESC),'[]'::jsonb)
    INTO v_events FROM (SELECT * FROM public.gh_progression_events WHERE user_id=trim(p_user_id) ORDER BY created_at DESC LIMIT LEAST(100,GREATEST(1,COALESCE(p_limit,50)))) recent;
  v_level:=public.gh_progression_level_from_xp(v_total);
  v_floor:=CASE v_level WHEN 1 THEN 0 WHEN 2 THEN 50 WHEN 3 THEN 150 WHEN 4 THEN 300 WHEN 5 THEN 500 WHEN 6 THEN 800 WHEN 7 THEN 1200 WHEN 8 THEN 1700 WHEN 9 THEN 2300 WHEN 10 THEN 3000 WHEN 11 THEN 3800 WHEN 12 THEN 4700 WHEN 13 THEN 5700 WHEN 14 THEN 6800 WHEN 15 THEN 8000 WHEN 16 THEN 9300 WHEN 17 THEN 10700 WHEN 18 THEN 12200 WHEN 19 THEN 13800 ELSE 15500 END;
  v_next_floor:=CASE WHEN v_level>=20 THEN v_floor ELSE CASE v_level+1 WHEN 2 THEN 50 WHEN 3 THEN 150 WHEN 4 THEN 300 WHEN 5 THEN 500 WHEN 6 THEN 800 WHEN 7 THEN 1200 WHEN 8 THEN 1700 WHEN 9 THEN 2300 WHEN 10 THEN 3000 WHEN 11 THEN 3800 WHEN 12 THEN 4700 WHEN 13 THEN 5700 WHEN 14 THEN 6800 WHEN 15 THEN 8000 WHEN 16 THEN 9300 WHEN 17 THEN 10700 WHEN 18 THEN 12200 WHEN 19 THEN 13800 ELSE 15500 END END;
  RETURN jsonb_build_object('ok',true,'totalXp',v_total,'level',v_level,'nextLevel',CASE WHEN v_level>=20 THEN NULL ELSE v_level+1 END,'pointsToNext',GREATEST(0,v_next_floor-v_total),'progressRatio',CASE WHEN v_level>=20 THEN 1 ELSE LEAST(1,GREATEST(0,(v_total-v_floor)::numeric/GREATEST(1,v_next_floor-v_floor))) END,'rulesVersion','progression-v1','events',v_events);
END; $$;
REVOKE ALL ON FUNCTION public.gh_progression_get(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_progression_get(text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_report_resolve(p_report_id uuid,p_reviewer_id text,p_status text,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gh_marketplace_listing_reports%ROWTYPE; s record;
BEGIN
  IF p_status NOT IN ('under_review','upheld','dismissed') OR COALESCE(trim(p_reviewer_id),'')='' OR length(trim(COALESCE(p_note,'')))<10 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RESOLUTION'); END IF;
  SELECT * INTO r FROM public.gh_marketplace_listing_reports WHERE id=p_report_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REPORT_NOT_FOUND'); END IF;
  IF trim(p_reviewer_id) IN (r.reporter_id,r.seller_id) THEN RETURN jsonb_build_object('ok',false,'error','CONFLICT_OF_INTEREST'); END IF;
  IF r.status IN ('upheld','dismissed') THEN
    IF r.status=p_status THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',r.status); END IF;
    RETURN jsonb_build_object('ok',false,'error','REPORT_ALREADY_RESOLVED');
  END IF;
  UPDATE public.gh_marketplace_listing_reports SET status=p_status,reviewer_id=trim(p_reviewer_id),resolution_note=left(trim(p_note),2000),updated_at=now() WHERE id=r.id;
  IF p_status='upheld' THEN
    -- Release unpaid reservations before locking the listing row; payment uses the same reservation-first order.
    FOR s IN SELECT sr.order_id FROM public.gh_marketplace_stock_reservations sr WHERE sr.listing_id=r.listing_id AND sr.status='reserved' AND NOT EXISTS(SELECT 1 FROM public.gh_marketplace_orders o WHERE o.id=sr.order_id AND o.payment_status='verified') LOOP
      UPDATE public.gh_marketplace_orders SET status='cancelled',cancelled_at=now(),updated_at=now(),audit=COALESCE(audit,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'action','cancelled','detail','moderation:listing_report_upheld'))
        WHERE id=s.order_id AND payment_status<>'verified' AND status IN ('created','payment_pending');
      IF FOUND THEN
        PERFORM public.gh_domain_event_enqueue('marketplace.order_transitioned','market-order:'||s.order_id||':cancelled','marketplace_order',s.order_id,p_reviewer_id,jsonb_build_object('to','cancelled','reason','listing_report_upheld'),1);
      END IF;
      PERFORM public.gh_marketplace_stock_release(s.order_id,'released');
    END LOOP;
    UPDATE public.gh_marketplace_listings SET status='removed',updated_at=now() WHERE id=r.listing_id;
  END IF;
  PERFORM public.gh_domain_event_enqueue('marketplace.listing_moderated','marketplace.listing-report-resolved:'||r.id::text,'marketplace_listing',r.listing_id,p_reviewer_id,
    jsonb_build_object('reportId',r.id,'status',p_status,'reasonCode',r.reason_code),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'status',p_status,'listingId',r.listing_id);
END; $$;
REVOKE ALL ON FUNCTION public.gh_marketplace_listing_report_resolve(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_report_resolve(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_reward_appeal_resolve(p_appeal_id uuid,p_reviewer_id text,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.gh_reward_appeals%ROWTYPE; t public.ghc_transactions%ROWTYPE; v_reversal uuid;
BEGIN
  IF p_status NOT IN ('under_review','upheld','withdrawn','reversed') OR COALESCE(trim(p_reviewer_id),'')='' OR length(trim(COALESCE(p_note,'')))<10 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RESOLUTION'); END IF;
  SELECT * INTO a FROM public.gh_reward_appeals WHERE id=p_appeal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','APPEAL_NOT_FOUND'); END IF;
  IF a.user_id=trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','CONFLICT_OF_INTEREST'); END IF;
  IF a.status IN ('upheld','released','reversed','withdrawn') THEN
    IF a.status=p_status THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',a.status); END IF;
    RETURN jsonb_build_object('ok',false,'error','APPEAL_ALREADY_RESOLVED');
  END IF;
  IF p_status='reversed' THEN
    IF a.source_event_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('ok',false,'error','LEDGER_TRANSACTION_ID_REQUIRED','message','For a financial reversal, sourceEventId must be the original GHC ledger transaction UUID.');
    END IF;
    SELECT * INTO t FROM public.ghc_transactions WHERE id=a.source_event_id::uuid AND user_id=a.user_id FOR UPDATE;
    IF NOT FOUND OR t.kind<>'earned' OR t.status<>'posted' OR t.amount<=0 THEN RETURN jsonb_build_object('ok',false,'error','ORIGINAL_REWARD_NOT_REVERSIBLE'); END IF;
    IF EXISTS(SELECT 1 FROM public.ghc_transactions WHERE kind='reversed' AND metadata->>'reversal_of'=t.id::text) THEN
      RETURN jsonb_build_object('ok',false,'error','TRANSACTION_ALREADY_REVERSED');
    END IF;
    INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,metadata,created_at,posted_at)
      VALUES(t.user_id,'reversed',-t.amount,'posted',left('Reward appeal reversal: '||trim(p_note),240),'REWARD_APPEAL_REVERSAL','reward-appeal:'||a.id::text,
        jsonb_build_object('reversal_of',t.id::text,'appeal_id',a.id::text,'reviewer_id',trim(p_reviewer_id)),now(),now()) RETURNING id INTO v_reversal;
    UPDATE public.gh_reward_risk_holds SET status='reversed',resolved_at=now() WHERE user_id=a.user_id AND source_event_id=a.source_event_id AND status='held';
    PERFORM public.gh_domain_event_enqueue('reward.reversed','reward.appeal-reversal:'||a.id::text,'ghc_transaction',v_reversal::text,trim(p_reviewer_id),jsonb_build_object('userId',a.user_id,'originalTransactionId',t.id,'reversalTransactionId',v_reversal,'appealId',a.id),1);
  END IF;
  UPDATE public.gh_reward_appeals SET status=p_status,resolution_note=left(trim(p_note),2000),reviewer_id=trim(p_reviewer_id),updated_at=now() WHERE id=a.id;
  PERFORM public.gh_domain_event_enqueue('reward.appeal_reviewed','reward.appeal-reviewed:'||a.id::text||':'||p_status,'reward_appeal',a.id::text,trim(p_reviewer_id),jsonb_build_object('status',p_status,'userId',a.user_id,'reversalTransactionId',v_reversal),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'status',p_status,'reversalTransactionId',v_reversal,'balanceChanged',p_status='reversed');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','REVERSAL_CONFLICT');
END; $$;
REVOKE ALL ON FUNCTION public.gh_reward_appeal_resolve(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reward_appeal_resolve(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_reputation_appeal_resolve(p_appeal_id uuid,p_reviewer_id text,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.gh_reputation_appeals%ROWTYPE; e public.gh_trust_dimension_events%ROWTYPE; v_comp uuid;
BEGIN
  IF p_status NOT IN ('under_review','upheld','withdrawn','reversed') OR COALESCE(trim(p_reviewer_id),'')='' OR length(trim(COALESCE(p_note,'')))<10 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_RESOLUTION'); END IF;
  SELECT * INTO a FROM public.gh_reputation_appeals WHERE id=p_appeal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','APPEAL_NOT_FOUND'); END IF;
  IF a.user_id=trim(p_reviewer_id) THEN RETURN jsonb_build_object('ok',false,'error','CONFLICT_OF_INTEREST'); END IF;
  IF a.status IN ('upheld','reversed','withdrawn') THEN
    IF a.status=p_status THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'status',a.status); END IF;
    RETURN jsonb_build_object('ok',false,'error','APPEAL_ALREADY_RESOLVED');
  END IF;
  IF p_status='reversed' THEN
    IF COALESCE(a.target_event_id,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('ok',false,'error','SOURCE_EVENT_NOT_REVERSIBLE','message','Only contextual trust events with an auditable event UUID can be reversed through this workflow.');
    END IF;
    SELECT * INTO e FROM public.gh_trust_dimension_events WHERE id=a.target_event_id::uuid AND user_id=a.user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','SOURCE_EVENT_NOT_REVERSIBLE'); END IF;
    PERFORM public.gh_trust_dimension_record(e.user_id,e.dimension,-e.delta,'admin_correction','appeal:'||a.id::text,'trust-appeal-reversal:'||a.id::text,jsonb_build_object('appealId',a.id,'reversesEventId',e.id,'reviewerId',trim(p_reviewer_id),'note',left(trim(p_note),500)));
    SELECT id INTO v_comp FROM public.gh_trust_dimension_events WHERE idempotency_key='trust-appeal-reversal:'||a.id::text;
  END IF;
  UPDATE public.gh_reputation_appeals SET status=p_status,resolution_note=left(trim(p_note),2000),reviewer_id=trim(p_reviewer_id),updated_at=now() WHERE id=a.id;
  PERFORM public.gh_domain_event_enqueue('reputation.appeal_reviewed','reputation.appeal-reviewed:'||a.id::text||':'||p_status,'reputation_appeal',a.id::text,trim(p_reviewer_id),jsonb_build_object('status',p_status,'userId',a.user_id,'compensatedEventId',v_comp),1);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'status',p_status,'compensatedEventId',v_comp,'scoreChanged',p_status='reversed');
END; $$;
REVOKE ALL ON FUNCTION public.gh_reputation_appeal_resolve(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reputation_appeal_resolve(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_marketplace_prevent_moderated_listing_reactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status='removed' AND NEW.status<>'removed' THEN
    RAISE EXCEPTION 'MODERATED_LISTING_REMOVED: a removed listing cannot be reactivated';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS gh_marketplace_prevent_removed_reactivation_trg ON public.gh_marketplace_listings;
CREATE TRIGGER gh_marketplace_prevent_removed_reactivation_trg BEFORE UPDATE OF status ON public.gh_marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.gh_marketplace_prevent_moderated_listing_reactivation();

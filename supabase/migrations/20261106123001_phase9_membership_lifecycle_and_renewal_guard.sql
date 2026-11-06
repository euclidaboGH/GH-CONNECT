-- Phase 9: harden verified membership renewal and expose an owner-scoped lifecycle journal.
-- This migration is REVIEW_REQUIRED. Validate against disposable PostgreSQL and Testnet first.

CREATE OR REPLACE FUNCTION public.ghc_membership_renew_from_verified_intent(
  p_payment_intent_id text,
  p_evidence_fingerprint text,
  p_duration interval
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  i public.ghc_payment_intents%ROWTYPE;
  e public.ghc_membership_entitlements%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_tier text;
  v_period text;
  v_paid_months integer;
  v_access_months integer;
  v_discount_pct numeric;
  v_monthly_price numeric;
  v_expected_amount numeric;
  v_duration interval;
  v_product_id text;
BEGIN
  -- p_duration remains in the function signature for compatibility with the
  -- existing service client. It is deliberately NOT trusted as an authority.
  IF coalesce(trim(p_payment_intent_id), '') = ''
     OR length(coalesce(trim(p_evidence_fingerprint), '')) NOT BETWEEN 16 AND 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RENEWAL_INPUT');
  END IF;

  SELECT * INTO i
  FROM public.ghc_payment_intents
  WHERE id = trim(p_payment_intent_id)
  FOR UPDATE;

  IF NOT FOUND
     OR i.status NOT IN ('COMPLETED', 'FULFILLED')
     OR coalesce(i.completed_at, i.fulfilled_at) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VERIFIED_COMPLETED_PAYMENT_REQUIRED');
  END IF;

  IF i.provider <> 'pi' OR upper(i.currency) <> 'PI' OR i.purpose <> 'membership' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VERIFIED_PI_MEMBERSHIP_PAYMENT_REQUIRED');
  END IF;

  v_product_id := lower(coalesce(i.metadata->>'productId', ''));
  IF v_product_id !~ '^membership_(vip|vvip)_(monthly|four_months|eight_months|yearly)$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANONICAL_MEMBERSHIP_PRODUCT_REQUIRED');
  END IF;

  v_tier := substring(v_product_id from '^membership_(vip|vvip)_');
  v_period := substring(v_product_id from '^membership_(?:vip|vvip)_(monthly|four_months|eight_months|yearly)$');

  v_paid_months := CASE v_period
    WHEN 'monthly' THEN 1
    WHEN 'four_months' THEN 4
    WHEN 'eight_months' THEN 8
    WHEN 'yearly' THEN 12
    ELSE NULL
  END;
  v_discount_pct := CASE v_period
    WHEN 'monthly' THEN 0
    WHEN 'four_months' THEN 5
    WHEN 'eight_months' THEN 10
    WHEN 'yearly' THEN 20
    ELSE NULL
  END;
  v_monthly_price := CASE v_tier WHEN 'vip' THEN 1.50 WHEN 'vvip' THEN 3.00 ELSE NULL END;

  IF v_paid_months IS NULL OR v_discount_pct IS NULL OR v_monthly_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNSUPPORTED_MEMBERSHIP_CATALOG_ITEM');
  END IF;

  -- Independently verify the PI catalog amount. Never trust a client-supplied
  -- amount, period, or duration; GHC purchases use a separate atomic ledger path.
  v_expected_amount := round(v_monthly_price * v_paid_months * (100 - v_discount_pct) / 100, 2);
  IF i.amount IS NULL OR abs(i.amount - v_expected_amount) > 0.001 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_CATALOG_AMOUNT_MISMATCH');
  END IF;

  -- One bonus month is part of the published catalog. Derive calendar duration
  -- from the verified product id, not p_duration.
  v_access_months := v_paid_months + 1;
  v_duration := make_interval(months => v_access_months);
  IF EXISTS (
    SELECT 1 FROM public.ghc_membership_entitlement_events
    WHERE payment_intent_id = i.id AND user_id = i.user_id
  ) THEN
    SELECT * INTO e FROM public.ghc_membership_entitlements WHERE user_id = i.user_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'DUPLICATE_PAYMENT_ENTITLEMENT_MISSING');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entitlement', to_jsonb(e));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(i.user_id), hashtext('membership-renewal'));
  SELECT * INTO e
  FROM public.ghc_membership_entitlements
  WHERE user_id = i.user_id
  FOR UPDATE;

  IF FOUND AND e.payment_intent_id = i.id THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'entitlement', to_jsonb(e));
  END IF;

  -- A verified renewal completed up to 72 hours after expiry preserves the
  -- prepaid term boundary. Access is NOT extended during this gap: the normal
  -- entitlement reader continues to deny paid features at expires_at.
  v_start := CASE
    WHEN FOUND
      AND e.active = true
      AND e.tier <> 'free'
      AND e.expires_at IS NOT NULL
      AND e.expires_at >= now() - interval '72 hours'
    THEN e.expires_at
    ELSE now()
  END;
  v_end := v_start + v_duration;

  INSERT INTO public.ghc_membership_entitlements(
    user_id, tier, active, started_at, expires_at, billing_period,
    source, purchase_ref, payment_intent_id, updated_at, audit
  ) VALUES (
    i.user_id, v_tier, true,
    CASE WHEN FOUND AND v_start = e.expires_at THEN e.started_at ELSE v_start END,
    v_end, v_period, 'verified_payment',
    coalesce(nullif(i.reference_id, ''), 'pi:' || i.id), i.id, now(),
    jsonb_build_array(jsonb_build_object(
      'action', 'VERIFIED_MEMBERSHIP_RENEWAL',
      'paymentIntentId', i.id,
      'billingPeriod', v_period,
      'accessMonths', v_access_months,
      'renewalContinuityGraceHours', 72,
      'evidenceFingerprint', p_evidence_fingerprint
    ))
  )
  ON CONFLICT(user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    active = true,
    started_at = CASE
      WHEN public.ghc_membership_entitlements.active = true
        AND public.ghc_membership_entitlements.tier <> 'free'
        AND public.ghc_membership_entitlements.expires_at IS NOT NULL
        AND public.ghc_membership_entitlements.expires_at >= now() - interval '72 hours'
      THEN public.ghc_membership_entitlements.started_at
      ELSE EXCLUDED.started_at
    END,
    expires_at = EXCLUDED.expires_at,
    billing_period = EXCLUDED.billing_period,
    source = 'verified_payment',
    purchase_ref = EXCLUDED.purchase_ref,
    payment_intent_id = EXCLUDED.payment_intent_id,
    updated_at = now(),
    audit = (
      SELECT coalesce(jsonb_agg(item.value ORDER BY item.ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(public.ghc_membership_entitlements.audit, '[]'::jsonb) || EXCLUDED.audit)
        WITH ORDINALITY AS item(value, ordinality)
      WHERE item.ordinality > jsonb_array_length(coalesce(public.ghc_membership_entitlements.audit, '[]'::jsonb) || EXCLUDED.audit) - 40
    );

  -- The existing immutable AFTER trigger records exactly one lifecycle event.
  SELECT * INTO e FROM public.ghc_membership_entitlements WHERE user_id = i.user_id;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'entitlement', to_jsonb(e));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_membership_renew_from_verified_intent(text, text, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_renew_from_verified_intent(text, text, interval)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ghc_membership_get_lifecycle(p_user_id text, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF coalesce(trim(p_user_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT id, event_type, tier, source, started_at, expires_at,
      previous_expires_at, created_at
    FROM public.ghc_membership_entitlement_events
    WHERE user_id = trim(p_user_id)
    ORDER BY created_at DESC, id DESC
    LIMIT least(50, greatest(1, coalesce(p_limit, 20)))
  ) x;

  RETURN jsonb_build_object('ok', true, 'items', v_items, 'readOnly', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_membership_get_lifecycle(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_membership_get_lifecycle(text, integer)
  TO service_role;

-- Keep lifecycle event classification aligned with actual state transitions.
-- The trigger is the single writer of lifecycle events; renewal RPCs do not
-- append a second manual event for the same entitlement update.
CREATE OR REPLACE FUNCTION public.ghc_membership_entitlement_event_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_type text;
  v_fingerprint text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'granted';
  ELSE
    IF OLD.tier <> 'free' AND OLD.expires_at IS NOT NULL
       AND OLD.expires_at <= now() AND NEW.tier = 'free' THEN
      v_type := 'expired';
    ELSIF OLD.tier = 'free' AND NEW.tier <> 'free' THEN
      v_type := 'granted';
    ELSIF OLD.active = true AND NEW.active = false THEN
      v_type := 'revoked';
    ELSIF OLD.tier IS DISTINCT FROM NEW.tier THEN
      v_type := 'tier_changed';
    ELSIF NEW.expires_at IS DISTINCT FROM OLD.expires_at
       AND NEW.expires_at > coalesce(OLD.expires_at, '-infinity'::timestamptz) THEN
      v_type := 'renewed';
    ELSIF OLD.payment_intent_id IS DISTINCT FROM NEW.payment_intent_id THEN
      v_type := 'payment_linked';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_fingerprint := md5(concat_ws('|', NEW.user_id, v_type, NEW.tier,
    coalesce(NEW.purchase_ref, ''), coalesce(NEW.payment_intent_id, ''),
    coalesce(NEW.started_at::text, ''), coalesce(NEW.expires_at::text, '')));

  INSERT INTO public.ghc_membership_entitlement_events(
    user_id, event_type, tier, source, purchase_ref, payment_intent_id,
    started_at, expires_at, previous_expires_at, event_fingerprint
  ) VALUES (
    NEW.user_id, v_type, NEW.tier, NEW.source, NEW.purchase_ref,
    NEW.payment_intent_id, NEW.started_at, NEW.expires_at,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.expires_at ELSE NULL END,
    v_fingerprint
  ) ON CONFLICT(event_fingerprint) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_membership_entitlement_event_capture()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.ghc_membership_renew_from_verified_intent(text, text, interval) IS
  'Renews from a row-locked completed PI membership intent; independently validates catalog amount and derives calendar access duration from productId. 72-hour continuity grace preserves term boundary only, never access after expiry.';
COMMENT ON FUNCTION public.ghc_membership_get_lifecycle(text, integer) IS
  'Read-only, service-role-only membership lifecycle history scoped to the authenticated user by the calling API.';
COMMENT ON FUNCTION public.ghc_membership_entitlement_event_capture() IS
  'Classifies immutable membership lifecycle events from canonical entitlement row transitions; one event is recorded per distinct row-state fingerprint.';

-- PROPOSAL ONLY — Phase 11.2.4 remote Web Push architecture, hardened in Phase 11.2.5.
-- DO NOT APPLY until Testnet/Mainnet schema history is reconciled independently,
-- this SQL is tested on a disposable PostgreSQL database, and explicit approval is recorded.
-- Uses standards-based Web Push/VAPID; no vendor-specific provider is assumed.

CREATE TABLE IF NOT EXISTS public.gh_notification_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL CHECK (length(trim(user_id)) > 0),
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 20 AND 100),
  endpoint_hash text NOT NULL UNIQUE CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
  endpoint_ciphertext text NOT NULL CHECK (length(endpoint_ciphertext) BETWEEN 80 AND 8192),
  p256dh_ciphertext text NOT NULL CHECK (length(p256dh_ciphertext) BETWEEN 80 AND 2048),
  auth_ciphertext text NOT NULL CHECK (length(auth_ciphertext) BETWEEN 80 AND 1024),
  encryption_version text NOT NULL DEFAULT 'v1' CHECK (encryption_version = 'v1'),
  expiration_time timestamptz,
  category_preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(category_preferences) = 'object'),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_error_code text
);
CREATE INDEX IF NOT EXISTS idx_gh_notification_push_subscriptions_user_active
  ON public.gh_notification_push_subscriptions(user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gh_notification_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id text NOT NULL REFERENCES public.gh_notification_inbox(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.gh_notification_push_subscriptions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','accepted','failed','expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  provider_status integer,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provider_accepted_at timestamptz,
  UNIQUE(notification_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_notification_push_outbox_due
  ON public.gh_notification_push_outbox(next_attempt_at, created_at)
  WHERE status IN ('pending','processing');

CREATE TABLE IF NOT EXISTS public.gh_notification_push_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id uuid NOT NULL REFERENCES public.gh_notification_push_outbox(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('accepted','retry','gone','failed')),
  provider_status integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outbox_id, attempt_number)
);

ALTER TABLE public.gh_notification_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_notification_push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_notification_push_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_notification_push_subscriptions_no_client ON public.gh_notification_push_subscriptions;
CREATE POLICY gh_notification_push_subscriptions_no_client ON public.gh_notification_push_subscriptions FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_notification_push_outbox_no_client ON public.gh_notification_push_outbox;
CREATE POLICY gh_notification_push_outbox_no_client ON public.gh_notification_push_outbox FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_notification_push_attempts_no_client ON public.gh_notification_push_attempts;
CREATE POLICY gh_notification_push_attempts_no_client ON public.gh_notification_push_attempts FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.gh_notification_push_subscriptions, public.gh_notification_push_outbox, public.gh_notification_push_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gh_notification_push_subscriptions, public.gh_notification_push_outbox, public.gh_notification_push_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gh_notification_push_attempts_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.gh_notification_push_subscription_upsert(
  p_user_id text, p_device_id text, p_endpoint_hash text, p_endpoint_ciphertext text,
  p_p256dh_ciphertext text, p_auth_ciphertext text, p_expiration_time timestamptz DEFAULT NULL,
  p_category_preferences jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NULLIF(trim(COALESCE(p_user_id,'')),'') IS NULL OR length(COALESCE(p_device_id,'')) NOT BETWEEN 20 AND 100
     OR p_endpoint_hash !~ '^[a-f0-9]{64}$'
     OR length(COALESCE(p_endpoint_ciphertext,'')) NOT BETWEEN 80 AND 8192
     OR length(COALESCE(p_p256dh_ciphertext,'')) NOT BETWEEN 80 AND 2048
     OR length(COALESCE(p_auth_ciphertext,'')) NOT BETWEEN 40 AND 1024
     OR jsonb_typeof(COALESCE(p_category_preferences,'{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_SUBSCRIPTION');
  END IF;
  -- A live browser endpoint has one current account owner. Re-authenticated ownership
  -- transfer replaces the previous account binding rather than sharing the endpoint.
  INSERT INTO public.gh_notification_push_subscriptions(
    user_id,device_id,endpoint_hash,endpoint_ciphertext,p256dh_ciphertext,auth_ciphertext,encryption_version,expiration_time,
    category_preferences,revoked_at,last_error_code,updated_at,last_seen_at
  ) VALUES (
    trim(p_user_id),p_device_id,p_endpoint_hash,p_endpoint_ciphertext,p_p256dh_ciphertext,p_auth_ciphertext,'v1',p_expiration_time,
    p_category_preferences,NULL,NULL,now(),now()
  ) ON CONFLICT(endpoint_hash) DO UPDATE SET
    user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,
    endpoint_ciphertext=EXCLUDED.endpoint_ciphertext,
    p256dh_ciphertext=EXCLUDED.p256dh_ciphertext,auth_ciphertext=EXCLUDED.auth_ciphertext,
    expiration_time=EXCLUDED.expiration_time,category_preferences=EXCLUDED.category_preferences,
    revoked_at=NULL,last_error_code=NULL,updated_at=now(),last_seen_at=now()
  RETURNING id INTO v_id;
  -- Cancel pending payloads created under a previous account owner before this
  -- browser endpoint is reassigned. Claim also checks owner equality as a second fence.
  UPDATE public.gh_notification_push_outbox SET status='expired',last_error_code='ENDPOINT_REASSIGNED',updated_at=now()
  WHERE subscription_id=v_id AND user_id<>trim(p_user_id) AND status IN ('pending','processing');
  RETURN jsonb_build_object('ok',true,'subscriptionId',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_notification_push_subscription_revoke(
  p_user_id text, p_endpoint_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.gh_notification_push_subscriptions SET revoked_at=COALESCE(revoked_at,now()),updated_at=now()
  WHERE user_id=trim(p_user_id) AND endpoint_hash=p_endpoint_hash AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  UPDATE public.gh_notification_push_outbox SET status='expired',updated_at=now(),last_error_code='SUBSCRIPTION_REVOKED'
  WHERE subscription_id IN (SELECT id FROM public.gh_notification_push_subscriptions WHERE user_id=trim(p_user_id) AND endpoint_hash=p_endpoint_hash)
    AND status IN ('pending','processing');
  RETURN jsonb_build_object('ok',true,'revoked',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_notification_push_subscription_list(p_user_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('ok',true,'subscriptions',COALESCE(jsonb_agg(jsonb_build_object(
    'subscriptionId',id,'deviceId',device_id,'createdAt',created_at,'lastSeenAt',last_seen_at,
    'expirationTime',expiration_time,'categoryPreferences',category_preferences
  ) ORDER BY last_seen_at DESC),'[]'::jsonb))
  FROM public.gh_notification_push_subscriptions WHERE user_id=trim(p_user_id) AND revoked_at IS NULL
    AND (expiration_time IS NULL OR expiration_time>now());
$$;

CREATE OR REPLACE FUNCTION public.gh_notification_push_enqueue_new_inbox_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_category text;
BEGIN
  v_category := CASE
    WHEN NEW.notification_type LIKE 'message%' OR NEW.notification_type LIKE 'chat%' THEN 'messages'
    WHEN NEW.notification_type LIKE 'match%' THEN 'matches'
    WHEN NEW.notification_type LIKE 'connection%' THEN 'connections'
    WHEN NEW.notification_type LIKE 'comment%' THEN 'comments'
    WHEN NEW.notification_type LIKE 'mention%' THEN 'mentions'
    WHEN NEW.notification_type LIKE 'community%' THEN 'communities'
    WHEN NEW.notification_type LIKE 'story%' THEN 'stories'
    WHEN NEW.notification_type LIKE 'marketplace%' OR NEW.notification_type LIKE 'order%' THEN 'marketplace'
    WHEN NEW.notification_type LIKE 'reward%' OR NEW.notification_type LIKE 'claim%' THEN 'rewards'
    WHEN NEW.notification_type LIKE 'wallet%' OR NEW.notification_type LIKE 'transfer%' OR NEW.notification_type LIKE 'payment%' THEN 'wallet'
    WHEN NEW.notification_type LIKE 'premium%' OR NEW.notification_type LIKE 'membership%' THEN 'premium'
    WHEN NEW.notification_type LIKE 'profile_view%' THEN 'profile_views'
    WHEN NEW.notification_type LIKE 'product_update%' THEN 'product_updates'
    ELSE 'system' END;
  INSERT INTO public.gh_notification_push_outbox(notification_id,subscription_id,user_id)
  SELECT NEW.id,s.id,s.user_id FROM public.gh_notification_push_subscriptions s
  WHERE s.user_id=NEW.recipient_user_id AND s.revoked_at IS NULL
    AND (s.expiration_time IS NULL OR s.expiration_time>now())
    AND COALESCE((s.category_preferences->>v_category)::boolean,false)=true
  ON CONFLICT(notification_id,subscription_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS gh_notification_push_enqueue_after_inbox_insert ON public.gh_notification_inbox;
CREATE TRIGGER gh_notification_push_enqueue_after_inbox_insert
AFTER INSERT ON public.gh_notification_inbox
FOR EACH ROW EXECUTE FUNCTION public.gh_notification_push_enqueue_new_inbox_row();

CREATE OR REPLACE FUNCTION public.gh_notification_push_subscriptions_cleanup_expired(p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    SELECT id FROM public.gh_notification_push_subscriptions
    WHERE revoked_at IS NULL AND expiration_time IS NOT NULL AND expiration_time<=now()
    ORDER BY expiration_time FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit,500),1),2000)
  )
  UPDATE public.gh_notification_push_subscriptions s SET revoked_at=now(),
    last_error_code='SUBSCRIPTION_EXPIRED',updated_at=now()
  FROM expired e WHERE s.id=e.id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  UPDATE public.gh_notification_push_outbox SET status='expired',last_error_code='SUBSCRIPTION_EXPIRED',updated_at=now()
  WHERE status IN ('pending','processing') AND subscription_id IN (
    SELECT id FROM public.gh_notification_push_subscriptions WHERE revoked_at IS NOT NULL AND last_error_code='SUBSCRIPTION_EXPIRED'
  );
  RETURN jsonb_build_object('ok',true,'expired',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_notification_push_outbox_claim(p_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb;
BEGIN
  -- A worker that dies on its final leased attempt must not leave a row stuck forever.
  UPDATE public.gh_notification_push_outbox SET status='failed',lease_until=NULL,
    last_error_code='MAX_ATTEMPTS_EXHAUSTED',updated_at=now()
  WHERE status='processing' AND attempts>=8 AND lease_until<now();
  WITH due AS (
    SELECT o.id FROM public.gh_notification_push_outbox o
    JOIN public.gh_notification_push_subscriptions s ON s.id=o.subscription_id
    WHERE s.revoked_at IS NULL AND o.user_id=s.user_id
      AND (s.expiration_time IS NULL OR s.expiration_time>now())
      AND o.attempts<8 AND o.next_attempt_at<=now()
      AND (o.status='pending' OR (o.status='processing' AND o.lease_until<now()))
    ORDER BY o.next_attempt_at,o.created_at FOR UPDATE OF o SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),100)
  ), claimed AS (
    UPDATE public.gh_notification_push_outbox o SET status='processing',attempts=o.attempts+1,
      lease_until=now()+interval '2 minutes',updated_at=now()
    FROM due WHERE o.id=due.id
    RETURNING o.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'outboxId',c.id,'attemptNumber',c.attempts,'subscriptionId',s.id,
    'endpointCiphertext',s.endpoint_ciphertext,
    'p256dhCiphertext',s.p256dh_ciphertext,'authCiphertext',s.auth_ciphertext,
    'encryptionVersion',s.encryption_version,
    'notificationId',n.id,'payload',jsonb_build_object(
      'title','GreenHaven','body','You have a new notification.',
      'tag','ghn:' || md5(n.id),'url','/'
    )
  )),'[]'::jsonb) INTO v_rows
  FROM claimed c JOIN public.gh_notification_push_subscriptions s ON s.id=c.subscription_id
  JOIN public.gh_notification_inbox n ON n.id=c.notification_id;
  RETURN jsonb_build_object('ok',true,'items',v_rows);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_notification_push_outbox_complete(
  p_outbox_id uuid,p_attempt_number integer,p_outcome text,
  p_provider_status integer DEFAULT NULL,p_error_code text DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.gh_notification_push_outbox%ROWTYPE; v_next text;
BEGIN
  SELECT * INTO v_row FROM public.gh_notification_push_outbox WHERE id=p_outbox_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'processing' OR v_row.attempts<>p_attempt_number THEN
    RETURN jsonb_build_object('ok',false,'error','LEASE_OR_ATTEMPT_MISMATCH');
  END IF;
  IF p_outcome NOT IN ('accepted','retry','gone','failed') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_OUTCOME'); END IF;
  v_next := CASE WHEN p_outcome='accepted' THEN 'accepted' WHEN p_outcome='gone' THEN 'expired'
    WHEN p_outcome='retry' AND v_row.attempts<8 THEN 'pending' ELSE 'failed' END;
  UPDATE public.gh_notification_push_outbox SET status=v_next,
    next_attempt_at=CASE WHEN v_next='pending' THEN now()+make_interval(secs=>LEAST(GREATEST((30 * power(2,GREATEST(v_row.attempts-1,0)))::integer,COALESCE(p_retry_after_seconds,0),30),21600)) ELSE next_attempt_at END,
    lease_until=NULL,provider_status=p_provider_status,last_error_code=left(COALESCE(p_error_code,''),80),
    provider_accepted_at=CASE WHEN v_next='accepted' THEN now() ELSE provider_accepted_at END,updated_at=now()
  WHERE id=p_outbox_id;
  INSERT INTO public.gh_notification_push_attempts(outbox_id,attempt_number,outcome,provider_status,error_code)
  VALUES(p_outbox_id,p_attempt_number,p_outcome,p_provider_status,left(COALESCE(p_error_code,''),80))
  ON CONFLICT(outbox_id,attempt_number) DO NOTHING;
  IF p_outcome='gone' THEN
    UPDATE public.gh_notification_push_subscriptions SET revoked_at=COALESCE(revoked_at,now()),
      last_error_code='PUSH_ENDPOINT_GONE',updated_at=now() WHERE id=v_row.subscription_id;
    UPDATE public.gh_notification_push_outbox SET status='expired',updated_at=now(),last_error_code='SUBSCRIPTION_EXPIRED'
      WHERE subscription_id=v_row.subscription_id AND status IN ('pending','processing');
  END IF;
  RETURN jsonb_build_object('ok',true,'status',v_next);
END; $$;

REVOKE ALL ON FUNCTION public.gh_notification_push_subscription_upsert(text,text,text,text,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_subscription_upsert(text,text,text,text,text,text,timestamptz,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_subscription_revoke(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_subscription_revoke(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_subscription_list(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_subscription_list(text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_subscriptions_cleanup_expired(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_subscriptions_cleanup_expired(integer) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_outbox_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_outbox_claim(integer) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_outbox_complete(uuid,integer,text,integer,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_push_outbox_complete(uuid,integer,text,integer,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.gh_notification_push_enqueue_new_inbox_row() FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE public.gh_notification_push_subscriptions IS 'Per-account, per-device Web Push subscriptions. Endpoint and key material are AES-256-GCM encrypted by the trusted application before storage; only ciphertext is stored.';
COMMENT ON TABLE public.gh_notification_push_outbox IS 'Idempotent per-notification/per-device remote push queue. accepted means the push service accepted the request, not that a device displayed it; never replaces the in-app inbox.';
COMMENT ON TABLE public.gh_notification_push_attempts IS 'Provider outcome audit trail with sanitized error codes; no payload or subscription secrets.';

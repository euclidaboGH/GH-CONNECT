-- Phase 6: Pi Ads verification events (NO rewards / NO ledger writes).
-- Client ad signals are requests only; verification must be server-side.
-- reward_authorized remains false until a future economy-safe path is added.

CREATE TABLE IF NOT EXISTS public.gh_ad_verification_events (
  id                  text PRIMARY KEY,
  user_id             text NOT NULL,
  provider            text NOT NULL DEFAULT 'pi_ad_network'
                      CHECK (provider IN ('pi_ad_network')),
  ad_id               text NOT NULL,
  placement           text NOT NULL DEFAULT 'rewarded'
                      CHECK (placement IN ('rewarded', 'interstitial', 'unknown')),
  client_signal       boolean NOT NULL DEFAULT true,
  provider_verified   boolean NOT NULL DEFAULT false,
  reward_authorized   boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'rejected'
                      CHECK (status IN (
                        'pending',
                        'verified',
                        'rejected',
                        'duplicate',
                        'disabled'
                      )),
  reject_reason       text,
  idempotency_key     text NOT NULL,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_ad_verification_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_ad_verification_ad_nonempty CHECK (length(trim(ad_id)) > 0),
  CONSTRAINT gh_ad_verification_idem_nonempty CHECK (length(trim(idempotency_key)) > 0),
  -- Never allow reward without provider verification in this schema generation
  CONSTRAINT gh_ad_verification_reward_requires_verify
    CHECK (reward_authorized = false OR provider_verified = true)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_ad_verification_user_idem
  ON public.gh_ad_verification_events (user_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_ad_verification_user_ad
  ON public.gh_ad_verification_events (user_id, ad_id)
  WHERE provider_verified = true;

CREATE INDEX IF NOT EXISTS idx_gh_ad_verification_user_created
  ON public.gh_ad_verification_events (user_id, created_at DESC);

ALTER TABLE public.gh_ad_verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_ad_verification_no_client ON public.gh_ad_verification_events;
CREATE POLICY gh_ad_verification_no_client ON public.gh_ad_verification_events
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_ad_verification_events IS
  'Ad verification audit log. reward_authorized stays false until economy-safe settlement is implemented. No balance mutations.';

/**
 * Record a verification attempt. Never authorizes reward in this phase.
 * Always fail-closed: provider_verified=false, reward_authorized=false.
 */
CREATE OR REPLACE FUNCTION public.gh_ad_verification_record(
  p_user_id text,
  p_ad_id text,
  p_idempotency_key text,
  p_placement text DEFAULT 'rewarded',
  p_status text DEFAULT 'rejected',
  p_reject_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_existing public.gh_ad_verification_events%ROWTYPE;
  v_placement text := lower(trim(COALESCE(p_placement, 'rewarded')));
  v_status text := lower(trim(COALESCE(p_status, 'rejected')));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF p_ad_id IS NULL OR length(trim(p_ad_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AD_ID_REQUIRED');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;
  IF v_placement NOT IN ('rewarded', 'interstitial', 'unknown') THEN
    v_placement := 'unknown';
  END IF;
  IF v_status NOT IN ('pending', 'verified', 'rejected', 'duplicate', 'disabled') THEN
    v_status := 'rejected';
  END IF;

  -- Force fail-closed: this phase never marks verified/reward
  IF v_status = 'verified' THEN
    v_status := 'rejected';
  END IF;

  SELECT * INTO v_existing
  FROM public.gh_ad_verification_events
  WHERE user_id = trim(p_user_id) AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'eventId', v_existing.id,
      'status', v_existing.status,
      'providerVerified', false,
      'rewardAuthorized', false
    );
  END IF;

  v_id := 'ad_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_ad_verification_events (
    id, user_id, ad_id, placement, client_signal,
    provider_verified, reward_authorized, status, reject_reason,
    idempotency_key, metadata
  ) VALUES (
    v_id,
    trim(p_user_id),
    trim(p_ad_id),
    v_placement,
    true,
    false,
    false,
    v_status,
    NULLIF(trim(COALESCE(p_reject_reason, '')), ''),
    trim(p_idempotency_key),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'eventId', v_id,
    'status', v_status,
    'providerVerified', false,
    'rewardAuthorized', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ad_verification_record(text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ad_verification_record(text, text, text, text, text, text, jsonb) TO service_role;

-- Phase 5: Creator Studio + tip intent foundation (non-settling).
-- No GHC/Pi balance mutation. Tip settlement is DEFERRED.
-- Creator status is independent of reputation.

CREATE TABLE IF NOT EXISTS public.gh_creator_profiles (
  user_id           text PRIMARY KEY,
  display_name      text,
  tagline           text,
  bio               text,
  is_enabled        boolean NOT NULL DEFAULT true,
  tips_enabled      boolean NOT NULL DEFAULT false,
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_creator_profiles_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_creator_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_creator_profiles_no_client ON public.gh_creator_profiles;
CREATE POLICY gh_creator_profiles_no_client ON public.gh_creator_profiles
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_creator_profiles IS
  'Creator Studio identity/settings. Independent of reputation. Not financial balances.';

-- Tip intents only — settlement deferred. Never implies completed payment.
CREATE TABLE IF NOT EXISTS public.gh_tip_intents (
  id                text PRIMARY KEY,
  tipper_id         text NOT NULL,
  recipient_id      text NOT NULL,
  content_id        text,
  content_kind      text NOT NULL DEFAULT 'post'
                    CHECK (content_kind IN ('post', 'profile', 'other')),
  amount_units      numeric(18, 8),
  currency          text NOT NULL DEFAULT 'PI'
                    CHECK (currency IN ('PI', 'GHC')),
  status            text NOT NULL DEFAULT 'initiated'
                    CHECK (status IN (
                      'initiated',
                      'awaiting_payment',
                      'cancelled',
                      'failed',
                      'settled'
                    )),
  idempotency_key   text NOT NULL,
  payment_intent_id text,
  note              text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_tip_intents_parties_nonempty
    CHECK (length(trim(tipper_id)) > 0 AND length(trim(recipient_id)) > 0),
  CONSTRAINT gh_tip_intents_no_self CHECK (tipper_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_tip_intents_tipper_idem
  ON public.gh_tip_intents (tipper_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_gh_tip_intents_recipient_created
  ON public.gh_tip_intents (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_tip_intents_status
  ON public.gh_tip_intents (status);

ALTER TABLE public.gh_tip_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_tip_intents_no_client ON public.gh_tip_intents;
CREATE POLICY gh_tip_intents_no_client ON public.gh_tip_intents
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_tip_intents IS
  'Tip intents only. status=settled reserved for future authoritative settlement. No ledger writes here.';

-- Enable creator profile (self only via service-role from API)
CREATE OR REPLACE FUNCTION public.gh_creator_upsert(
  p_user_id text,
  p_display_name text DEFAULT NULL,
  p_tagline text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_tips_enabled boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  INSERT INTO public.gh_creator_profiles (
    user_id, display_name, tagline, bio, tips_enabled, is_enabled, updated_at
  ) VALUES (
    trim(p_user_id),
    NULLIF(trim(COALESCE(p_display_name, '')), ''),
    NULLIF(trim(COALESCE(p_tagline, '')), ''),
    NULLIF(trim(COALESCE(p_bio, '')), ''),
    COALESCE(p_tips_enabled, false),
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.gh_creator_profiles.display_name),
    tagline = COALESCE(EXCLUDED.tagline, public.gh_creator_profiles.tagline),
    bio = COALESCE(EXCLUDED.bio, public.gh_creator_profiles.bio),
    tips_enabled = EXCLUDED.tips_enabled,
    is_enabled = true,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'userId', trim(p_user_id),
    'tipsEnabled', COALESCE(p_tips_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_creator_upsert(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_creator_upsert(text, text, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_creator_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_creator_profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  SELECT * INTO r FROM public.gh_creator_profiles WHERE user_id = trim(p_user_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'exists', false, 'userId', trim(p_user_id));
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'exists', true,
    'userId', r.user_id,
    'displayName', r.display_name,
    'tagline', r.tagline,
    'bio', r.bio,
    'isEnabled', r.is_enabled,
    'tipsEnabled', r.tips_enabled,
    'updatedAt', r.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_creator_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_creator_get(text) TO service_role;

/**
 * Create tip INTENT only. Never settles. Never touches wallet/ledger.
 * Recipient must be server-validated (caller supplies after ownership check).
 */
CREATE OR REPLACE FUNCTION public.gh_tip_intent_create(
  p_tipper_id text,
  p_recipient_id text,
  p_idempotency_key text,
  p_content_id text DEFAULT NULL,
  p_content_kind text DEFAULT 'post',
  p_currency text DEFAULT 'PI',
  p_amount_units numeric DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_existing public.gh_tip_intents%ROWTYPE;
  v_kind text := lower(trim(COALESCE(p_content_kind, 'post')));
  v_cur text := upper(trim(COALESCE(p_currency, 'PI')));
BEGIN
  IF p_tipper_id IS NULL OR length(trim(p_tipper_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TIPPER_REQUIRED');
  END IF;
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;
  IF trim(p_tipper_id) = trim(p_recipient_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_TIP_FORBIDDEN');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;
  IF v_kind NOT IN ('post', 'profile', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTENT_KIND');
  END IF;
  IF v_cur NOT IN ('PI', 'GHC') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CURRENCY');
  END IF;

  -- Recipient must be an enabled creator with tips enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_creator_profiles
    WHERE user_id = trim(p_recipient_id)
      AND is_enabled = true
      AND tips_enabled = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_NOT_TIPPABLE');
  END IF;

  SELECT * INTO v_existing
  FROM public.gh_tip_intents
  WHERE tipper_id = trim(p_tipper_id) AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'intentId', v_existing.id,
      'status', v_existing.status,
      'settlement', 'deferred'
    );
  END IF;

  v_id := 'tip_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_tip_intents (
    id, tipper_id, recipient_id, content_id, content_kind,
    amount_units, currency, status, idempotency_key, note
  ) VALUES (
    v_id,
    trim(p_tipper_id),
    trim(p_recipient_id),
    NULLIF(trim(COALESCE(p_content_id, '')), ''),
    v_kind,
    p_amount_units,
    v_cur,
    'initiated',
    trim(p_idempotency_key),
    NULLIF(trim(COALESCE(p_note, '')), '')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'intentId', v_id,
    'status', 'initiated',
    'settlement', 'deferred',
    'message', 'Tip intent recorded. Payment settlement is not enabled in this phase.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_tip_intent_create(text, text, text, text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_tip_intent_create(text, text, text, text, text, text, numeric, text) TO service_role;

-- Stage 3 foundation: Referral programme (attribution + gated 5% VIP GHC reward).
-- Ledger credit only via ghc_settle_referral_reward with source_event REFERRAL_REWARD_V1.
-- Requires issuance-guard amendment (202610181501) before settlement can post earned rows.

CREATE TABLE IF NOT EXISTS public.ghc_referral_codes (
  user_id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ghc_referral_codes_code
  ON public.ghc_referral_codes (lower(code));

CREATE TABLE IF NOT EXISTS public.ghc_referral_attributions (
  referred_user_id text PRIMARY KEY,
  referrer_user_id text NOT NULL,
  code_used text NOT NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_referral_no_self CHECK (referred_user_id <> referrer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ghc_referral_attr_referrer
  ON public.ghc_referral_attributions (referrer_user_id);

CREATE TABLE IF NOT EXISTS public.ghc_referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id text NOT NULL,
  referred_user_id text NOT NULL,
  membership_reference_id text NOT NULL,
  charged_ghc numeric(18,4) NOT NULL CHECK (charged_ghc > 0),
  reward_ghc numeric(18,4) NOT NULL CHECK (reward_ghc > 0),
  status text NOT NULL CHECK (status IN ('pending','posted','reversed','blocked')) DEFAULT 'pending',
  ledger_reference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  UNIQUE (referred_user_id),
  UNIQUE (membership_reference_id)
);

CREATE INDEX IF NOT EXISTS idx_ghc_referral_rewards_referrer
  ON public.ghc_referral_rewards (referrer_user_id, status);

ALTER TABLE public.ghc_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY ghc_referral_codes_select_own ON public.ghc_referral_codes
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY ghc_referral_codes_no_client_write ON public.ghc_referral_codes
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY ghc_referral_attr_select_party ON public.ghc_referral_attributions
  FOR SELECT USING (
    auth.uid()::text = referred_user_id OR auth.uid()::text = referrer_user_id
  );
CREATE POLICY ghc_referral_attr_no_client_write ON public.ghc_referral_attributions
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY ghc_referral_rewards_select_own ON public.ghc_referral_rewards
  FOR SELECT USING (auth.uid()::text = referrer_user_id);
CREATE POLICY ghc_referral_rewards_no_client_write ON public.ghc_referral_rewards
  FOR ALL USING (false) WITH CHECK (false);

-- Ensure every user can obtain a stable code (service role)
CREATE OR REPLACE FUNCTION public.ghc_referral_ensure_code(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_row public.ghc_referral_codes%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT * INTO v_row FROM public.ghc_referral_codes WHERE user_id = p_user_id;
  IF FOUND AND v_row.disabled_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', v_row.code, 'createdAt', extract(epoch from v_row.created_at)*1000);
  END IF;

  -- Code: GH + 8 chars from user hash (collision retry)
  FOR i IN 1..8 LOOP
    v_code := 'GH' || upper(substr(md5(p_user_id || clock_timestamp()::text || i::text), 1, 8));
    BEGIN
      INSERT INTO public.ghc_referral_codes (user_id, code)
      VALUES (p_user_id, v_code)
      ON CONFLICT (user_id) DO UPDATE SET disabled_at = NULL
      RETURNING * INTO v_row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;

  IF v_row.code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_GENERATE_FAILED');
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', v_row.code, 'createdAt', extract(epoch from v_row.created_at)*1000);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_referral_ensure_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_referral_ensure_code(text) TO service_role;

-- Attribute referred user to referrer by code (once, no self)
CREATE OR REPLACE FUNCTION public.ghc_referral_attribute(
  p_referred_user_id text,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(p_code, '')));
  v_ref public.ghc_referral_codes%ROWTYPE;
  v_existing public.ghc_referral_attributions%ROWTYPE;
BEGIN
  IF p_referred_user_id IS NULL OR btrim(p_referred_user_id) = '' OR v_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_existing FROM public.ghc_referral_attributions WHERE referred_user_id = p_referred_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'referrerUserId', v_existing.referrer_user_id);
  END IF;

  SELECT * INTO v_ref FROM public.ghc_referral_codes
   WHERE upper(code) = v_code AND disabled_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;
  IF v_ref.user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_REFERRAL');
  END IF;

  INSERT INTO public.ghc_referral_attributions (referred_user_id, referrer_user_id, code_used)
  VALUES (p_referred_user_id, v_ref.user_id, v_ref.code);

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'referrerUserId', v_ref.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_referral_attribute(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_referral_attribute(text, text) TO service_role;

-- Record pending reward after verified VIP GHC membership charge (does not post ledger yet)
CREATE OR REPLACE FUNCTION public.ghc_referral_queue_reward(
  p_referred_user_id text,
  p_membership_reference_id text,
  p_charged_ghc numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attr public.ghc_referral_attributions%ROWTYPE;
  v_reward numeric(18,4);
  v_row public.ghc_referral_rewards%ROWTYPE;
BEGIN
  IF p_referred_user_id IS NULL OR btrim(p_referred_user_id) = ''
     OR p_membership_reference_id IS NULL OR btrim(p_membership_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF p_charged_ghc IS NULL OR p_charged_ghc <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHARGE');
  END IF;

  SELECT * INTO v_attr FROM public.ghc_referral_attributions WHERE referred_user_id = p_referred_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'queued', false, 'reason', 'NO_ATTRIBUTION');
  END IF;

  -- 5% of actual charged GHC after discount
  v_reward := round(p_charged_ghc * 0.05, 4);
  IF v_reward < 0.0001 THEN
    RETURN jsonb_build_object('ok', true, 'queued', false, 'reason', 'REWARD_TOO_SMALL');
  END IF;

  INSERT INTO public.ghc_referral_rewards (
    referrer_user_id, referred_user_id, membership_reference_id, charged_ghc, reward_ghc, status
  ) VALUES (
    v_attr.referrer_user_id, p_referred_user_id, p_membership_reference_id, p_charged_ghc, v_reward, 'pending'
  )
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.ghc_referral_rewards WHERE referred_user_id = p_referred_user_id;
    RETURN jsonb_build_object('ok', true, 'queued', false, 'idempotent', true, 'rewardId', v_row.id, 'status', v_row.status);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'queued', true,
    'rewardId', v_row.id,
    'rewardGhc', v_reward,
    'referrerUserId', v_attr.referrer_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_referral_queue_reward(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_referral_queue_reward(text, text, numeric) TO service_role;

-- Settle pending reward to ledger (service_role; caller must enforce feature flag)
CREATE OR REPLACE FUNCTION public.ghc_settle_referral_reward(p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_referral_rewards%ROWTYPE;
  v_ref text;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM public.ghc_referral_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_row.status = 'posted' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'ledgerReferenceId', v_row.ledger_reference_id);
  END IF;
  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_SETTLEABLE', 'status', v_row.status);
  END IF;

  v_ref := 'referral_reward_' || v_row.id::text;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
  ) VALUES (
    v_row.referrer_user_id,
    'earned',
    v_row.reward_ghc,
    'posted',
    'Referral reward (5% of qualifying VIP GHC charge)',
    'REFERRAL_REWARD_V1',
    v_ref,
    jsonb_build_object(
      'rewardKind', 'REFERRAL_REWARD_V1',
      'referredUserId', v_row.referred_user_id,
      'membershipReferenceId', v_row.membership_reference_id,
      'chargedGhc', v_row.charged_ghc,
      'rewardGhc', v_row.reward_ghc
    ),
    v_now
  ) RETURNING id INTO v_tx_id;

  UPDATE public.ghc_referral_rewards
     SET status = 'posted',
         ledger_reference_id = v_ref,
         posted_at = v_now
   WHERE id = p_reward_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'ledgerReferenceId', v_ref,
    'txId', v_tx_id,
    'rewardGhc', v_row.reward_ghc
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_settle_referral_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_settle_referral_reward(uuid) TO service_role;

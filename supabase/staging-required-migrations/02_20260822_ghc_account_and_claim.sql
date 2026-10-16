-- GH Connect: server-backed account_created_at (trial anchor) + claim pending GHC
-- Does not replace ledger authority; extends existing ghc_transactions.

CREATE TABLE IF NOT EXISTS public.ghc_user_accounts (
  user_id              text PRIMARY KEY,
  account_created_at   timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghc_user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_user_accounts_select_own ON public.ghc_user_accounts;
CREATE POLICY ghc_user_accounts_select_own ON public.ghc_user_accounts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS ghc_user_accounts_no_client_write ON public.ghc_user_accounts;
CREATE POLICY ghc_user_accounts_no_client_write ON public.ghc_user_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Set account_created_at once; never move earlier/later on subsequent calls with different hints
CREATE OR REPLACE FUNCTION public.ghc_ensure_account_created_at(
  p_user_id text,
  p_hint timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_user_accounts%ROWTYPE;
  v_ts timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT * INTO v_row FROM public.ghc_user_accounts WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'userId', v_row.user_id,
      'accountCreatedAt', extract(epoch from v_row.account_created_at) * 1000,
      'created', false
    );
  END IF;

  v_ts := COALESCE(p_hint, now());
  INSERT INTO public.ghc_user_accounts (user_id, account_created_at)
  VALUES (p_user_id, v_ts)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.ghc_user_accounts WHERE user_id = p_user_id;
  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_row.user_id,
    'accountCreatedAt', extract(epoch from v_row.account_created_at) * 1000,
    'created', true
  );
END;
$$;

-- Claim pending GHC → posted available (idempotent by pending/reference)
CREATE OR REPLACE FUNCTION public.ghc_claim_pending(
  p_user_id text,
  p_hold_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_new_id uuid;
  v_ref text;
BEGIN
  IF p_user_id IS NULL OR p_hold_id IS NULL OR length(trim(p_hold_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Find pending row by id or reference_id
  SELECT * INTO v_pending
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND amount > 0
    AND (
      id::text = p_hold_id
      OR reference_id = p_hold_id
      OR (metadata->>'rewardId') = p_hold_id
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: already posted for this reference?
    SELECT * INTO v_posted
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND status = 'posted'
      AND kind = 'earned'
      AND amount > 0
      AND (reference_id = p_hold_id OR id::text = p_hold_id)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'transactionId', v_posted.id,
        'amount', v_posted.amount
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CLAIMABLE');
  END IF;

  IF COALESCE((v_pending.metadata->>'reviewRequired')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNDER_REVIEW');
  END IF;

  v_ref := COALESCE(v_pending.reference_id, v_pending.id::text);

  -- Already posted for same reference?
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND status = 'posted'
    AND kind = 'earned'
    AND reference_id = v_ref
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.ghc_transactions
    SET status = 'expired',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('claimedAt', now(), 'superseded', true)
    WHERE id = v_pending.id;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'transactionId', v_posted.id,
      'amount', v_posted.amount
    );
  END IF;

  UPDATE public.ghc_transactions
  SET status = 'expired',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('claimedAt', now(), 'claimedBy', p_user_id)
  WHERE id = v_pending.id;

  v_new_id := gen_random_uuid();
  INSERT INTO public.ghc_transactions (
    id, user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
  ) VALUES (
    v_new_id,
    p_user_id,
    'earned',
    v_pending.amount,
    'posted',
    v_pending.reason,
    COALESCE(v_pending.source_event, 'CLAIM'),
    v_ref,
    jsonb_build_object('fromPending', v_pending.id, 'claimedBy', p_user_id),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'transactionId', v_new_id,
    'amount', v_pending.amount,
    'referenceId', v_ref
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_ensure_account_created_at(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_claim_pending(text, text) TO service_role;

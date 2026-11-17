-- GH Connect — GHC authoritative ledger (Phase C)
-- Compatible with Postgres / Supabase. Ledger rows are the financial authority.
-- NO standalone users.ghc_balance column as source of truth.

-- Transaction kinds aligned with client economy-types
CREATE TABLE IF NOT EXISTS public.ghc_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  kind            text NOT NULL CHECK (kind IN (
    'earned','spent','purchased','pending','reversed','expired','adjusted',
    'transfer_out','transfer_in','transfer_request'
  )),
  amount          numeric(18, 4) NOT NULL,
  status          text NOT NULL CHECK (status IN (
    'pending','posted','failed','reversed','expired'
  )),
  reason          text NOT NULL DEFAULT '',
  source_event    text NOT NULL DEFAULT '',
  reference_id    text,
  request_id      text,
  counterparty_id text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ghc_tx_user_created
  ON public.ghc_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghc_tx_user_status_kind
  ON public.ghc_transactions (user_id, status, kind);
CREATE INDEX IF NOT EXISTS idx_ghc_tx_reference
  ON public.ghc_transactions (reference_id)
  WHERE reference_id IS NOT NULL;

-- Idempotency: one economic transfer_out per reference per sender
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_transfer_out_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'transfer_out' AND status = 'posted' AND reference_id IS NOT NULL;

-- Idempotency: one transfer_in per reference per recipient
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_transfer_in_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'transfer_in' AND status = 'posted' AND reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ghc_transfer_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id    text NOT NULL UNIQUE,
  requester_id    text NOT NULL,
  payer_id        text NOT NULL,
  amount          numeric(18, 4) NOT NULL CHECK (amount > 0),
  note            text,
  status          text NOT NULL CHECK (status IN (
    'PENDING','ACCEPTED','DECLINED','CANCELLED','EXPIRED'
  )) DEFAULT 'PENDING',
  transfer_ref    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ghc_req_payer_status
  ON public.ghc_transfer_requests (payer_id, status);
CREATE INDEX IF NOT EXISTS idx_ghc_req_requester_status
  ON public.ghc_transfer_requests (requester_id, status);

CREATE TABLE IF NOT EXISTS public.ghc_economy_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_id    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered       boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ghc_events_user
  ON public.ghc_economy_events (user_id, created_at DESC);

-- Optional block list used by transfer RPC when social graph is on DB
CREATE TABLE IF NOT EXISTS public.ghc_user_blocks (
  blocker_id text NOT NULL,
  blocked_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.ghc_account_flags (
  user_id    text PRIMARY KEY,
  restricted boolean NOT NULL DEFAULT false,
  suspended  boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Limits config (single source; seed defaults)
CREATE TABLE IF NOT EXISTS public.ghc_economy_limits (
  id                        int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_transfer              numeric(18,4) NOT NULL DEFAULT 1,
  max_transfer              numeric(18,4) NOT NULL DEFAULT 5000,
  daily_send_limit          numeric(18,4) NOT NULL DEFAULT 2000,
  daily_receive_limit       numeric(18,4) NOT NULL DEFAULT 5000,
  daily_request_limit       int NOT NULL DEFAULT 20,
  maximum_open_requests     int NOT NULL DEFAULT 10,
  request_expiry_ms         bigint NOT NULL DEFAULT 604800000,
  max_daily_earn            numeric(18,4) NOT NULL DEFAULT 500,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ghc_economy_limits (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Spendable balance from posted ledger (never a free-standing balance column)
CREATE OR REPLACE FUNCTION public.ghc_available_balance(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND status = 'posted'
    AND kind <> 'transfer_request';
$$;

-- Atomic transfer: sender from auth.uid() / JWT claim — never client sender
CREATE OR REPLACE FUNCTION public.ghc_execute_transfer(
  p_sender_id     text,
  p_to_user_id    text,
  p_amount        numeric,
  p_reference_id  text,
  p_note          text DEFAULT NULL,
  p_request_id    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits      public.ghc_economy_limits%ROWTYPE;
  v_available   numeric;
  v_sent_today  numeric;
  v_recv_today  numeric;
  v_existing_out public.ghc_transactions%ROWTYPE;
  v_existing_in  public.ghc_transactions%ROWTYPE;
  v_debit_id    uuid;
  v_credit_id   uuid;
  v_now         timestamptz := now();
BEGIN
  IF p_sender_id IS NULL OR length(trim(p_sender_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;
  IF p_to_user_id IS NULL OR length(trim(p_to_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENT', 'message', 'Recipient required');
  END IF;
  IF p_sender_id = p_to_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Cannot send to yourself');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Invalid amount');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_FAILED', 'message', 'referenceId required');
  END IF;

  SELECT * INTO v_limits FROM public.ghc_economy_limits WHERE id = 1 FOR SHARE;
  IF p_amount < v_limits.min_transfer OR p_amount > v_limits.max_transfer THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Amount outside transfer limits');
  END IF;

  -- Serialize concurrent spends for this sender
  PERFORM pg_advisory_xact_lock(hashtext('ghc_send:' || p_sender_id));

  -- Account flags
  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_sender_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  -- Blocks either direction
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_sender_id AND blocked_id = p_to_user_id)
       OR (blocker_id = p_to_user_id AND blocked_id = p_sender_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Transfers not allowed');
  END IF;

  -- Idempotency: existing posted out
  SELECT * INTO v_existing_out FROM public.ghc_transactions
   WHERE user_id = p_sender_id AND reference_id = p_reference_id
     AND kind = 'transfer_out' AND status = 'posted'
   LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_existing_in FROM public.ghc_transactions
     WHERE user_id = p_to_user_id AND reference_id = p_reference_id
       AND kind = 'transfer_in' AND status = 'posted'
     LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'referenceId', p_reference_id,
      'debitTx', jsonb_build_object(
        'id', v_existing_out.id, 'userId', v_existing_out.user_id, 'kind', v_existing_out.kind,
        'amount', v_existing_out.amount, 'status', v_existing_out.status,
        'referenceId', v_existing_out.reference_id, 'reason', v_existing_out.reason,
        'createdAt', extract(epoch from v_existing_out.created_at) * 1000
      ),
      'creditTx', CASE WHEN v_existing_in.id IS NOT NULL THEN jsonb_build_object(
        'id', v_existing_in.id, 'userId', v_existing_in.user_id, 'kind', v_existing_in.kind,
        'amount', v_existing_in.amount, 'status', v_existing_in.status,
        'referenceId', v_existing_in.reference_id, 'reason', v_existing_in.reason,
        'createdAt', extract(epoch from v_existing_in.created_at) * 1000
      ) ELSE NULL END
    );
  END IF;

  v_available := public.ghc_available_balance(p_sender_id);
  IF v_available < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient available GHC');
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_sent_today
  FROM public.ghc_transactions
  WHERE user_id = p_sender_id AND kind = 'transfer_out' AND status = 'posted'
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_sent_today + p_amount > v_limits.daily_send_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Daily send limit reached');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_recv_today
  FROM public.ghc_transactions
  WHERE user_id = p_to_user_id AND kind = 'transfer_in' AND status = 'posted'
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_recv_today + p_amount > v_limits.daily_receive_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Recipient daily receive limit reached');
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_sender_id, 'transfer_out', -p_amount, 'posted',
    COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
    'WALLET_TRANSFER', p_reference_id, p_request_id, p_to_user_id,
    jsonb_build_object('direction','send','transferStatus','completed','note', p_note),
    v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_to_user_id, 'transfer_in', p_amount, 'posted',
    COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
    'WALLET_TRANSFER', p_reference_id, p_request_id, p_sender_id,
    jsonb_build_object('direction','receive','transferStatus','completed','note', p_note),
    v_now
  ) RETURNING id INTO v_credit_id;

  INSERT INTO public.ghc_economy_events (user_id, event_type, payload, reference_id)
  VALUES
    (p_sender_id, 'GHC_SENT', jsonb_build_object('amount', p_amount, 'toUserId', p_to_user_id), p_reference_id),
    (p_to_user_id, 'GHC_RECEIVED', jsonb_build_object('amount', p_amount, 'fromUserId', p_sender_id), p_reference_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'referenceId', p_reference_id,
    'debitTx', jsonb_build_object(
      'id', v_debit_id, 'userId', p_sender_id, 'kind', 'transfer_out',
      'amount', -p_amount, 'status', 'posted', 'referenceId', p_reference_id,
      'reason', COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    ),
    'creditTx', jsonb_build_object(
      'id', v_credit_id, 'userId', p_to_user_id, 'kind', 'transfer_in',
      'amount', p_amount, 'status', 'posted', 'referenceId', p_reference_id,
      'reason', COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC;
-- Grant only to service role / authenticated via controlled API path

ALTER TABLE public.ghc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_economy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_account_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_economy_limits ENABLE ROW LEVEL SECURITY;

-- Clients may SELECT own ledger rows; INSERT/UPDATE only via SECURITY DEFINER RPCs / service role
CREATE POLICY ghc_tx_select_own ON public.ghc_transactions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY ghc_tx_no_client_insert ON public.ghc_transactions
  FOR INSERT WITH CHECK (false);

CREATE POLICY ghc_tx_no_client_update ON public.ghc_transactions
  FOR UPDATE USING (false);

CREATE POLICY ghc_tx_no_client_delete ON public.ghc_transactions
  FOR DELETE USING (false);

CREATE POLICY ghc_req_select_party ON public.ghc_transfer_requests
  FOR SELECT USING (
    auth.uid()::text = requester_id OR auth.uid()::text = payer_id
  );

CREATE POLICY ghc_req_no_client_mutate ON public.ghc_transfer_requests
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY ghc_events_select_own ON public.ghc_economy_events
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY ghc_limits_read ON public.ghc_economy_limits
  FOR SELECT USING (true);

-- GREENHAVEN 0.70.3 — CANONICAL SUPABASE INSTALLER
-- GENERATED FILE — DO NOT EDIT BY HAND
-- Source of truth: supabase/migrations/*.sql
-- Regenerate with: npm run db:generate-canonical
-- This installer includes every current clean migration in lexical dependency order.
-- Development history remains in supabase/migrations/.

-- ============================================================================
-- SOURCE 001: 20261022010001_ghc_economy_ledger.sql
-- SHA256: b9aa72335adc4898d4940eb56e01bbde6c9c00cb432aae9add86d79d5c08c997
-- ============================================================================
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

-- ============================================================================
-- SOURCE 002: 20261022010002_ghc_economy_events_rls.sql
-- SHA256: ad65502a5825c4e93cb9bd2b08f621210e6d53de68303e1773a4fdf30ce5518e
-- ============================================================================
-- D6.1: RLS on economy notification events — clients cannot forge financial notifications

ALTER TABLE public.ghc_economy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_economy_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);
  -- Note: production apps using Pi user ids (non-Supabase auth) should rely on
  -- service-role API routes only; tighten USING to auth.uid()::text = user_id
  -- when Supabase Auth subjects match user_id.

DROP POLICY IF EXISTS ghc_economy_events_no_client_write ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_write ON public.ghc_economy_events
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS ghc_economy_events_no_client_update ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_update ON public.ghc_economy_events
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS ghc_economy_events_no_client_delete ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_delete ON public.ghc_economy_events
  FOR DELETE
  USING (false);

-- Service role bypasses RLS; all writes go through SECURITY DEFINER RPCs / service role.

-- ============================================================================
-- SOURCE 003: 20261022010003_ghc_notification_events.sql
-- SHA256: 17073bd8acc5730de5a620d361032254c165beb36d271cbc172976f691c5718d
-- ============================================================================
-- Phase D6: notification-oriented fields on economy events + dedupe

ALTER TABLE public.ghc_economy_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_economy_events_dedupe
  ON public.ghc_economy_events (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ghc_events_user_unread
  ON public.ghc_economy_events (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ghc_events_user_type
  ON public.ghc_economy_events (user_id, event_type, created_at DESC);

-- Idempotent insert of a user-facing economy notification event
CREATE OR REPLACE FUNCTION public.ghc_record_notification_event(
  p_user_id text,
  p_event_type text,
  p_title text,
  p_body text,
  p_reference_id text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.ghc_economy_events%ROWTYPE;
  created public.ghc_economy_events%ROWTYPE;
  dkey text;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER');
  END IF;
  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TYPE');
  END IF;

  dkey := COALESCE(
    NULLIF(trim(p_dedupe_key), ''),
    CASE
      WHEN p_reference_id IS NOT NULL THEN p_user_id || ':' || p_event_type || ':' || p_reference_id
      ELSE NULL
    END
  );

  IF dkey IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.ghc_economy_events
    WHERE user_id = p_user_id AND dedupe_key = dkey
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'id', existing.id,
        'eventType', existing.event_type,
        'dedupeKey', existing.dedupe_key
      );
    END IF;
  END IF;

  INSERT INTO public.ghc_economy_events (
    user_id, event_type, payload, reference_id, request_id,
    title, body, dedupe_key, expires_at, delivered
  ) VALUES (
    p_user_id, p_event_type, COALESCE(p_payload, '{}'::jsonb),
    p_reference_id, p_request_id,
    p_title, p_body, dkey, p_expires_at, false
  )
  RETURNING * INTO created;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'id', created.id,
    'eventType', created.event_type,
    'dedupeKey', created.dedupe_key
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing
  FROM public.ghc_economy_events
  WHERE user_id = p_user_id AND dedupe_key = dkey
  LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'id', existing.id,
    'eventType', existing.event_type,
    'dedupeKey', existing.dedupe_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) TO service_role;

-- ============================================================================
-- SOURCE 004: 20261022010004_ghc_public_identities.sql
-- SHA256: 7b71b45f584a13e424e706fc30e2b4c44255bb90e094bcffef010025613156cf
-- ============================================================================
-- Phase D5: server-authoritative GreenHaven public IDs
-- Safe public receive identity (not email/phone/token/internal-only UUID)

CREATE TABLE IF NOT EXISTS public.ghc_public_identities (
  user_id       text PRIMARY KEY,
  public_id     text NOT NULL,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_public_id_format CHECK (public_id ~ '^GH-[A-Z0-9]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_public_identities_public_id
  ON public.ghc_public_identities (public_id);

CREATE INDEX IF NOT EXISTS idx_ghc_public_identities_public_id
  ON public.ghc_public_identities (public_id);

ALTER TABLE public.ghc_public_identities ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read public identity rows (no email/phone/balance)
DROP POLICY IF EXISTS ghc_public_identities_select ON public.ghc_public_identities;
CREATE POLICY ghc_public_identities_select ON public.ghc_public_identities
  FOR SELECT
  USING (true);

-- Writes only via service role / RPC (no direct client insert/update)
DROP POLICY IF EXISTS ghc_public_identities_no_client_write ON public.ghc_public_identities;
CREATE POLICY ghc_public_identities_no_client_write ON public.ghc_public_identities
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Ensure public id for a user (service-role / security definer)
CREATE OR REPLACE FUNCTION public.ghc_ensure_public_id(
  p_user_id text,
  p_display_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_preferred text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.ghc_public_identities%ROWTYPE;
  candidate text;
  attempts int := 0;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER');
  END IF;

  SELECT * INTO existing FROM public.ghc_public_identities WHERE user_id = p_user_id;
  IF FOUND THEN
    IF p_display_name IS NOT NULL OR p_avatar_url IS NOT NULL THEN
      UPDATE public.ghc_public_identities
      SET
        display_name = COALESCE(p_display_name, display_name),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO existing;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'userId', existing.user_id,
      'publicId', existing.public_id,
      'displayName', existing.display_name,
      'avatarUrl', existing.avatar_url,
      'created', false
    );
  END IF;

  -- Prefer client-compatible preferred ID when unique and well-formed
  IF p_preferred IS NOT NULL AND p_preferred ~ '^GH-[A-Z0-9]{6}$' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = p_preferred) THEN
      candidate := p_preferred;
    END IF;
  END IF;

  WHILE candidate IS NULL AND attempts < 12 LOOP
    attempts := attempts + 1;
    candidate := 'GH-' || upper(substr(md5(p_user_id || clock_timestamp()::text || attempts::text), 1, 6));
    IF EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = candidate) THEN
      candidate := NULL;
    END IF;
  END LOOP;

  IF candidate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ID_COLLISION');
  END IF;

  INSERT INTO public.ghc_public_identities (user_id, public_id, display_name, avatar_url)
  VALUES (p_user_id, candidate, p_display_name, p_avatar_url)
  RETURNING * INTO existing;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', existing.user_id,
    'publicId', existing.public_id,
    'displayName', existing.display_name,
    'avatarUrl', existing.avatar_url,
    'created', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_resolve_public_id(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.ghc_public_identities%ROWTYPE;
  normalized text;
BEGIN
  normalized := upper(trim(both FROM coalesce(p_public_id, '')));
  IF left(normalized, 1) = '@' THEN
    normalized := substr(normalized, 2);
  END IF;
  IF normalized !~ '^GH-[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ID');
  END IF;

  SELECT * INTO row FROM public.ghc_public_identities WHERE public_id = normalized;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  -- Minimum public projection only
  RETURN jsonb_build_object(
    'ok', true,
    'userId', row.user_id,
    'publicId', row.public_id,
    'displayName', row.display_name,
    'avatarUrl', row.avatar_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_resolve_public_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id(text) TO service_role;

-- ============================================================================
-- SOURCE 005: 20261022010005_ghc_rls_tighten_events.sql
-- SHA256: 6d833a6ca821276eb643634407792e4fd5a4dbcaab4f98ebdf46da688882e801
-- ============================================================================
-- D6.3 / D7: remove permissive OR true on economy events SELECT.
-- Clients must not read other users' notification/event rows via PostgREST.
-- Server uses service_role (bypasses RLS) for authorized notification APIs.

DROP POLICY IF EXISTS ghc_economy_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS ghc_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- SOURCE 006: 20261022010006_ghc_transfer_request_rpcs.sql
-- SHA256: c7bc36f3bcdff73531ebc07e163ef07b5e36df002284401d52b59ee29b1ffe69
-- ============================================================================
-- D6.2: Server-authoritative transfer-request RPCs (create / accept / decline / cancel)
-- Accept is atomic: ledger double-entry + request ACCEPTED in one transaction.

-- Lazy expire a single request row (idempotent)
CREATE OR REPLACE FUNCTION public.ghc_expire_request_if_needed(p_reference_id text)
RETURNS public.ghc_transfer_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF r.status = 'PENDING' AND r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests
    SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING'
    RETURNING * INTO r;

    PERFORM public.ghc_record_notification_event(
      r.requester_id, 'GHC_REQUEST_EXPIRED',
      'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'requests'),
      r.requester_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id,
      NULL
    );
    PERFORM public.ghc_record_notification_event(
      r.payer_id, 'GHC_REQUEST_EXPIRED',
      'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'requests'),
      r.payer_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id,
      NULL
    );
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_create_transfer_request(
  p_requester_id  text,
  p_payer_id      text,
  p_amount        numeric,
  p_reference_id  text,
  p_note          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits public.ghc_economy_limits%ROWTYPE;
  v_existing public.ghc_transfer_requests%ROWTYPE;
  v_open int;
  v_daily int;
  v_now timestamptz := now();
  v_req public.ghc_transfer_requests%ROWTYPE;
BEGIN
  IF p_requester_id IS NULL OR length(trim(p_requester_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;
  IF p_payer_id IS NULL OR length(trim(p_payer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENT', 'message', 'Payer required');
  END IF;
  IF p_requester_id = p_payer_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SELF_TRANSFER', 'message', 'Cannot request from yourself');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT', 'message', 'Invalid amount');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_FAILED', 'message', 'referenceId required');
  END IF;

  SELECT * INTO v_limits FROM public.ghc_economy_limits WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SERVER_UNAVAILABLE', 'message', 'Limits not configured');
  END IF;

  IF p_amount < v_limits.min_transfer OR p_amount > v_limits.max_transfer THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Amount outside limits');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_requester_id AND blocked_id = p_payer_id)
       OR (blocker_id = p_payer_id AND blocked_id = p_requester_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Not allowed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_requester_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  SELECT * INTO v_existing FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'request', jsonb_build_object(
        'id', v_existing.id,
        'referenceId', v_existing.reference_id,
        'requesterId', v_existing.requester_id,
        'payerId', v_existing.payer_id,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'note', v_existing.note,
        'createdAt', extract(epoch from v_existing.created_at) * 1000,
        'expiresAt', extract(epoch from v_existing.expires_at) * 1000
      )
    );
  END IF;

  SELECT COUNT(*) INTO v_open
  FROM public.ghc_transfer_requests
  WHERE requester_id = p_requester_id AND status = 'PENDING';

  IF v_open >= v_limits.maximum_open_requests THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_LIMIT_EXCEEDED', 'message', 'Too many open requests');
  END IF;

  SELECT COUNT(*) INTO v_daily
  FROM public.ghc_transfer_requests
  WHERE requester_id = p_requester_id
    AND created_at >= date_trunc('day', v_now AT TIME ZONE 'UTC');

  IF v_daily >= v_limits.daily_request_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_LIMIT_EXCEEDED', 'message', 'Daily request limit reached');
  END IF;

  INSERT INTO public.ghc_transfer_requests (
    reference_id, requester_id, payer_id, amount, note, status, expires_at
  ) VALUES (
    p_reference_id, p_requester_id, p_payer_id, p_amount,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    'PENDING',
    v_now + (v_limits.request_expiry_ms * interval '1 millisecond')
  )
  RETURNING * INTO v_req;

  PERFORM public.ghc_record_notification_event(
    p_payer_id, 'GHC_REQUEST_CREATED',
    'GHC request',
    'Someone requested ' || p_amount::text || ' GHC from you.',
    p_reference_id, p_reference_id,
    jsonb_build_object(
      'amount', p_amount, 'currency', 'GHC',
      'counterpartyId', p_requester_id, 'open', 'requests', 'role', 'incoming_request'
    ),
    p_payer_id || ':GHC_REQUEST_CREATED:' || p_reference_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'request', jsonb_build_object(
      'id', v_req.id,
      'referenceId', v_req.reference_id,
      'requesterId', v_req.requester_id,
      'payerId', v_req.payer_id,
      'amount', v_req.amount,
      'status', v_req.status,
      'note', v_req.note,
      'createdAt', extract(epoch from v_req.created_at) * 1000,
      'expiresAt', extract(epoch from v_req.expires_at) * 1000
    )
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id;
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', true,
    'request', jsonb_build_object(
      'id', v_existing.id,
      'referenceId', v_existing.reference_id,
      'requesterId', v_existing.requester_id,
      'payerId', v_existing.payer_id,
      'amount', v_existing.amount,
      'status', v_existing.status,
      'note', v_existing.note,
      'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'expiresAt', extract(epoch from v_existing.expires_at) * 1000
    )
  );
END;
$$;

-- Atomic accept: lock request → transfer via ghc_execute_transfer → mark ACCEPTED
CREATE OR REPLACE FUNCTION public.ghc_accept_transfer_request(
  p_actor_id      text,
  p_reference_id  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
  xfer jsonb;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED', 'message', 'Authentication required');
  END IF;

  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;

  -- Lazy expire under lock
  IF r.status = 'PENDING' AND r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests
    SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING'
    RETURNING * INTO r;
    PERFORM public.ghc_record_notification_event(
      r.requester_id, 'GHC_REQUEST_EXPIRED', 'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'open', 'requests'),
      r.requester_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id, NULL
    );
    PERFORM public.ghc_record_notification_event(
      r.payer_id, 'GHC_REQUEST_EXPIRED', 'Request expired',
      'The ' || r.amount::text || ' GHC request has expired.',
      r.reference_id, r.reference_id,
      jsonb_build_object('amount', r.amount, 'open', 'requests'),
      r.payer_id || ':GHC_REQUEST_EXPIRED:' || r.reference_id, NULL
    );
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
  END IF;

  IF r.payer_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the payer may accept');
  END IF;

  IF r.status = 'ACCEPTED' THEN
    -- Idempotent: return existing transfer result
    xfer := public.ghc_execute_transfer(
      r.payer_id, r.requester_id, r.amount, r.reference_id, r.note, r.reference_id
    );
    RETURN xfer;
  END IF;

  IF r.status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Request is ' || r.status);
  END IF;

  -- Money movement (idempotent on reference_id inside ghc_execute_transfer)
  xfer := public.ghc_execute_transfer(
    r.payer_id, r.requester_id, r.amount, r.reference_id, r.note, r.reference_id
  );

  IF (xfer->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN xfer;
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'ACCEPTED', transfer_ref = r.reference_id, resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_REQUEST_ACCEPTED',
    'Request accepted',
    'Your ' || r.amount::text || ' GHC request was accepted.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'open', 'transaction'),
    r.requester_id || ':GHC_REQUEST_ACCEPTED:' || r.reference_id,
    NULL
  );

  -- SENT/RECEIVED already inserted by ghc_execute_transfer; ensure titled notifs
  PERFORM public.ghc_record_notification_event(
    r.payer_id, 'GHC_SENT',
    'GHC sent',
    r.amount::text || ' GHC sent.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'role', 'sent', 'open', 'transaction'),
    r.payer_id || ':GHC_SENT:' || r.reference_id,
    NULL
  );
  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_RECEIVED',
    'GHC received',
    'You received ' || r.amount::text || ' GHC.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'currency', 'GHC', 'role', 'received', 'open', 'transaction'),
    r.requester_id || ':GHC_RECEIVED:' || r.reference_id,
    NULL
  );

  RETURN xfer;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_decline_transfer_request(
  p_actor_id text,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;
  IF r.payer_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the payer may decline');
  END IF;
  IF r.status = 'DECLINED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'DECLINED');
  END IF;
  IF r.status <> 'PENDING' THEN
    IF r.status = 'PENDING' AND r.expires_at <= now() THEN
      UPDATE public.ghc_transfer_requests SET status = 'EXPIRED', resolved_at = now()
      WHERE reference_id = p_reference_id;
      RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Request is ' || r.status);
  END IF;
  IF r.expires_at <= now() THEN
    UPDATE public.ghc_transfer_requests SET status = 'EXPIRED', resolved_at = now()
    WHERE reference_id = p_reference_id AND status = 'PENDING';
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_EXPIRED', 'message', 'Request expired');
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'DECLINED', resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.requester_id, 'GHC_REQUEST_DECLINED',
    'Request declined',
    'Your ' || r.amount::text || ' GHC request was declined.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'open', 'requests'),
    r.requester_id || ':GHC_REQUEST_DECLINED:' || r.reference_id,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'status', 'DECLINED', 'referenceId', p_reference_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_cancel_transfer_request(
  p_actor_id text,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ghc_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.ghc_transfer_requests WHERE reference_id = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_FOUND', 'message', 'Request not found');
  END IF;
  IF r.requester_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_NOT_AUTHORIZED', 'message', 'Only the requester may cancel');
  END IF;
  IF r.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'CANCELLED');
  END IF;
  IF r.status = 'ACCEPTED' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUEST_CLOSED', 'message', 'Already paid');
  END IF;
  IF r.status <> 'PENDING' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', r.status);
  END IF;

  UPDATE public.ghc_transfer_requests
  SET status = 'CANCELLED', resolved_at = now()
  WHERE reference_id = p_reference_id AND status = 'PENDING';

  PERFORM public.ghc_record_notification_event(
    r.payer_id, 'GHC_REQUEST_CANCELLED',
    'Request cancelled',
    'A ' || r.amount::text || ' GHC request was cancelled.',
    r.reference_id, r.reference_id,
    jsonb_build_object('amount', r.amount, 'open', 'requests'),
    r.payer_id || ':GHC_REQUEST_CANCELLED:' || r.reference_id,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'status', 'CANCELLED', 'referenceId', p_reference_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_expire_request_if_needed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_accept_transfer_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_decline_transfer_request(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_cancel_transfer_request(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_expire_request_if_needed(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_accept_transfer_request(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_decline_transfer_request(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_cancel_transfer_request(text, text) TO service_role;

ALTER TABLE public.ghc_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_transfer_requests_no_client_write ON public.ghc_transfer_requests;
CREATE POLICY ghc_transfer_requests_no_client_write ON public.ghc_transfer_requests
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- SOURCE 007: 20261022010007_ghc_account_and_claim.sql
-- SHA256: 19bed3e9585a8a8739cf9ba4d1d31521c4ac5bde03057fb05eeb128cf639d54c
-- ============================================================================
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

-- ============================================================================
-- SOURCE 008: 20261022010008_economy_v12_claim_streak_and_population.sql
-- SHA256: 862824f99b1887fed6d3bf56d2bfbe8ed5b26715d6bd04e499c1731da0d24f16
-- ============================================================================
-- ECONOMY_VERSION 1.2 — additive only (no destructive changes, no ledger rewrites)
-- Claim/streak authoritative state + economic population metrics support

-- ---------------------------------------------------------------------------
-- 1. Per-user claim / streak state (authoritative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_claim_streak_state (
  user_id                  text PRIMARY KEY,
  cycle_day                int NOT NULL DEFAULT 0
    CHECK (cycle_day >= 0 AND cycle_day <= 7),
  completed_cycles         int NOT NULL DEFAULT 0
    CHECK (completed_cycles >= 0),
  last_claim_day_key       date,
  total_successful_claims  int NOT NULL DEFAULT 0
    CHECK (total_successful_claims >= 0),
  economic_version         text NOT NULL DEFAULT '1.2',
  last_idempotency_key     text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_claim_streak_idempotency
  ON public.ghc_claim_streak_state (last_idempotency_key)
  WHERE last_idempotency_key IS NOT NULL;

ALTER TABLE public.ghc_claim_streak_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_claim_streak_state_no_client ON public.ghc_claim_streak_state;
CREATE POLICY ghc_claim_streak_state_no_client ON public.ghc_claim_streak_state
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. Economic eligibility flags (additive; defaults keep users eligible)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_user_economic_status (
  user_id                  text PRIMARY KEY,
  is_verified              boolean NOT NULL DEFAULT true,
  is_suspended             boolean NOT NULL DEFAULT false,
  is_suspected_duplicate   boolean NOT NULL DEFAULT false,
  last_active_at           timestamptz,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghc_user_economic_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_user_economic_status_no_client ON public.ghc_user_economic_status;
CREATE POLICY ghc_user_economic_status_no_client ON public.ghc_user_economic_status
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. Population stats (service-role / security definer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_economic_population_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered bigint := 0;
  v_verified bigint := 0;
  v_eligible bigint := 0;
  v_active bigint := 0;
  v_suspended bigint := 0;
  v_dupes bigint := 0;
BEGIN
  -- registered: known account anchors
  SELECT COUNT(*) INTO v_registered FROM public.ghc_user_accounts;

  -- verified: public identity present OR explicit verified flag
  SELECT COUNT(*) INTO v_verified
  FROM (
    SELECT user_id FROM public.ghc_public_identities
    UNION
    SELECT user_id FROM public.ghc_user_economic_status WHERE is_verified = true
  ) v;

  SELECT COUNT(*) INTO v_suspended
  FROM public.ghc_user_economic_status WHERE is_suspended = true;

  SELECT COUNT(*) INTO v_dupes
  FROM public.ghc_user_economic_status WHERE is_suspected_duplicate = true;

  -- eligibleEconomicUsers: public identity, not suspended, not suspected duplicate
  SELECT COUNT(*) INTO v_eligible
  FROM public.ghc_public_identities p
  LEFT JOIN public.ghc_user_economic_status s ON s.user_id = p.user_id
  WHERE COALESCE(s.is_suspended, false) = false
    AND COALESCE(s.is_suspected_duplicate, false) = false;

  -- active: eligible with activity in last 90 days (status) OR any claim streak row
  SELECT COUNT(*) INTO v_active
  FROM public.ghc_public_identities p
  LEFT JOIN public.ghc_user_economic_status s ON s.user_id = p.user_id
  LEFT JOIN public.ghc_claim_streak_state c ON c.user_id = p.user_id
  WHERE COALESCE(s.is_suspended, false) = false
    AND COALESCE(s.is_suspected_duplicate, false) = false
    AND (
      s.last_active_at IS NOT NULL AND s.last_active_at > now() - interval '90 days'
      OR c.last_claim_day_key IS NOT NULL
      OR c.total_successful_claims > 0
    );

  -- Floor at 1 so early network m stays defined
  IF v_eligible < 1 THEN
    v_eligible := 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registeredUsers', v_registered,
    'verifiedUsers', v_verified,
    'eligibleEconomicUsers', v_eligible,
    'activeEconomicUsers', v_active,
    'suspendedUsers', v_suspended,
    'suspectedDuplicateUsers', v_dupes
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Get claim streak (service-role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_get_claim_streak(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_claim_streak_state%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;

  SELECT * INTO v_row FROM public.ghc_claim_streak_state WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'userId', p_user_id,
      'cycleDay', 0,
      'completedCycles', 0,
      'lastClaimDayKey', NULL,
      'totalSuccessfulClaims', 0,
      'economicVersion', '1.2',
      'lastIdempotencyKey', NULL,
      'exists', false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_row.user_id,
    'cycleDay', v_row.cycle_day,
    'completedCycles', v_row.completed_cycles,
    'lastClaimDayKey', v_row.last_claim_day_key,
    'totalSuccessfulClaims', v_row.total_successful_claims,
    'economicVersion', v_row.economic_version,
    'lastIdempotencyKey', v_row.last_idempotency_key,
    'exists', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Atomic claim-day commit (idempotent, concurrent-safe)
--    Does NOT write ledger amounts — only streak authority + day lock.
--    Returns alreadyClaimed if same calendar day already committed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_commit_claim_day(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day int,
  p_completed_cycles int,
  p_idempotency_key text,
  p_economic_version text DEFAULT '1.2'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_claim_streak_state%ROWTYPE;
  v_total int;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_claim_day_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAY');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_IDEMPOTENCY');
  END IF;
  IF p_cycle_day IS NULL OR p_cycle_day < 1 OR p_cycle_day > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CYCLE_DAY');
  END IF;

  -- Lock existing row if any
  SELECT * INTO v_row
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- Idempotent: same key
    IF v_row.last_idempotency_key IS NOT NULL
       AND v_row.last_idempotency_key = p_idempotency_key THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'idempotent', true,
        'cycleDay', v_row.cycle_day,
        'completedCycles', v_row.completed_cycles,
        'lastClaimDayKey', v_row.last_claim_day_key
      );
    END IF;

    -- Same day already claimed with different key
    IF v_row.last_claim_day_key IS NOT NULL
       AND v_row.last_claim_day_key = p_claim_day_key THEN
      RETURN jsonb_build_object(
        'ok', true,
        'alreadyClaimed', true,
        'idempotent', true,
        'cycleDay', v_row.cycle_day,
        'completedCycles', v_row.completed_cycles,
        'lastClaimDayKey', v_row.last_claim_day_key
      );
    END IF;

    v_total := v_row.total_successful_claims + 1;
    UPDATE public.ghc_claim_streak_state
    SET
      cycle_day = p_cycle_day,
      completed_cycles = GREATEST(p_completed_cycles, 0),
      last_claim_day_key = p_claim_day_key,
      total_successful_claims = v_total,
      economic_version = COALESCE(p_economic_version, '1.2'),
      last_idempotency_key = p_idempotency_key,
      updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', false,
      'idempotent', false,
      'cycleDay', p_cycle_day,
      'completedCycles', GREATEST(p_completed_cycles, 0),
      'lastClaimDayKey', p_claim_day_key,
      'totalSuccessfulClaims', v_total
    );
  END IF;

  -- Insert new row; unique day enforced by later checks
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (
    p_user_id, p_cycle_day, GREATEST(p_completed_cycles, 0), p_claim_day_key,
    1, COALESCE(p_economic_version, '1.2'), p_idempotency_key, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Re-read under race
  SELECT * INTO v_row
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_row.last_idempotency_key = p_idempotency_key
     OR v_row.last_claim_day_key = p_claim_day_key THEN
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', v_row.last_idempotency_key <> p_idempotency_key
        AND v_row.last_claim_day_key = p_claim_day_key,
      'idempotent', true,
      'cycleDay', v_row.cycle_day,
      'completedCycles', v_row.completed_cycles,
      'lastClaimDayKey', v_row.last_claim_day_key,
      'totalSuccessfulClaims', v_row.total_successful_claims
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'idempotent', false,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(p_completed_cycles, 0),
    'lastClaimDayKey', p_claim_day_key,
    'totalSuccessfulClaims', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_economic_population_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_get_claim_streak(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) TO service_role;

-- ============================================================================
-- SOURCE 009: 20261022010009_economy_v12_atomic_daily_claim.sql
-- SHA256: 0a6ad47cb083ef4f891ff4377187171558eab91ae33d87414c1e9339a2b2e4d3
-- ============================================================================
-- ECONOMY_VERSION 1.2 — atomic daily claim (streak + ledger) in one transaction
-- Additive only. Does not rewrite historical ledger rows or balances.

-- Idempotent earned credits per user+reference (covers daily claim keys)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_earned_posted_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'earned' AND status = 'posted' AND reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Atomic daily claim: validate day lock + insert ledger legs + commit streak
-- Amounts are computed server-side in the app and passed in; RPC enforces
-- positivity, 80/20 consistency (within 0.0001), and exactly-once identity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_execute_daily_claim_v12(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day int,
  p_completed_cycles int,
  p_idempotency_key text,
  p_gross_amount numeric,
  p_user_amount numeric,
  p_reserve_amount numeric,
  p_base_gross numeric,
  p_m numeric,
  p_g numeric,
  p_economic_version text DEFAULT '1.2',
  p_missed_day_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak public.ghc_claim_streak_state%ROWTYPE;
  v_user_tx public.ghc_transactions%ROWTYPE;
  v_rsv_tx public.ghc_transactions%ROWTYPE;
  v_user_id uuid;
  v_rsv_id uuid;
  v_reserve_user text := '__PROTOCOL_RESERVE__';
  v_rsv_ref text;
  v_total int;
  v_meta jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_claim_day_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAY');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_IDEMPOTENCY');
  END IF;
  IF p_cycle_day IS NULL OR p_cycle_day < 1 OR p_cycle_day > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CYCLE_DAY');
  END IF;
  IF p_user_amount IS NULL OR p_user_amount <= 0 OR p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_reserve_amount IS NULL OR p_reserve_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RESERVE');
  END IF;
  -- 80/20 integrity: user + reserve must equal gross within 0.0001
  IF abs((p_user_amount + p_reserve_amount) - p_gross_amount) > 0.0001 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SPLIT_MISMATCH');
  END IF;
  IF abs(p_user_amount - (p_gross_amount * 0.8)) > 0.0002 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_SHARE_MISMATCH');
  END IF;

  v_rsv_ref := p_idempotency_key || ':reserve';
  v_meta := jsonb_build_object(
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'claimDayKey', p_claim_day_key,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'baseGross', p_base_gross,
    'gross', p_gross_amount,
    'userAmount', p_user_amount,
    'reserveAmount', p_reserve_amount,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'claimKind', 'DAILY_CLAIM_V12'
  );

  -- Lock streak row (create empty shell if missing so concurrent claims serialize)
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (
    p_user_id, 0, 0, NULL, 0, COALESCE(p_economic_version, '1.2'), NULL, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Already claimed same day or same idempotency key → return existing ledger rows
  IF (v_streak.last_idempotency_key IS NOT NULL AND v_streak.last_idempotency_key = p_idempotency_key)
     OR (v_streak.last_claim_day_key IS NOT NULL AND v_streak.last_claim_day_key = p_claim_day_key) THEN
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = COALESCE(v_streak.last_idempotency_key, p_idempotency_key)
      AND kind = 'earned'
      AND status = 'posted'
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_user_tx
      FROM public.ghc_transactions
      WHERE user_id = p_user_id
        AND reference_id = p_idempotency_key
        AND kind = 'earned'
        AND status = 'posted'
      LIMIT 1;
    END IF;

    SELECT * INTO v_rsv_tx
    FROM public.ghc_transactions
    WHERE user_id = v_reserve_user
      AND reference_id = COALESCE(v_user_tx.reference_id, p_idempotency_key) || ':reserve'
      AND kind = 'earned'
      AND status = 'posted'
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', v_streak.cycle_day,
      'completedCycles', v_streak.completed_cycles,
      'lastClaimDayKey', v_streak.last_claim_day_key,
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'reserveAmount', COALESCE(v_rsv_tx.amount, p_reserve_amount),
      'grossAmount', COALESCE((v_user_tx.metadata->>'gross')::numeric, p_gross_amount),
      'transactionId', v_user_tx.id,
      'reserveTransactionId', v_rsv_tx.id,
      'referenceId', COALESCE(v_user_tx.reference_id, p_idempotency_key),
      'm', COALESCE((v_user_tx.metadata->>'m')::numeric, p_m),
      'g', COALESCE((v_user_tx.metadata->>'g')::numeric, p_g),
      'economicVersion', COALESCE(v_user_tx.metadata->>'economicVersion', p_economic_version)
    );
  END IF;

  -- Insert user credit (unique index prevents double mint under race)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      p_user_id,
      'earned',
      p_user_amount,
      'posted',
      format('Daily claim day %s/7 (%s)', p_cycle_day, COALESCE(p_economic_version, '1.2')),
      'DAILY_CLAIM_V12',
      p_idempotency_key,
      v_meta,
      now()
    )
    RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent insert won — treat as idempotent success
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id AND reference_id = p_idempotency_key AND kind = 'earned' AND status = 'posted'
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', COALESCE(v_streak.cycle_day, p_cycle_day),
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'transactionId', v_user_tx.id,
      'referenceId', p_idempotency_key
    );
  END;

  -- Protocol reserve leg (non-spendable system account)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      v_reserve_user,
      'earned',
      p_reserve_amount,
      'posted',
      format('Protocol reserve day %s/7', p_cycle_day),
      'PROTOCOL_RESERVE_V12',
      v_rsv_ref,
      v_meta || jsonb_build_object('forUserId', p_user_id),
      now()
    )
    RETURNING id INTO v_rsv_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_rsv_id FROM public.ghc_transactions
    WHERE user_id = v_reserve_user AND reference_id = v_rsv_ref AND status = 'posted'
    LIMIT 1;
  END;

  -- Commit streak only after ledger legs succeed (same transaction)
  v_total := COALESCE(v_streak.total_successful_claims, 0) + 1;
  UPDATE public.ghc_claim_streak_state
  SET
    cycle_day = p_cycle_day,
    completed_cycles = GREATEST(COALESCE(p_completed_cycles, 0), 0),
    last_claim_day_key = p_claim_day_key,
    total_successful_claims = v_total,
    economic_version = COALESCE(p_economic_version, '1.2'),
    last_idempotency_key = p_idempotency_key,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'idempotent', false,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'lastClaimDayKey', p_claim_day_key,
    'totalSuccessfulClaims', v_total,
    'userAmount', p_user_amount,
    'reserveAmount', p_reserve_amount,
    'grossAmount', p_gross_amount,
    'baseGross', p_base_gross,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'transactionId', v_user_id,
    'reserveTransactionId', v_rsv_id,
    'referenceId', p_idempotency_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v12(
  text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean
) TO service_role;

-- ============================================================================
-- SOURCE 010: 20261022010010_economy_v12_telemetry_note.sql
-- SHA256: 753f784758d0eca51d01d6cc0e04edf4ae46680d2a801034db0837562a8858a1
-- ============================================================================
-- ECONOMY_VERSION 1.2 support notes (non-destructive)
-- No historical ledger rows are rewritten.
-- Optional future tables (not required for memory-server path):
--
-- CREATE TABLE IF NOT EXISTS ghc_economic_telemetry (
--   id text PRIMARY KEY,
--   ts timestamptz NOT NULL DEFAULT now(),
--   event_type text NOT NULL,
--   day_key date NOT NULL,
--   eligible_economic_users bigint,
--   m numeric,
--   g numeric,
--   demand numeric,
--   budget numeric,
--   user_issuance numeric,
--   reserve_issuance numeric,
--   gross_issuance numeric,
--   sinks numeric,
--   net_circulating_change numeric,
--   meta jsonb
-- );
--
-- CREATE TABLE IF NOT EXISTS ghc_claim_streak_state (
--   user_id text PRIMARY KEY,
--   cycle_day int NOT NULL DEFAULT 0,
--   completed_cycles int NOT NULL DEFAULT 0,
--   last_claim_day_key date,
--   total_successful_claims int NOT NULL DEFAULT 0,
--   economic_version text NOT NULL DEFAULT '1.2',
--   last_idempotency_key text,
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );
--
-- Eligible economic users should be derived from verified identities,
-- not raw registration counts.

-- ============================================================================
-- SOURCE 011: 20261022010011_ghc_ledger_spend_rpc.sql
-- SHA256: cf70ece0e409a37e624390886f46400e7aada0a2be35b8172e44ef01f7454d58
-- ============================================================================
-- Additive: authoritative GHC spend (debit-only) for membership/boosts
-- Does not alter historical balances or drop tables.

CREATE OR REPLACE FUNCTION public.ghc_execute_spend(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Purchase',
  p_source_event text DEFAULT 'SPEND'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_avail numeric;
  v_existing uuid;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;

  -- Serialize per user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_spend:' || p_user_id));

  -- Idempotency: existing spend with same reference
  SELECT id INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased', 'transfer_out')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing,
      'referenceId', p_reference_id
    );
  END IF;

  v_avail := public.ghc_available_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at
  ) VALUES (
    p_user_id, 'spent', v_amount, 'posted', coalesce(p_reason, 'Purchase'),
    coalesce(p_source_event, 'SPEND'), p_reference_id, v_now
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'transactionId', v_tx_id,
    'referenceId', p_reference_id,
    'amount', v_amount,
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'spent',
      'amount', v_amount,
      'status', 'posted',
      'reason', coalesce(p_reason, 'Purchase'),
      'sourceEvent', coalesce(p_source_event, 'SPEND'),
      'referenceId', p_reference_id,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 012: 20261022010012_membership_entitlements_and_activity_caps.sql
-- SHA256: 56c440ed303424e84d7017b6ebb01436865c8e9c7dad558ef1c8211be952ed4f
-- ============================================================================
-- Durable membership entitlements + activity emission caps (multi-instance)

CREATE TABLE IF NOT EXISTS public.ghc_membership_entitlements (
  user_id text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('free','vip','vvip')),
  active boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  expires_at timestamptz,
  billing_period text,
  source text NOT NULL DEFAULT 'default',
  purchase_ref text,
  payment_intent_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  audit jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_membership_purchase_ref
  ON public.ghc_membership_entitlements (purchase_ref)
  WHERE purchase_ref IS NOT NULL;

ALTER TABLE public.ghc_membership_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_membership_entitlements_no_client ON public.ghc_membership_entitlements;
CREATE POLICY ghc_membership_entitlements_no_client ON public.ghc_membership_entitlements
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.ghc_activity_emission_windows (
  user_id text NOT NULL,
  window_type text NOT NULL CHECK (window_type IN ('day','week')),
  window_key text NOT NULL,
  amount_ghc numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_type, window_key)
);

ALTER TABLE public.ghc_activity_emission_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_activity_windows_no_client ON public.ghc_activity_emission_windows;
CREATE POLICY ghc_activity_windows_no_client ON public.ghc_activity_emission_windows
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.ghc_global_emission_demand (
  day_key text PRIMARY KEY,
  demand_after_m numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghc_global_emission_demand ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_global_demand_no_client ON public.ghc_global_emission_demand;
CREATE POLICY ghc_global_demand_no_client ON public.ghc_global_emission_demand
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- SOURCE 013: 20261022010013_pi_payment_intents_durable.sql
-- SHA256: afa2317df307a0539db5e2eb33b03b0f904a6eeeb6baa774f34ef9ac4e34735a
-- ============================================================================
-- PROMPT #25 — Durable Pi payment intents (additive, non-destructive)
-- Supports multi-instance Vercel; no process-memory authority for production.

CREATE TABLE IF NOT EXISTS public.ghc_payment_intents (
  id                    text PRIMARY KEY,
  user_id               text NOT NULL,
  provider              text NOT NULL DEFAULT 'pi',
  provider_payment_id   text,
  purpose               text NOT NULL,
  amount                numeric(18, 8) NOT NULL CHECK (amount > 0),
  currency              text NOT NULL DEFAULT 'PI',
  status                text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED',
      'COMPLETION_PENDING','COMPLETED','FULFILLED','FAILED',
      'CANCELLED','REFUNDED','INCOMPLETE'
    )),
  reference_id          text NOT NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  txid                  text,
  last_error            text,
  idempotency_key       text,
  audit                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz,
  submitted_at          timestamptz,
  completed_at          timestamptz,
  fulfilled_at          timestamptz,
  cancelled_at          timestamptz,
  refunded_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_provider_payment
  ON public.ghc_payment_intents (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_idempotency
  ON public.ghc_payment_intents (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_payment_intents_txid
  ON public.ghc_payment_intents (txid)
  WHERE txid IS NOT NULL AND status IN ('COMPLETED','FULFILLED');

CREATE INDEX IF NOT EXISTS idx_ghc_payment_intents_user_created
  ON public.ghc_payment_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghc_payment_intents_status
  ON public.ghc_payment_intents (status)
  WHERE status NOT IN ('FULFILLED','CANCELLED','REFUNDED');

ALTER TABLE public.ghc_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_payment_intents_no_client ON public.ghc_payment_intents;
CREATE POLICY ghc_payment_intents_no_client ON public.ghc_payment_intents
  FOR ALL USING (false) WITH CHECK (false);

-- Upsert intent (service_role only)
CREATE OR REPLACE FUNCTION public.ghc_payment_intent_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := p_row->>'id';
BEGIN
  IF v_id IS NULL OR length(trim(v_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  INSERT INTO public.ghc_payment_intents (
    id, user_id, provider, provider_payment_id, purpose, amount, currency,
    status, reference_id, metadata, txid, last_error, idempotency_key, audit,
    created_at, approved_at, submitted_at, completed_at, fulfilled_at,
    cancelled_at, refunded_at, updated_at
  ) VALUES (
    v_id,
    p_row->>'userId',
    COALESCE(p_row->>'provider', 'pi'),
    NULLIF(p_row->>'providerPaymentId', ''),
    p_row->>'purpose',
    (p_row->>'amount')::numeric,
    COALESCE(p_row->>'currency', 'PI'),
    COALESCE(p_row->>'status', 'CREATED'),
    p_row->>'referenceId',
    COALESCE(p_row->'metadata', '{}'::jsonb),
    NULLIF(p_row->>'txid', ''),
    NULLIF(p_row->>'lastError', ''),
    NULLIF(p_row->>'idempotencyKey', ''),
    COALESCE(p_row->'audit', '[]'::jsonb),
    COALESCE(to_timestamp(((p_row->>'createdAt')::bigint)/1000.0), now()),
    CASE WHEN p_row->>'approvedAt' IS NOT NULL THEN to_timestamp(((p_row->>'approvedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'submittedAt' IS NOT NULL THEN to_timestamp(((p_row->>'submittedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'completedAt' IS NOT NULL THEN to_timestamp(((p_row->>'completedAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'fulfilledAt' IS NOT NULL THEN to_timestamp(((p_row->>'fulfilledAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'cancelledAt' IS NOT NULL THEN to_timestamp(((p_row->>'cancelledAt')::bigint)/1000.0) END,
    CASE WHEN p_row->>'refundedAt' IS NOT NULL THEN to_timestamp(((p_row->>'refundedAt')::bigint)/1000.0) END,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    provider_payment_id = COALESCE(EXCLUDED.provider_payment_id, ghc_payment_intents.provider_payment_id),
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    txid = COALESCE(EXCLUDED.txid, ghc_payment_intents.txid),
    last_error = EXCLUDED.last_error,
    audit = EXCLUDED.audit,
    approved_at = COALESCE(EXCLUDED.approved_at, ghc_payment_intents.approved_at),
    submitted_at = COALESCE(EXCLUDED.submitted_at, ghc_payment_intents.submitted_at),
    completed_at = COALESCE(EXCLUDED.completed_at, ghc_payment_intents.completed_at),
    fulfilled_at = COALESCE(EXCLUDED.fulfilled_at, ghc_payment_intents.fulfilled_at),
    cancelled_at = COALESCE(EXCLUDED.cancelled_at, ghc_payment_intents.cancelled_at),
    refunded_at = COALESCE(EXCLUDED.refunded_at, ghc_payment_intents.refunded_at),
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.ghc_payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'userId', v_row.user_id,
    'provider', v_row.provider,
    'providerPaymentId', v_row.provider_payment_id,
    'purpose', v_row.purpose,
    'amount', v_row.amount,
    'currency', v_row.currency,
    'status', v_row.status,
    'referenceId', v_row.reference_id,
    'metadata', v_row.metadata,
    'txid', v_row.txid,
    'lastError', v_row.last_error,
    'idempotencyKey', v_row.idempotency_key,
    'audit', v_row.audit,
    'createdAt', (extract(epoch from v_row.created_at)*1000)::bigint,
    'approvedAt', CASE WHEN v_row.approved_at IS NOT NULL THEN (extract(epoch from v_row.approved_at)*1000)::bigint END,
    'submittedAt', CASE WHEN v_row.submitted_at IS NOT NULL THEN (extract(epoch from v_row.submitted_at)*1000)::bigint END,
    'completedAt', CASE WHEN v_row.completed_at IS NOT NULL THEN (extract(epoch from v_row.completed_at)*1000)::bigint END,
    'fulfilledAt', CASE WHEN v_row.fulfilled_at IS NOT NULL THEN (extract(epoch from v_row.fulfilled_at)*1000)::bigint END,
    'cancelledAt', CASE WHEN v_row.cancelled_at IS NOT NULL THEN (extract(epoch from v_row.cancelled_at)*1000)::bigint END,
    'refundedAt', CASE WHEN v_row.refunded_at IS NOT NULL THEN (extract(epoch from v_row.refunded_at)*1000)::bigint END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_by_provider(p_provider_payment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id text;
BEGIN
  SELECT id INTO v_id FROM public.ghc_payment_intents
  WHERE provider_payment_id = p_provider_payment_id LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.ghc_payment_intent_get(v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role;

-- ============================================================================
-- SOURCE 014: 20261022010014_p0_activity_governor_durable.sql
-- SHA256: b82b7c48138149d7b925fdf110427f471ab8f74b3e721ca21f3bb832227fe8f4
-- ============================================================================
-- P0: Multi-instance activity caps + global demand (additive)
-- Does not alter balances or historical ledger.

CREATE OR REPLACE FUNCTION public.ghc_activity_try_grant(
  p_user_id text,
  p_day_key text,
  p_week_key text,
  p_requested numeric,
  p_daily_cap numeric,
  p_weekly_cap numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day numeric := 0;
  v_week numeric := 0;
  v_room_day numeric;
  v_room_week numeric;
  v_grant numeric;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF coalesce(p_requested, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'granted', 0, 'dayRemaining', p_daily_cap, 'weekRemaining', p_weekly_cap);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_act:' || p_user_id));

  SELECT amount_ghc INTO v_day
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'day' AND window_key = p_day_key;
  v_day := coalesce(v_day, 0);

  SELECT amount_ghc INTO v_week
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'week' AND window_key = p_week_key;
  v_week := coalesce(v_week, 0);

  v_room_day := greatest(0, p_daily_cap - v_day);
  v_room_week := greatest(0, p_weekly_cap - v_week);
  v_grant := least(p_requested, v_room_day, v_room_week);

  IF v_grant > 0 THEN
    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = public.ghc_activity_emission_windows.amount_ghc + EXCLUDED.amount_ghc - v_day,
                  updated_at = now();
    -- simpler upsert absolute:
    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

    INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
    VALUES (p_user_id, 'week', p_week_key, v_week + v_grant, now())
    ON CONFLICT (user_id, window_type, window_key)
    DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'granted', v_grant,
    'dayGranted', v_day + v_grant,
    'weekGranted', v_week + v_grant,
    'dayRemaining', greatest(0, p_daily_cap - (v_day + v_grant)),
    'weekRemaining', greatest(0, p_weekly_cap - (v_week + v_grant))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_record_global_demand(
  p_day_key text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  INSERT INTO public.ghc_global_emission_demand (day_key, demand_after_m, updated_at)
  VALUES (p_day_key, greatest(0, coalesce(p_amount, 0)), now())
  ON CONFLICT (day_key)
  DO UPDATE SET
    demand_after_m = public.ghc_global_emission_demand.demand_after_m + greatest(0, coalesce(p_amount, 0)),
    updated_at = now()
  RETURNING demand_after_m INTO v_total;
  RETURN coalesce(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_get_global_demand(p_day_key text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v numeric;
BEGIN
  SELECT demand_after_m INTO v FROM public.ghc_global_emission_demand WHERE day_key = p_day_key;
  RETURN coalesce(v, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_membership_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ghc_membership_entitlements (
    user_id, tier, active, started_at, expires_at, billing_period, source,
    purchase_ref, payment_intent_id, updated_at, audit
  ) VALUES (
    p_row->>'user_id',
    p_row->>'tier',
    coalesce((p_row->>'active')::boolean, true),
    CASE WHEN p_row ? 'started_at' THEN (p_row->>'started_at')::timestamptz ELSE now() END,
    CASE WHEN p_row ? 'expires_at' AND p_row->>'expires_at' IS NOT NULL
      THEN (p_row->>'expires_at')::timestamptz ELSE NULL END,
    p_row->>'billing_period',
    coalesce(p_row->>'source', 'default'),
    p_row->>'purchase_ref',
    p_row->>'payment_intent_id',
    now(),
    coalesce(p_row->'audit', '[]'::jsonb)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    active = EXCLUDED.active,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    billing_period = EXCLUDED.billing_period,
    source = EXCLUDED.source,
    purchase_ref = COALESCE(EXCLUDED.purchase_ref, public.ghc_membership_entitlements.purchase_ref),
    payment_intent_id = COALESCE(EXCLUDED.payment_intent_id, public.ghc_membership_entitlements.payment_intent_id),
    updated_at = now(),
    audit = EXCLUDED.audit;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_record_global_demand(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_get_global_demand(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_membership_upsert(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_record_global_demand(text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_get_global_demand(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_membership_upsert(jsonb) TO service_role;

-- ============================================================================
-- SOURCE 015: 20261022010015_connection_request_intents.sql
-- SHA256: 226b68af3940546a6a9b44e909d075cf089cddf7ce4bcf534892e40997d3c5d6
-- ============================================================================
-- PROMPT #39 — Additive connection request intent durability
-- DO NOT apply automatically. Operator applies after review.
-- Backward compatible: existing relationships without intent remain valid.
-- Does NOT rewrite historical graph edges.

-- ---------------------------------------------------------------------------
-- Connection requests with optional intents (durable, multi-device)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  -- JSON array of intent strings, e.g. ["friendship","collaboration"]
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_connection_requests_no_self CHECK (from_user_id <> to_user_id)
);

-- One open pending request per directed pair
CREATE UNIQUE INDEX IF NOT EXISTS ghc_connection_requests_pending_pair_uidx
  ON public.ghc_connection_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ghc_connection_requests_to_pending_idx
  ON public.ghc_connection_requests (to_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ghc_connection_requests_from_idx
  ON public.ghc_connection_requests (from_user_id, created_at DESC);

-- Optional relationship context retained after accept (not a second graph)
CREATE TABLE IF NOT EXISTS public.ghc_connection_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a text NOT NULL,
  user_b text NOT NULL,
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  source text,
  request_id uuid REFERENCES public.ghc_connection_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_connection_contexts_pair CHECK (user_a < user_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghc_connection_contexts_pair_uidx
  ON public.ghc_connection_contexts (user_a, user_b);

ALTER TABLE public.ghc_connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_connection_contexts ENABLE ROW LEVEL SECURITY;

-- No broad client write policies — service_role / SECURITY DEFINER RPCs only
REVOKE ALL ON public.ghc_connection_requests FROM PUBLIC;
REVOKE ALL ON public.ghc_connection_contexts FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.ghc_connection_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ghc_connection_contexts TO service_role;

-- Upsert pending request with intents (idempotent on pending pair)
CREATE OR REPLACE FUNCTION public.ghc_connection_request_upsert(
  p_from_user_id text,
  p_to_user_id text,
  p_intents jsonb DEFAULT '[]'::jsonb,
  p_note text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_connection_requests;
BEGIN
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL OR p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'INVALID_PAIR';
  END IF;

  INSERT INTO public.ghc_connection_requests (
    from_user_id, to_user_id, status, intents, note, source
  ) VALUES (
    p_from_user_id, p_to_user_id, 'pending',
    COALESCE(p_intents, '[]'::jsonb), p_note, p_source
  )
  ON CONFLICT (from_user_id, to_user_id) WHERE status = 'pending'
  DO UPDATE SET
    intents = COALESCE(EXCLUDED.intents, public.ghc_connection_requests.intents),
    note = COALESCE(EXCLUDED.note, public.ghc_connection_requests.note),
    source = COALESCE(EXCLUDED.source, public.ghc_connection_requests.source),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Accept: mark request accepted and snapshot context (does not invent friendship rows elsewhere)
CREATE OR REPLACE FUNCTION public.ghc_connection_request_accept(
  p_actor_user_id text,
  p_from_user_id text
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ghc_connection_requests;
  v_a text;
  v_b text;
BEGIN
  SELECT * INTO v_req
  FROM public.ghc_connection_requests
  WHERE from_user_id = p_from_user_id
    AND to_user_id = p_actor_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  UPDATE public.ghc_connection_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  v_a := LEAST(p_actor_user_id, p_from_user_id);
  v_b := GREATEST(p_actor_user_id, p_from_user_id);

  INSERT INTO public.ghc_connection_contexts (
    user_a, user_b, intents, note, source, request_id
  ) VALUES (
    v_a, v_b, v_req.intents, v_req.note, v_req.source, v_req.id
  )
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    intents = EXCLUDED.intents,
    note = EXCLUDED.note,
    source = EXCLUDED.source,
    request_id = EXCLUDED.request_id,
    updated_at = now();

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_connection_request_decline(
  p_actor_user_id text,
  p_from_user_id text
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ghc_connection_requests;
BEGIN
  UPDATE public.ghc_connection_requests
  SET status = 'declined', updated_at = now()
  WHERE from_user_id = p_from_user_id
    AND to_user_id = p_actor_user_id
    AND status = 'pending'
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  RETURN v_req;
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_connection_request_accept(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_connection_request_decline(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_connection_request_accept(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_connection_request_decline(text, text) TO service_role;

COMMENT ON TABLE public.ghc_connection_requests IS
  'Durable connection requests with optional intents. Not a full social graph replacement.';
COMMENT ON TABLE public.ghc_connection_contexts IS
  'Preserved intent/context after accept. Pair ordered user_a < user_b.';

-- ============================================================================
-- SOURCE 016: 20261022010016_community_join_reasons_proposal.sql
-- SHA256: f590242e190edf63dcb41a12232fc43d5be1276ef742eb5c36e198eb2a2ca5d8
-- ============================================================================
-- PROPOSAL ONLY — DO NOT APPLY AUTOMATICALLY
-- Additive join-reason storage for community memberships.
-- GreenHaven Prompt #44: optional durability for join reasons.
--
-- This file is intentionally not referenced by production apply scripts.
-- Operator must review and apply manually if multi-device join reasons are required.
-- Does NOT touch GHC, Pi, economy, or payment tables.

-- CREATE TABLE IF NOT EXISTS ghc_community_join_reasons (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id text NOT NULL,
--   community_id text NOT NULL,
--   reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   UNIQUE (user_id, community_id)
-- );
--
-- ALTER TABLE ghc_community_join_reasons ENABLE ROW LEVEL SECURITY;
-- -- Policies: service-role write; user can read own rows only.

-- ============================================================================
-- SOURCE 017: 20261022010017_community_governance_log_proposal.sql
-- SHA256: fbb271f3f5d1afdac2528e3f7ef6f597939db2779e2c9ddbb7c37ee2f2b44476
-- ============================================================================
-- PROPOSAL ONLY — NOT APPLIED BY AGENT
-- Community moderation log + safety reports (additive, non-destructive)
-- Operator must review and apply manually. Does not touch GHC/Pi tables.

-- BEGIN PROPOSAL

CREATE TABLE IF NOT EXISTS public.ghc_community_moderation_log (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghc_cml_community_created
  ON public.ghc_community_moderation_log (community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ghc_community_reports (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolver_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ghc_cr_community_status
  ON public.ghc_community_reports (community_id, status, created_at DESC);

ALTER TABLE public.ghc_community_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_community_reports ENABLE ROW LEVEL SECURITY;

-- No broad client write policies — service role / SECURITY DEFINER RPCs only (future).

COMMENT ON TABLE public.ghc_community_moderation_log IS
  'PROPOSAL: community moderation audit log — apply manually; not financial';

COMMENT ON TABLE public.ghc_community_reports IS
  'PROPOSAL: community safety reports — apply manually; not financial';

-- END PROPOSAL

-- ============================================================================
-- SOURCE 018: 20261022010018_ghc_spend_sign_and_idempotency.sql
-- SHA256: da64f1f85d5c7798a79d98c8130ee35b5fd7066a8023ddfee3545082fe0c1bd0
-- ============================================================================
-- Phase 6: Fix spend ledger sign + strengthen spend idempotency.
-- Memory path already stores spends as negative amounts (SUM-based balance).
-- DB RPC previously inserted positive amounts for kind=spent, which inflated balances.
-- Additive: REPLACE function only; no table drops; no balance rewrites.

CREATE OR REPLACE FUNCTION public.ghc_execute_spend(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Purchase',
  p_source_event text DEFAULT 'SPEND'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_signed numeric;
  v_avail numeric;
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  -- Match transfer precision: numeric(18,4)
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Serialize concurrent spends for this user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_spend:' || p_user_id));

  -- Idempotency: existing spend/purchase with same reference
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
    -- Conflicting reuse of same reference with different amount
    IF abs(v_existing.amount) <> v_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'message', 'referenceId already used with a different amount'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing.id,
      'referenceId', p_reference_id,
      'amount', abs(v_existing.amount)
    );
  END IF;

  v_avail := public.ghc_available_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

  -- Authoritative sign: debits are negative so SUM(amount) remains correct
  v_signed := -v_amount;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id, 'spent', v_signed, 'posted', coalesce(p_reason, 'Purchase'),
    coalesce(p_source_event, 'SPEND'), p_reference_id, v_now, v_now
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'transactionId', v_tx_id,
    'referenceId', p_reference_id,
    'amount', v_amount,
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'spent',
      'amount', v_signed,
      'status', 'posted',
      'reason', coalesce(p_reason, 'Purchase'),
      'sourceEvent', coalesce(p_source_event, 'SPEND'),
      'referenceId', p_reference_id,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION WHEN unique_violation THEN
  -- Concurrent insert with same reference — treat as idempotent if amount matches
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;
  IF FOUND AND abs(v_existing.amount) = v_amount THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing.id,
      'referenceId', p_reference_id
    );
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
WHEN undefined_table OR undefined_column THEN
  RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;

-- Unique spend reference per user (idempotency at index level)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_spend_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind IN ('spent', 'purchased') AND status = 'posted' AND reference_id IS NOT NULL;

COMMENT ON FUNCTION public.ghc_execute_spend IS
  'Phase 6: spend debits as negative amounts; advisory lock; idempotent reference; amount conflict rejection.';

-- ============================================================================
-- SOURCE 019: 20261022010019_gh_pi_identities.sql
-- SHA256: eb8a55adf6e2a77f75fff1522075746805bee143183e4f7a2bb310369fc59e5a
-- ============================================================================
-- Phase 2A: Durable Pi ↔ GreenHaven identity mapping
-- Source of truth for returning-user / onboarding_completed after Pi /me verification.
-- NEVER store Pi access tokens in this table.
-- Safe: CREATE IF NOT EXISTS only; does not touch economy/ledger tables.

CREATE TABLE IF NOT EXISTS public.gh_pi_identities (
  pi_app_uid              text PRIMARY KEY,
  gh_user_id              text NOT NULL,
  pi_username             text,
  onboarding_completed    boolean NOT NULL DEFAULT false,
  greenhaven_profile_id   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  verified_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pi_identities_pi_app_uid_nonempty CHECK (length(trim(pi_app_uid)) > 0),
  CONSTRAINT gh_pi_identities_gh_user_id_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

-- One GH user maps to at most one current Pi app uid (app-specific uid is the join key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_identities_gh_user_id
  ON public.gh_pi_identities (gh_user_id);

CREATE INDEX IF NOT EXISTS idx_gh_pi_identities_onboarding
  ON public.gh_pi_identities (onboarding_completed);

ALTER TABLE public.gh_pi_identities ENABLE ROW LEVEL SECURITY;

-- No direct client access; service role only (same pattern as economy privileged tables)
DROP POLICY IF EXISTS gh_pi_identities_no_client_access ON public.gh_pi_identities;
CREATE POLICY gh_pi_identities_no_client_access ON public.gh_pi_identities
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_pi_identities IS
  'Verified Pi app uid ↔ GreenHaven user mapping. Tokens never stored. Service-role writes only.';

-- ============================================================================
-- SOURCE 020: 20261022010020_gh_sessions.sql
-- SHA256: cca30772144554bb22560b780c0f50f769401d3e4ca146128e34670700f9edaf
-- ============================================================================
-- Phase 2B: GH CONNECT server sessions
-- Issued only after verified Pi /me + durable identity resolution.
-- Stores token HASH only — never raw session secret, Pi tokens, PINs, or payment secrets.
-- Additive; does not modify economy/ledger/payment tables.

CREATE TABLE IF NOT EXISTS public.gh_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text NOT NULL,
  gh_user_id      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at      timestamptz,
  user_agent_hash text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_sessions_token_hash_nonempty CHECK (length(trim(token_hash)) > 0),
  CONSTRAINT gh_sessions_user_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_sessions_token_hash
  ON public.gh_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_gh_sessions_gh_user_id
  ON public.gh_sessions (gh_user_id);

CREATE INDEX IF NOT EXISTS idx_gh_sessions_expires
  ON public.gh_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.gh_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_sessions_no_client_access ON public.gh_sessions;
CREATE POLICY gh_sessions_no_client_access ON public.gh_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_sessions IS
  'GH CONNECT server sessions. token_hash only. Service-role access. Issued after Pi /me.';

-- ============================================================================
-- SOURCE 021: 20261022010021_gh_step_ups.sql
-- SHA256: 0394e5db94d8068405c3f6b155a27395eb1566f125f4ab658ab47839864694ab
-- ============================================================================
-- Phase 4: Server-side step-up authentication records
-- Bound to GH user + GH session. Short-lived. No credentials stored.
-- Additive; does not modify economy/ledger/payment tables.

CREATE TABLE IF NOT EXISTS public.gh_step_ups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id        text NOT NULL,
  session_id        text NOT NULL,
  auth_method       text NOT NULL DEFAULT 'pi_fresh_auth',
  authenticated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_step_ups_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_step_ups_session_nonempty CHECK (length(trim(session_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_step_ups_user_session
  ON public.gh_step_ups (gh_user_id, session_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_step_ups_expires
  ON public.gh_step_ups (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.gh_step_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_step_ups_no_client_access ON public.gh_step_ups;
CREATE POLICY gh_step_ups_no_client_access ON public.gh_step_ups
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_step_ups IS
  'Short-lived step-up assurance after fresh Pi /me. No tokens stored. Service-role only.';

-- ============================================================================
-- SOURCE 022: 20261022010022_gh_webauthn_credentials.sql
-- SHA256: dc1f4a165a64f6cb10a8c55ec9c0d7d83ddbd869b9591cd585de080d3adde337
-- ============================================================================
-- Phase 7: WebAuthn / Passkey public credential metadata only.
-- NEVER stores private keys, biometrics, PINs, or session tokens.
-- Additive; RLS denies client direct access.

CREATE TABLE IF NOT EXISTS public.gh_webauthn_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  credential_id   text NOT NULL,
  public_key      text NOT NULL,
  counter         bigint NOT NULL DEFAULT 0,
  transports      text[] NOT NULL DEFAULT '{}',
  device_type     text,
  backed_up       boolean NOT NULL DEFAULT false,
  label           text NOT NULL DEFAULT 'Passkey',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  CONSTRAINT gh_webauthn_cred_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_webauthn_cred_id_nonempty CHECK (length(trim(credential_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_webauthn_credential_id
  ON public.gh_webauthn_credentials (credential_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_webauthn_user
  ON public.gh_webauthn_credentials (gh_user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gh_webauthn_challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  session_id      text,
  challenge       text NOT NULL,
  purpose         text NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_webauthn_challenges_user
  ON public.gh_webauthn_challenges (gh_user_id, purpose)
  WHERE used_at IS NULL;

ALTER TABLE public.gh_webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_webauthn_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_webauthn_cred_no_client ON public.gh_webauthn_credentials;
CREATE POLICY gh_webauthn_cred_no_client ON public.gh_webauthn_credentials
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_webauthn_chal_no_client ON public.gh_webauthn_challenges;
CREATE POLICY gh_webauthn_chal_no_client ON public.gh_webauthn_challenges
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_webauthn_credentials IS
  'WebAuthn public credentials only. Service-role access. No private keys.';

-- ============================================================================
-- SOURCE 023: 20261022010023_ghc_wallet_snapshot.sql
-- SHA256: cf8ace7d12033e8d9605a50a44c0ea004bd76ee5c0425cb717080d36156fbb78
-- ============================================================================
-- Authoritative GHC wallet totals from the full ledger (not limited to recent N rows).
-- UI may still fetch a bounded recent transaction list for display.

CREATE OR REPLACE FUNCTION public.ghc_wallet_snapshot(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_pending numeric := 0;
  v_earned numeric := 0;
  v_spent numeric := 0;
  v_purchased numeric := 0;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object(
      'userId', p_user_id,
      'balance', 0,
      'pending', 0,
      'lifetimeEarned', 0,
      'lifetimeSpent', 0,
      'lifetimePurchased', 0,
      'updatedAt', (extract(epoch from now()) * 1000)::bigint
    );
  END IF;

  SELECT
    coalesce(sum(CASE
      WHEN status = 'posted' AND kind <> 'transfer_request' THEN amount
      ELSE 0
    END), 0),
    coalesce(sum(CASE
      WHEN status = 'pending' AND amount > 0 AND kind <> 'transfer_request' THEN amount
      ELSE 0
    END), 0),
    coalesce(sum(CASE
      WHEN status = 'posted' AND amount > 0 AND kind IN ('earned', 'transfer_in') THEN amount
      ELSE 0
    END), 0),
    coalesce(sum(CASE
      WHEN status = 'posted' AND amount < 0 AND kind IN ('spent', 'transfer_out') THEN abs(amount)
      ELSE 0
    END), 0),
    coalesce(sum(CASE
      WHEN status = 'posted' AND amount > 0 AND kind = 'purchased' THEN amount
      ELSE 0
    END), 0)
  INTO v_balance, v_pending, v_earned, v_spent, v_purchased
  FROM public.ghc_transactions
  WHERE user_id = p_user_id;

  -- Never surface negative available under current product rules
  IF v_balance < 0 THEN
    v_balance := 0;
  END IF;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'balance', v_balance,
    'pending', v_pending,
    'lifetimeEarned', v_earned,
    'lifetimeSpent', v_spent,
    'lifetimePurchased', v_purchased,
    'updatedAt', (extract(epoch from now()) * 1000)::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_wallet_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_wallet_snapshot(text) TO service_role;

-- ============================================================================
-- SOURCE 024: 20261022010024_marketplace_orders_durable.sql
-- SHA256: 42a93c64e8abfaeb1b4b15d06e9fb16992c1f1d14df741e37eeb97bc579c221e
-- ============================================================================
-- Durable marketplace orders (additive). Service-role only; no client RLS access.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_orders (
  id                  text PRIMARY KEY,
  listing_id          text NOT NULL,
  listing_title       text NOT NULL DEFAULT '',
  buyer_id            text NOT NULL,
  seller_id           text NOT NULL,
  quantity            integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          numeric(18, 8) NOT NULL CHECK (unit_price >= 0),
  currency            text NOT NULL DEFAULT 'GHC',
  total_amount        numeric(18, 8) NOT NULL CHECK (total_amount >= 0),
  status              text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created','payment_pending','payment_verified','confirmed',
      'fulfilling','completed','cancelled','refunded','disputed'
    )),
  payment_method      text NOT NULL DEFAULT 'none'
    CHECK (payment_method IN ('ghc','pi','none')),
  payment_status      text NOT NULL DEFAULT 'none'
    CHECK (payment_status IN ('none','pending','verified','failed','refunded')),
  payment_intent_id   text,
  payment_id          text,
  txid                text,
  ghc_spend_ref       text,
  audit               jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  fulfilled_at        timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_market_orders_buyer ON public.gh_marketplace_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_seller ON public.gh_marketplace_orders (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_market_orders_status ON public.gh_marketplace_orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_ghc_spend_ref
  ON public.gh_marketplace_orders (ghc_spend_ref)
  WHERE ghc_spend_ref IS NOT NULL;

ALTER TABLE public.gh_marketplace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_marketplace_orders_no_client ON public.gh_marketplace_orders;
CREATE POLICY gh_marketplace_orders_no_client ON public.gh_marketplace_orders
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := p_row->>'id';
BEGIN
  IF v_id IS NULL OR length(trim(v_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  INSERT INTO public.gh_marketplace_orders (
    id, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price,
    currency, total_amount, status, payment_method, payment_status,
    payment_intent_id, payment_id, txid, ghc_spend_ref, audit,
    created_at, updated_at, confirmed_at, fulfilled_at, completed_at, cancelled_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'listingId', ''),
    COALESCE(p_row->>'listingTitle', ''),
    COALESCE(p_row->>'buyerId', ''),
    COALESCE(p_row->>'sellerId', ''),
    GREATEST(1, COALESCE((p_row->>'quantity')::int, 1)),
    COALESCE((p_row->>'unitPrice')::numeric, 0),
    COALESCE(p_row->>'currency', 'GHC'),
    COALESCE((p_row->>'totalAmount')::numeric, 0),
    COALESCE(p_row->>'status', 'created'),
    COALESCE(p_row->>'paymentMethod', 'none'),
    COALESCE(p_row->>'paymentStatus', 'none'),
    p_row->>'paymentIntentId',
    p_row->>'paymentId',
    p_row->>'txid',
    p_row->>'ghcSpendRef',
    COALESCE(p_row->'audit', '[]'::jsonb),
    COALESCE((p_row->>'createdAt')::timestamptz, now()),
    now(),
    (p_row->>'confirmedAt')::timestamptz,
    (p_row->>'fulfilledAt')::timestamptz,
    (p_row->>'completedAt')::timestamptz,
    (p_row->>'cancelledAt')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    listing_title = EXCLUDED.listing_title,
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status,
    payment_method = EXCLUDED.payment_method,
    payment_status = EXCLUDED.payment_status,
    payment_intent_id = EXCLUDED.payment_intent_id,
    payment_id = EXCLUDED.payment_id,
    txid = EXCLUDED.txid,
    ghc_spend_ref = EXCLUDED.ghc_spend_ref,
    audit = EXCLUDED.audit,
    updated_at = now(),
    confirmed_at = EXCLUDED.confirmed_at,
    fulfilled_at = EXCLUDED.fulfilled_at,
    completed_at = EXCLUDED.completed_at,
    cancelled_at = EXCLUDED.cancelled_at;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'listingId', r.listing_id,
    'listingTitle', r.listing_title,
    'buyerId', r.buyer_id,
    'sellerId', r.seller_id,
    'quantity', r.quantity,
    'unitPrice', r.unit_price,
    'currency', r.currency,
    'totalAmount', r.total_amount,
    'status', r.status,
    'paymentMethod', r.payment_method,
    'paymentStatus', r.payment_status,
    'paymentIntentId', r.payment_intent_id,
    'paymentId', r.payment_id,
    'txid', r.txid,
    'ghcSpendRef', r.ghc_spend_ref,
    'audit', r.audit,
    'createdAt', extract(epoch from r.created_at) * 1000,
    'updatedAt', extract(epoch from r.updated_at) * 1000,
    'confirmedAt', CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at) * 1000 END,
    'fulfilledAt', CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at) * 1000 END,
    'completedAt', CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at) * 1000 END,
    'cancelledAt', CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at) * 1000 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_upsert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;

-- ============================================================================
-- SOURCE 025: 20261022010025_marketplace_listings_and_list_rpc.sql
-- SHA256: 213d14fbb7dcaa3cee411a3a147772e12fa8f483aca52583c76f49f69a815d60
-- ============================================================================
-- Authoritative marketplace listings + list orders for user (service_role only)

CREATE TABLE IF NOT EXISTS public.gh_marketplace_listings (
  id              text PRIMARY KEY,
  seller_id       text NOT NULL,
  title           text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  price           numeric(18, 8) NOT NULL CHECK (price >= 0),
  currency        text NOT NULL DEFAULT 'GHC',
  availability    integer NOT NULL DEFAULT 1 CHECK (availability >= 0),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','paused','sold_out','removed')),
  kind            text NOT NULL DEFAULT 'product',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_market_listings_seller ON public.gh_marketplace_listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_gh_market_listings_status ON public.gh_marketplace_listings (status);

ALTER TABLE public.gh_marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_marketplace_listings_no_client ON public.gh_marketplace_listings;
CREATE POLICY gh_marketplace_listings_no_client ON public.gh_marketplace_listings
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_upsert(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_row->>'id', ''));
  v_seller text := trim(COALESCE(p_row->>'sellerId', ''));
  v_price numeric := COALESCE((p_row->>'price')::numeric, -1);
BEGIN
  IF v_id = '' OR v_seller = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PRICE');
  END IF;

  INSERT INTO public.gh_marketplace_listings (
    id, seller_id, title, description, price, currency, availability, status, kind, metadata, created_at, updated_at
  ) VALUES (
    v_id, v_seller,
    COALESCE(p_row->>'title', ''),
    COALESCE(p_row->>'description', ''),
    v_price,
    COALESCE(p_row->>'currency', 'GHC'),
    GREATEST(0, COALESCE((p_row->>'availability')::int, 1)),
    COALESCE(p_row->>'status', 'active'),
    COALESCE(p_row->>'kind', 'product'),
    COALESCE(p_row->'metadata', '{}'::jsonb),
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    availability = EXCLUDED.availability,
    status = EXCLUDED.status,
    kind = EXCLUDED.kind,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  WHERE public.gh_marketplace_listings.seller_id = EXCLUDED.seller_id;

  IF NOT FOUND AND EXISTS (SELECT 1 FROM public.gh_marketplace_listings WHERE id = v_id AND seller_id <> v_seller) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN_SELLER');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_listing_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_listings%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_marketplace_listings WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'sellerId', r.seller_id,
    'title', r.title,
    'description', r.description,
    'price', r.price,
    'currency', r.currency,
    'availability', r.availability,
    'status', r.status,
    'kind', r.kind,
    'metadata', r.metadata,
    'updatedAt', extract(epoch from r.updated_at) * 1000
  );
END;
$$;

-- List orders for user (buyer or seller)
CREATE OR REPLACE FUNCTION public.gh_marketplace_orders_list_for_user(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC)
    FROM (
      SELECT
        id,
        listing_id AS "listingId",
        listing_title AS "listingTitle",
        buyer_id AS "buyerId",
        seller_id AS "sellerId",
        quantity,
        unit_price AS "unitPrice",
        currency,
        total_amount AS "totalAmount",
        status,
        payment_method AS "paymentMethod",
        payment_status AS "paymentStatus",
        payment_intent_id AS "paymentIntentId",
        payment_id AS "paymentId",
        txid,
        ghc_spend_ref AS "ghcSpendRef",
        audit,
        extract(epoch from created_at) * 1000 AS "createdAt",
        extract(epoch from updated_at) * 1000 AS "updatedAt",
        CASE WHEN confirmed_at IS NULL THEN NULL ELSE extract(epoch from confirmed_at) * 1000 END AS "confirmedAt",
        CASE WHEN fulfilled_at IS NULL THEN NULL ELSE extract(epoch from fulfilled_at) * 1000 END AS "fulfilledAt",
        CASE WHEN completed_at IS NULL THEN NULL ELSE extract(epoch from completed_at) * 1000 END AS "completedAt",
        CASE WHEN cancelled_at IS NULL THEN NULL ELSE extract(epoch from cancelled_at) * 1000 END AS "cancelledAt"
      FROM public.gh_marketplace_orders
      WHERE buyer_id = p_user_id OR seller_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 200
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_listing_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role;

-- ============================================================================
-- SOURCE 026: 20261022010026_verification_requests_durable.sql
-- SHA256: 70ec582c86878619a466238ef2483da5846c7e3f65e18691dd8f96672f24c6c1
-- ============================================================================
-- Durable verification request queue (additive).
-- Service-role only; clients never write directly.
-- Submitting a request NEVER grants verified status.

CREATE TABLE IF NOT EXISTS public.gh_verification_requests (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  type            text NOT NULL
    CHECK (type IN ('identity','creator','business','organization')),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','revoked','cancelled')),
  note            text,
  evidence_refs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id     text,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_verif_req_user
  ON public.gh_verification_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_verif_req_status
  ON public.gh_verification_requests (status, created_at DESC);

-- At most one open pending request per user+type
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_verif_req_pending_user_type
  ON public.gh_verification_requests (user_id, type)
  WHERE status = 'pending';

ALTER TABLE public.gh_verification_requests ENABLE ROW LEVEL SECURITY;

-- No client policies — service role only (fail closed for anon/authenticated JWT)

COMMENT ON TABLE public.gh_verification_requests IS
  'Verification request queue. status=pending does not imply badge/trust. Approve only via privileged review API.';

-- ============================================================================
-- SOURCE 027: 20261022010027_gh_messaging_durable.sql
-- SHA256: c58a0b85363d3521c072712b81289c696494d86cfa66b94fe42dbfb584ed2553
-- ============================================================================
-- Durable DM/group messaging for GH CONNECT
-- Linked to canonical GH user ids. Service-role writes; RLS denies direct client access.
-- Realtime (if enabled later) must still authorize via membership — never trust client channel alone.
-- Additive only. Does not modify ghc_transactions / payment tables.

CREATE TABLE IF NOT EXISTS public.gh_conversations (
  id                text PRIMARY KEY,
  kind              text NOT NULL DEFAULT 'direct'
                    CHECK (kind IN ('direct', 'group', 'community')),
  title             text,
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz,
  last_message_preview text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_conversations_created_by_nonempty CHECK (length(trim(created_by)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_conversations_updated
  ON public.gh_conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_conversation_members (
  conversation_id   text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  gh_user_id        text NOT NULL,
  role              text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('member', 'admin', 'owner')),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  left_at           timestamptz,
  muted_until       timestamptz,
  last_read_at      timestamptz,
  PRIMARY KEY (conversation_id, gh_user_id),
  CONSTRAINT gh_conversation_members_user_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user
  ON public.gh_conversation_members (gh_user_id)
  WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gh_messages (
  id                text PRIMARY KEY,
  conversation_id   text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  sender_id         text NOT NULL,
  client_message_id text,
  body              text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  edited_at         timestamptz,
  deleted_at        timestamptz,
  deleted_by        text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_messages_sender_nonempty CHECK (length(trim(sender_id)) > 0),
  CONSTRAINT gh_messages_body_len CHECK (char_length(body) <= 8000)
);

-- Idempotent client retries: one client_message_id per sender per conversation
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_messages_client_dedupe
  ON public.gh_messages (conversation_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gh_messages_conversation_created
  ON public.gh_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_messages_sender
  ON public.gh_messages (sender_id, created_at DESC);

ALTER TABLE public.gh_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_conversations_no_client ON public.gh_conversations;
CREATE POLICY gh_conversations_no_client ON public.gh_conversations
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_conversation_members_no_client ON public.gh_conversation_members;
CREATE POLICY gh_conversation_members_no_client ON public.gh_conversation_members
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_messages_no_client ON public.gh_messages;
CREATE POLICY gh_messages_no_client ON public.gh_messages
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_messages IS
  'Authoritative chat history. Drafts stay client-only. Service-role access; membership enforced in app server.';

-- ============================================================================
-- SOURCE 028: 20261022010028_gh_user_profiles_and_progress.sql
-- SHA256: 3e22947a95bb21825890b4530db01db6287f6950b10af4c754a22cd71ec28899
-- ============================================================================
-- Canonical user profile + achievement progress (cross-device, server-authoritative).
-- Linked to verified GH user id (same key space as gh_pi_identities.gh_user_id).
-- Additive only. No destructive changes. Service-role writes; client RLS deny-all.
-- Financial balances remain in ghc_transactions / ghc_wallet_snapshot — never stored here.

CREATE TABLE IF NOT EXISTS public.gh_user_profiles (
  gh_user_id            text PRIMARY KEY,
  display_name          text,
  username              text,
  bio                   text,
  city                  text,
  country               text,
  profession            text,
  hometown              text,
  education             text,
  status                text,
  age                   integer,
  gender                text,
  primary_mode          text,
  interests             jsonb NOT NULL DEFAULT '[]'::jsonb,
  connection_intents    jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills                jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos                jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_photo           text,
  profile_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarded             boolean NOT NULL DEFAULT false,
  schema_version        integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_profiles_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_profiles_age_range CHECK (age IS NULL OR (age >= 18 AND age <= 120)),
  CONSTRAINT gh_user_profiles_photos_array CHECK (jsonb_typeof(photos) = 'array'),
  CONSTRAINT gh_user_profiles_interests_array CHECK (jsonb_typeof(interests) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_onboarded
  ON public.gh_user_profiles (onboarded);

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_updated
  ON public.gh_user_profiles (updated_at DESC);

ALTER TABLE public.gh_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_profiles_no_client_access ON public.gh_user_profiles;
CREATE POLICY gh_user_profiles_no_client_access ON public.gh_user_profiles
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_profiles IS
  'Server-authoritative social profile for GH users. Not balances/membership. Service-role only.';

-- Achievement unlocks (idempotent per user + achievement id)
CREATE TABLE IF NOT EXISTS public.gh_user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  achievement_id  text NOT NULL,
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  source_event    text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_user_achievements_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_achievements_id_nonempty CHECK (length(trim(achievement_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_user_achievements_user_achievement
  ON public.gh_user_achievements (gh_user_id, achievement_id);

CREATE INDEX IF NOT EXISTS idx_gh_user_achievements_user
  ON public.gh_user_achievements (gh_user_id);

ALTER TABLE public.gh_user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_achievements_no_client_access ON public.gh_user_achievements;
CREATE POLICY gh_user_achievements_no_client_access ON public.gh_user_achievements
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_achievements IS
  'Server-authoritative achievement unlocks. Claims must be validated server-side. Service-role only.';

-- Lightweight progress counters (non-financial)
CREATE TABLE IF NOT EXISTS public.gh_user_progress (
  gh_user_id      text PRIMARY KEY,
  counters        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_progress_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_progress_counters_object CHECK (jsonb_typeof(counters) = 'object')
);

ALTER TABLE public.gh_user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_progress_no_client_access ON public.gh_user_progress;
CREATE POLICY gh_user_progress_no_client_access ON public.gh_user_progress
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_progress IS
  'Non-financial progress counters. Not GHC balances. Service-role only.';

-- ============================================================================
-- SOURCE 029: 20261022010029_ghc_stage_pending.sql
-- SHA256: 6ee3e97804e60f06554d750c834c05b9e1947699ee00908a3dc452bf2ece19fd
-- ============================================================================
-- Durable reward pending stage for POST /api/economy/rewards/evaluate
-- Reuses public.ghc_transactions (kind=pending, status=pending).
-- Claim path remains public.ghc_claim_pending (unchanged).
-- Additive only: no table drops, no balance rewrites.

-- Idempotency: one pending hold per (user_id, reference_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_pending_user_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'pending'
    AND status = 'pending'
    AND reference_id IS NOT NULL;

-- Idempotency: one posted earned credit per (user_id, reference_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_earned_user_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'earned'
    AND status = 'posted'
    AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ghc_stage_pending(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Serialize concurrent stage/claim for this user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));

  -- Already posted earned for this reference → treat as idempotent success (already settled)
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'earned'
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', true,
      'holdId', v_posted.id,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'referenceId', v_ref,
      'status', 'posted'
    );
  END IF;

  -- Existing pending hold for this reference
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'referenceId', v_ref,
      'status', 'pending',
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'reason', v_existing.reason,
        'sourceEvent', v_existing.source_event,
        'referenceId', v_existing.reference_id,
        'createdAt', (extract(epoch from v_existing.created_at) * 1000)::bigint
      )
    );
  END IF;

  v_tx_id := gen_random_uuid();
  INSERT INTO public.ghc_transactions (
    id, user_id, kind, amount, status, reason, source_event, reference_id, metadata, created_at
  ) VALUES (
    v_tx_id,
    p_user_id,
    'pending',
    v_amount,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
    v_ref,
    jsonb_build_object(
      'ruleId', p_rule_id,
      'stagedAt', v_now
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_amount,
    'referenceId', v_ref,
    'status', 'pending',
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_amount,
      'status', 'pending',
      'reason', coalesce(nullif(trim(p_reason), ''), 'Reward'),
      'sourceEvent', coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
      'referenceId', v_ref,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent insert with same reference — re-read and return idempotent
    SELECT * INTO v_existing
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = v_ref
      AND (
        (kind = 'pending' AND status = 'pending')
        OR (kind = 'earned' AND status = 'posted')
      )
      AND amount > 0
    ORDER BY created_at ASC
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'alreadyPosted', (v_existing.kind = 'earned'),
        'holdId', v_existing.id,
        'transactionId', v_existing.id,
        'amount', v_existing.amount,
        'referenceId', v_ref,
        'status', v_existing.status
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
  WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_stage_pending IS
  'Stage a pending GHC reward hold. Amount is caller-supplied from server rules only; service_role only. Idempotent on (user_id, reference_id).';

-- ============================================================================
-- SOURCE 030: 20261022010030_ghc_stage_pending_limits.sql
-- SHA256: 3ad31381b2a5d3614022fe97d489d9e35486a9ae8f3bc8e1d1582b8d68aadaa7
-- ============================================================================
-- Extend ghc_stage_pending with durable per-rule limits matching memory-path semantics:
--   dailyLimit  → count of qualifying txs for user+sourceEvent on Africa/Lagos calendar day
--   cooldownMs  → reject if now < last qualifying tx created_at + cooldown
--   maxPerTarget → count same-day txs whose reference_id encodes target as part[2] (split by ':')
-- Additive: REPLACE function only; keeps unique indexes from 20260922_ghc_stage_pending.sql

CREATE OR REPLACE FUNCTION public.ghc_stage_pending(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL,
  p_daily_limit integer DEFAULT NULL,
  p_cooldown_ms bigint DEFAULT NULL,
  p_max_per_target integer DEFAULT NULL,
  p_target_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event text := upper(trim(coalesce(p_source_event, 'SYSTEM')));
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
  v_day_key text;
  v_day_count integer := 0;
  v_target_count integer := 0;
  v_last_at timestamptz;
  v_target text := nullif(trim(coalesce(p_target_id, '')), '');
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Serialize concurrent stage/claim/limit checks for this user
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));

  -- Africa/Lagos calendar day (matches lagosDayKey intent used by evaluate)
  v_day_key := to_char((v_now AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD');

  -- Already posted earned for this reference → idempotent
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'earned'
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', true,
      'holdId', v_posted.id,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'referenceId', v_ref,
      'status', 'posted'
    );
  END IF;

  -- Existing pending hold for this reference → idempotent
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'referenceId', v_ref,
      'status', 'pending',
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'reason', v_existing.reason,
        'sourceEvent', v_existing.source_event,
        'referenceId', v_existing.reference_id,
        'createdAt', (extract(epoch from v_existing.created_at) * 1000)::bigint
      )
    );
  END IF;

  -- Cooldown: last qualifying event for this source_event (any day)
  IF p_cooldown_ms IS NOT NULL AND p_cooldown_ms > 0 THEN
    SELECT max(created_at) INTO v_last_at
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned');

    IF v_last_at IS NOT NULL
       AND (extract(epoch from (v_now - v_last_at)) * 1000) < p_cooldown_ms THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'COOLDOWN',
        'cooldownMs', p_cooldown_ms,
        'lastAt', (extract(epoch from v_last_at) * 1000)::bigint
      );
    END IF;
  END IF;

  -- Daily limit: qualifying txs on Lagos calendar day for this source_event
  IF p_daily_limit IS NOT NULL AND p_daily_limit >= 0 THEN
    SELECT count(*)::integer INTO v_day_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key;

    IF v_day_count >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'DAILY_CAP',
        'dailyLimit', p_daily_limit,
        'dayCount', v_day_count,
        'dayKey', v_day_key
      );
    END IF;
  END IF;

  -- maxPerTargetPerDay: reference_id parts[2] is target (event:user:target:...)
  IF p_max_per_target IS NOT NULL AND p_max_per_target >= 0 AND v_target IS NOT NULL THEN
    SELECT count(*)::integer INTO v_target_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key
      AND split_part(coalesce(reference_id, ''), ':', 3) = v_target;

    IF v_target_count >= p_max_per_target THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'TARGET_CAP',
        'maxPerTarget', p_max_per_target,
        'targetCount', v_target_count,
        'targetId', v_target
      );
    END IF;
  END IF;

  v_tx_id := gen_random_uuid();
  INSERT INTO public.ghc_transactions (
    id, user_id, kind, amount, status, reason, source_event, reference_id, metadata, created_at
  ) VALUES (
    v_tx_id,
    p_user_id,
    'pending',
    v_amount,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
    v_ref,
    jsonb_build_object(
      'ruleId', p_rule_id,
      'stagedAt', v_now,
      'targetId', v_target,
      'dayKey', v_day_key
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_amount,
    'referenceId', v_ref,
    'status', 'pending',
    'dayKey', v_day_key,
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_amount,
      'status', 'pending',
      'reason', coalesce(nullif(trim(p_reason), ''), 'Reward'),
      'sourceEvent', coalesce(nullif(trim(p_source_event), ''), 'SYSTEM'),
      'referenceId', v_ref,
      'createdAt', (extract(epoch from v_now) * 1000)::bigint
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = v_ref
      AND (
        (kind = 'pending' AND status = 'pending')
        OR (kind = 'earned' AND status = 'posted')
      )
      AND amount > 0
    ORDER BY created_at ASC
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'alreadyPosted', (v_existing.kind = 'earned'),
        'holdId', v_existing.id,
        'transactionId', v_existing.id,
        'amount', v_existing.amount,
        'referenceId', v_ref,
        'status', v_existing.status
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
  WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SCHEMA_MISMATCH');
END;
$$;

-- Drop old 6-arg overload if present so only limit-aware signature remains callable
DROP FUNCTION IF EXISTS public.ghc_stage_pending(text, numeric, text, text, text, text);

REVOKE ALL ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) TO service_role;

COMMENT ON FUNCTION public.ghc_stage_pending IS
  'Stage pending GHC reward with atomic dailyLimit/cooldown/maxPerTarget checks. service_role only. Idempotent on (user_id, reference_id).';

-- ============================================================================
-- SOURCE 031: 20261022010031_ghc_ledger_rpc_acl.sql
-- SHA256: 575d08166f5b4baf6d5ac43100aa676b827f1e88d034ab408392cef6696258c3
-- ============================================================================
-- GH-CONNECT corrective ACL for ledger foundation RPCs
-- Additive only: privilege hardening for functions created in 20261022010001_ghc_economy_ledger.sql
-- Does NOT alter function bodies, tables, indexes, RLS policies, or any protected live objects.
--
-- Target functions (exact identities from 20260821):
--   public.ghc_available_balance(text)
--   public.ghc_execute_transfer(text, text, numeric, text, text, text)
--
-- Apply after Group 1 economy foundation (20260821 + 20260822*) and before production smoke tests.

-- ---------------------------------------------------------------------------
-- ghc_available_balance(text)
-- LANGUAGE sql STABLE (invoker rights; not SECURITY DEFINER).
-- Default PostgreSQL privilege is EXECUTE for PUBLIC; harden to service_role only.
-- Internal callers (ghc_execute_transfer / ghc_execute_spend bodies) run as function
-- owner and do not depend on PUBLIC EXECUTE.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ghc_available_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_available_balance(text) TO service_role;

-- ---------------------------------------------------------------------------
-- ghc_execute_transfer(text, text, numeric, text, text, text)
-- SECURITY DEFINER SET search_path = public.
-- 20260821 already REVOKEs PUBLIC but never GRANTs service_role; server path
-- (lib/server/economy/db.ts → rpcExecuteTransfer) requires service_role EXECUTE.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 032: 20261022010032_ghc_user_accounts_rls_lockdown.sql
-- SHA256: 09d9c3e307dbe41cb0a507e5f1870b40d4fc8d3b1d8e6930b070cf056dc90882
-- ============================================================================
-- Additive security hardening: ghc_user_accounts must not be broadly readable via PostgREST.
-- Prior policy ghc_user_accounts_select_own used USING (true), exposing all rows.
-- Align with other authority tables: deny client access; service-role / SECURITY DEFINER RPCs only.

DROP POLICY IF EXISTS ghc_user_accounts_select_own ON public.ghc_user_accounts;

-- Explicit deny for anon/authenticated clients on all operations.
-- Service role bypasses RLS; RPCs that need reads run as SECURITY DEFINER.
DROP POLICY IF EXISTS ghc_user_accounts_deny_client_all ON public.ghc_user_accounts;
CREATE POLICY ghc_user_accounts_deny_client_all
  ON public.ghc_user_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.ghc_user_accounts IS
  'Internal account anchor. Client access denied via RLS; mutations via service-role RPCs only.';

-- ============================================================================
-- SOURCE 033: 20261022010033_gh_communities_core.sql
-- SHA256: a1a3c2837aae85c6240f20960e4f9de4b1da621cce09efb13c958b8a7109a9c5
-- ============================================================================
-- PASS 3 — Minimal durable communities (additive)
-- Does not replace local community-registry board/events; anchors membership + privacy server-side.
-- Reuses ghc_community_reports / ghc_community_moderation_log if already applied.

CREATE TABLE IF NOT EXISTS public.gh_communities (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  purpose         text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  category        text NOT NULL DEFAULT 'general',
  privacy         text NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'private', 'invite-only')),
  created_by      text NOT NULL,
  cover_image     text,
  rules           jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  welcome_message text NOT NULL DEFAULT '',
  conversation_id text,
  member_count    integer NOT NULL DEFAULT 1 CHECK (member_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_communities_public
  ON public.gh_communities (created_at DESC)
  WHERE deleted_at IS NULL AND privacy = 'public';

CREATE TABLE IF NOT EXISTS public.gh_community_members (
  community_id    text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  gh_user_id      text NOT NULL,
  role            text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'banned', 'left')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, gh_user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_community_members_user
  ON public.gh_community_members (gh_user_id)
  WHERE status = 'active';

ALTER TABLE public.gh_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_communities_no_client ON public.gh_communities;
CREATE POLICY gh_communities_no_client ON public.gh_communities
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_community_members_no_client ON public.gh_community_members;
CREATE POLICY gh_community_members_no_client ON public.gh_community_members
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_community_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_creator text := COALESCE(p_row->>'createdBy', '');
BEGIN
  IF v_id = '' OR v_creator = '' OR COALESCE(p_row->>'name', '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_communities (
    id, name, purpose, description, category, privacy, created_by,
    cover_image, rules, tags, welcome_message, conversation_id
  ) VALUES (
    v_id,
    p_row->>'name',
    COALESCE(p_row->>'purpose', ''),
    COALESCE(p_row->>'description', ''),
    COALESCE(p_row->>'category', 'general'),
    COALESCE(p_row->>'privacy', 'public'),
    v_creator,
    NULLIF(p_row->>'coverImage', ''),
    COALESCE(p_row->'rules', '[]'::jsonb),
    COALESCE(p_row->'tags', '[]'::jsonb),
    COALESCE(p_row->>'welcomeMessage', ''),
    NULLIF(p_row->>'conversationId', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (v_id, v_creator, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_join(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy text;
  v_status text;
BEGIN
  SELECT privacy INTO v_privacy FROM public.gh_communities
  WHERE id = p_community_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_user_id AND status = 'banned'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANNED');
  END IF;

  v_status := CASE WHEN v_privacy = 'public' THEN 'active' ELSE 'pending' END;

  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (p_community_id, p_user_id, 'member', v_status)
  ON CONFLICT (community_id, gh_user_id) DO UPDATE
    SET status = CASE
      WHEN gh_community_members.status = 'banned' THEN 'banned'
      WHEN gh_community_members.status = 'active' THEN 'active'
      ELSE EXCLUDED.status
    END;

  IF v_status = 'active' THEN
    UPDATE public.gh_communities
      SET member_count = (
        SELECT count(*) FROM public.gh_community_members
        WHERE community_id = p_community_id AND status = 'active'
      ),
      updated_at = now()
    WHERE id = p_community_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_leave(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gh_community_members
    SET status = 'left'
    WHERE community_id = p_community_id
      AND gh_user_id = p_user_id
      AND role <> 'owner';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER_OR_OWNER');
  END IF;
  UPDATE public.gh_communities
    SET member_count = (
      SELECT count(*) FROM public.gh_community_members
      WHERE community_id = p_community_id AND status = 'active'
    ),
    updated_at = now()
  WHERE id = p_community_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_list_public(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.name,
      c.purpose,
      c.description,
      c.category,
      c.privacy,
      c.created_by AS "createdBy",
      c.member_count AS "memberCount",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_communities c
    WHERE c.deleted_at IS NULL AND c.privacy = 'public'
    ORDER BY c.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  ) q;
  RETURN jsonb_build_object('ok', true, 'communities', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_community_member_role(
  p_community_id text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text; v_status text;
BEGIN
  SELECT role, status INTO v_role, v_status
  FROM public.gh_community_members
  WHERE community_id = p_community_id AND gh_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'role', null, 'status', null);
  END IF;
  RETURN jsonb_build_object('ok', true, 'role', v_role, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_community_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_join(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_leave(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_list_public(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_member_role(text, text) TO service_role;

-- PASS 4 — join request approve / reject (admin/owner only)

CREATE OR REPLACE FUNCTION public.gh_community_join_decide(
  p_community_id text,
  p_actor_id text,
  p_applicant_id text,
  p_approve boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_actor_status text;
BEGIN
  IF p_actor_id = p_applicant_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_DECIDE');
  END IF;

  SELECT role, status INTO v_actor_role, v_actor_status
  FROM public.gh_community_members
  WHERE community_id = p_community_id AND gh_user_id = p_actor_id;

  IF NOT FOUND OR v_actor_status <> 'active' OR v_actor_role NOT IN ('owner', 'admin', 'moderator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_applicant_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_PENDING');
  END IF;

  IF p_approve THEN
    UPDATE public.gh_community_members
      SET status = 'active', role = 'member'
      WHERE community_id = p_community_id AND gh_user_id = p_applicant_id;
    UPDATE public.gh_communities
      SET member_count = (
        SELECT count(*) FROM public.gh_community_members
        WHERE community_id = p_community_id AND status = 'active'
      ),
      updated_at = now()
    WHERE id = p_community_id;
    RETURN jsonb_build_object('ok', true, 'status', 'active');
  ELSE
    UPDATE public.gh_community_members
      SET status = 'left'
      WHERE community_id = p_community_id AND gh_user_id = p_applicant_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) TO service_role;

-- ============================================================================
-- SOURCE 034: 20261022010034_gh_pass5_soft_limits_polls.sql
-- SHA256: f4f35437d0044cbf5888c4bab4268b13828d40dd9571c02e39920a6ba583c5f6
-- ============================================================================
-- PASS 5 — durable mute/restrict + minimal polls + community role set
-- Additive; service-role only.

CREATE TABLE IF NOT EXISTS public.gh_user_mutes (
  muter_id   text NOT NULL,
  muted_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT gh_user_mutes_no_self CHECK (muter_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.gh_user_restricts (
  restrictor_id text NOT NULL,
  restricted_id text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restrictor_id, restricted_id),
  CONSTRAINT gh_user_restricts_no_self CHECK (restrictor_id <> restricted_id)
);

ALTER TABLE public.gh_user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_restricts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_user_mutes_no_client ON public.gh_user_mutes;
CREATE POLICY gh_user_mutes_no_client ON public.gh_user_mutes FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_user_restricts_no_client ON public.gh_user_restricts;
CREATE POLICY gh_user_restricts_no_client ON public.gh_user_restricts FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_mute_set(p_muter text, p_muted text, p_mute boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_muter = p_muted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_mute THEN
    INSERT INTO public.gh_user_mutes (muter_id, muted_id) VALUES (p_muter, p_muted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_mutes WHERE muter_id = p_muter AND muted_id = p_muted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'muted', p_mute);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_restrict_set(p_restrictor text, p_restricted text, p_restrict boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_restrictor = p_restricted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_restrict THEN
    INSERT INTO public.gh_user_restricts (restrictor_id, restricted_id) VALUES (p_restrictor, p_restricted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_restricts WHERE restrictor_id = p_restrictor AND restricted_id = p_restricted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'restricted', p_restrict);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_polls (
  id         text PRIMARY KEY,
  post_id    text,
  author_id  text NOT NULL,
  question   text NOT NULL,
  options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gh_poll_votes (
  poll_id    text NOT NULL REFERENCES public.gh_polls(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  option_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.gh_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_polls_no_client ON public.gh_polls;
CREATE POLICY gh_polls_no_client ON public.gh_polls FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_poll_votes_no_client ON public.gh_poll_votes;
CREATE POLICY gh_poll_votes_no_client ON public.gh_poll_votes FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_poll_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' OR COALESCE(p_row->>'authorId','') = '' OR COALESCE(p_row->>'question','') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_polls (id, post_id, author_id, question, options, closes_at)
  VALUES (
    v_id,
    NULLIF(p_row->>'postId',''),
    p_row->>'authorId',
    p_row->>'question',
    COALESCE(p_row->'options', '[]'::jsonb),
    CASE WHEN p_row ? 'closesAt' THEN to_timestamp((p_row->>'closesAt')::bigint/1000.0) ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_polls WHERE id = p_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_community_set_role(
  p_community_id text,
  p_actor_id text,
  p_target_id text,
  p_role text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor_role text; v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'moderator', 'member') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  END IF;
  IF p_actor_id = p_target_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_ROLE');
  END IF;
  SELECT role INTO v_actor_role FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_actor_id AND status = 'active';
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT role INTO v_target_role FROM public.gh_community_members
    WHERE community_id = p_community_id AND gh_user_id = p_target_id AND status = 'active';
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MEMBER');
  END IF;
  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_CHANGE_OWNER');
  END IF;
  IF v_actor_role = 'admin' AND v_target_role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.gh_community_members SET role = p_role
    WHERE community_id = p_community_id AND gh_user_id = p_target_id;
  RETURN jsonb_build_object('ok', true, 'role', p_role);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_community_set_role(text, text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 035: 20261022010035_gh_poll_vote_validate.sql
-- SHA256: c75d9e04788424ebc60052d0e19750d55b9d5ee6c70cd5d9a85a4bd92d777156
-- ============================================================================
-- Pass 6: validate poll option belongs to poll; fail if closed
CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_options jsonb;
  v_closes timestamptz;
  v_found boolean := false;
  v_opt jsonb;
BEGIN
  SELECT options, closes_at INTO v_options, v_closes
  FROM public.gh_polls WHERE id = p_poll_id;
  IF v_options IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_closes IS NOT NULL AND v_closes < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CLOSED');
  END IF;
  FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
  LOOP
    IF (v_opt->>'id') = p_option_id THEN
      v_found := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OPTION');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ============================================================================
-- SOURCE 036: 20261022010036_gh_social_core.sql
-- SHA256: 2d240493dd77a522270aec106bf62bc5599ffc18959136188425b83067512528
-- ============================================================================
-- PASS 2 — GreenHaven social core (additive, non-destructive)
-- Posts, comments, reactions, stories, follows, saves.
-- Reuses: ghc_user_blocks, ghc_connection_requests, ghc_connection_contexts.
-- Service-role / SECURITY DEFINER only — no broad client write policies.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_posts (
  id              text PRIMARY KEY,
  author_id       text NOT NULL,
  author_name     text NOT NULL DEFAULT '',
  author_photo    text NOT NULL DEFAULT '',
  content         text NOT NULL DEFAULT '',
  images          jsonb NOT NULL DEFAULT '[]'::jsonb,
  video           text,
  pdf             text,
  pdf_name        text,
  visibility      text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'mutuals', 'private')),
  listing_id      text,
  listing_kind    text,
  community_id    text,
  community_name  text,
  content_type    text NOT NULL DEFAULT 'standard',
  like_count      integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count   integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  share_count     integer NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  is_edited       boolean NOT NULL DEFAULT false,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_posts_author_created
  ON public.gh_posts (author_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_posts_feed
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL AND visibility = 'public';

ALTER TABLE public.gh_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_posts_no_client ON public.gh_posts;
CREATE POLICY gh_posts_no_client ON public.gh_posts
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_post_comments (
  id              text PRIMARY KEY,
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  author_id       text NOT NULL,
  author_name     text NOT NULL DEFAULT '',
  author_photo    text NOT NULL DEFAULT '',
  text            text NOT NULL,
  parent_id       text REFERENCES public.gh_post_comments(id) ON DELETE CASCADE,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_post_comments_post
  ON public.gh_post_comments (post_id, created_at ASC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.gh_post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_comments_no_client ON public.gh_post_comments;
CREATE POLICY gh_post_comments_no_client ON public.gh_post_comments
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Reactions (likes) — one row per actor per post
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_post_reactions (
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  reaction        text NOT NULL DEFAULT 'like',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_gh_post_reactions_user
  ON public.gh_post_reactions (user_id, created_at DESC);

ALTER TABLE public.gh_post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_reactions_no_client ON public.gh_post_reactions;
CREATE POLICY gh_post_reactions_no_client ON public.gh_post_reactions
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Stories (server-authoritative expiry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_stories (
  id              text PRIMARY KEY,
  owner_id        text NOT NULL,
  owner_name      text NOT NULL DEFAULT '',
  owner_photo     text NOT NULL DEFAULT '',
  text            text NOT NULL DEFAULT '',
  media_type      text,
  media_url       text,
  audience        text NOT NULL DEFAULT 'everyone'
    CHECK (audience IN ('everyone', 'followers', 'friends', 'matches-only', 'private')),
  status          text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'expired', 'archived', 'highlight')),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_stories_active
  ON public.gh_stories (expires_at ASC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_gh_stories_owner
  ON public.gh_stories (owner_id, created_at DESC);

ALTER TABLE public.gh_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_stories_no_client ON public.gh_stories;
CREATE POLICY gh_stories_no_client ON public.gh_stories
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_story_views (
  story_id        text NOT NULL REFERENCES public.gh_stories(id) ON DELETE CASCADE,
  viewer_id       text NOT NULL,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

ALTER TABLE public.gh_story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_story_views_no_client ON public.gh_story_views;
CREATE POLICY gh_story_views_no_client ON public.gh_story_views
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_follows (
  follower_id     text NOT NULL,
  following_id    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT gh_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_follows_following
  ON public.gh_follows (following_id, created_at DESC);

ALTER TABLE public.gh_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_follows_no_client ON public.gh_follows;
CREATE POLICY gh_follows_no_client ON public.gh_follows
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Saves / bookmarks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_saves (
  user_id         text NOT NULL,
  post_id         text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_saves_user
  ON public.gh_saves (user_id, created_at DESC);

ALTER TABLE public.gh_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_saves_no_client ON public.gh_saves;
CREATE POLICY gh_saves_no_client ON public.gh_saves
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER, service_role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gh_post_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  INSERT INTO public.gh_posts (
    id, author_id, author_name, author_photo, content, images, video, pdf, pdf_name,
    visibility, listing_id, listing_kind, community_id, community_name, content_type, created_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'content', ''),
    COALESCE(p_row->'images', '[]'::jsonb),
    NULLIF(p_row->>'video', ''),
    NULLIF(p_row->>'pdf', ''),
    NULLIF(p_row->>'pdfName', ''),
    COALESCE(p_row->>'visibility', 'public'),
    NULLIF(p_row->>'listingId', ''),
    NULLIF(p_row->>'listingKind', ''),
    NULLIF(p_row->>'communityId', ''),
    NULLIF(p_row->>'communityName', ''),
    COALESCE(p_row->>'contentType', 'standard'),
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_post_soft_delete(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author text;
BEGIN
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  UPDATE public.gh_posts
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_post_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'id', p_post_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_post_list_feed(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  -- Order by subquery alias "createdAt" (not created_at); fixes PostgreSQL 42703
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (p_before_ms IS NULL OR (extract(epoch from p.created_at)*1000) < p_before_ms)
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text,
  p_user_id text,
  p_reaction text DEFAULT 'like'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = p_reaction
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = p_reaction;
    UPDATE public.gh_posts
      SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
      WHERE id = p_post_id AND p_reaction = 'like';
  ELSE
    INSERT INTO public.gh_post_reactions (post_id, user_id, reaction)
    VALUES (p_post_id, p_user_id, p_reaction)
    ON CONFLICT DO NOTHING;
    UPDATE public.gh_posts
      SET like_count = like_count + 1, updated_at = now()
      WHERE id = p_post_id AND p_reaction = 'like';
  END IF;

  SELECT like_count INTO v_count FROM public.gh_posts WHERE id = p_post_id;
  RETURN jsonb_build_object(
    'ok', true,
    'liked', NOT v_exists,
    'likeCount', COALESCE(v_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_post text := COALESCE(p_row->>'postId', '');
BEGIN
  IF v_id = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  INSERT INTO public.gh_post_comments (
    id, post_id, author_id, author_name, author_photo, text, parent_id, created_at
  ) VALUES (
    v_id,
    v_post,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'parentId', ''),
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  );
  UPDATE public.gh_posts
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_comment_list(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.author_id AS "authorId",
      c.author_name AS "authorName",
      c.author_photo AS "authorPhoto",
      c.text,
      c.parent_id AS "replyTo",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_comments c
    WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
    LIMIT 500
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_follow_set(
  p_follower_id text,
  p_following_id text,
  p_follow boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_follower_id = p_following_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_follower_id AND b.blocked_id = p_following_id)
       OR (b.blocker_id = p_following_id AND b.blocked_id = p_follower_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;
  IF p_follow THEN
    INSERT INTO public.gh_follows (follower_id, following_id)
    VALUES (p_follower_id, p_following_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_follows
    WHERE follower_id = p_follower_id AND following_id = p_following_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'following', p_follow);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_follow_list(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_following jsonb;
  v_followers jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(following_id ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_following FROM public.gh_follows WHERE follower_id = p_user_id;
  SELECT COALESCE(jsonb_agg(follower_id ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_followers FROM public.gh_follows WHERE following_id = p_user_id;
  RETURN jsonb_build_object(
    'ok', true,
    'following', v_following,
    'followers', v_followers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_block_set(
  p_blocker_id text,
  p_blocked_id text,
  p_block boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_blocker_id = p_blocked_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF');
  END IF;
  IF p_block THEN
    INSERT INTO public.ghc_user_blocks (blocker_id, blocked_id)
    VALUES (p_blocker_id, p_blocked_id)
    ON CONFLICT DO NOTHING;
    DELETE FROM public.gh_follows
    WHERE (follower_id = p_blocker_id AND following_id = p_blocked_id)
       OR (follower_id = p_blocked_id AND following_id = p_blocker_id);
  ELSE
    DELETE FROM public.ghc_user_blocks
    WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'blocked', p_block);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_expires timestamptz;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_row ? 'expiresAt' THEN
    v_expires := to_timestamp((p_row->>'expiresAt')::bigint / 1000.0);
  ELSE
    v_expires := now() + interval '24 hours';
  END IF;
  INSERT INTO public.gh_stories (
    id, owner_id, owner_name, owner_photo, text, media_type, media_url,
    audience, status, expires_at, created_at
  ) VALUES (
    v_id,
    COALESCE(p_row->>'ownerId', ''),
    COALESCE(p_row->>'ownerName', p_row->>'name', ''),
    COALESCE(p_row->>'ownerPhoto', p_row->>'photo', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'mediaType', ''),
    NULLIF(p_row->>'mediaUrl', ''),
    COALESCE(p_row->>'audience', 'everyone'),
    'published',
    v_expires,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_list_active(p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  -- Expire stale published stories
  UPDATE public.gh_stories
    SET status = 'expired'
    WHERE status = 'published' AND expires_at <= now();

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.owner_id AS "ownerId",
      s.owner_name AS name,
      s.owner_photo AS photo,
      s.text,
      CASE WHEN s.media_url IS NOT NULL THEN
        jsonb_build_object('type', COALESCE(s.media_type, 'image'), 'url', s.media_url)
      ELSE NULL END AS media,
      s.audience,
      s.status,
      (extract(epoch from s.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from s.expires_at)*1000)::bigint AS "expiresAt"
    FROM public.gh_stories s
    WHERE s.status = 'published'
      AND s.expires_at > now()
      AND (
        s.audience = 'everyone'
        OR s.owner_id = p_viewer_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = s.owner_id)
           OR (b.blocker_id = s.owner_id AND b.blocked_id = p_viewer_id)
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  ) q;
  RETURN jsonb_build_object('ok', true, 'stories', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_view(p_story_id text, p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_stories
    WHERE id = p_story_id AND status = 'published' AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  INSERT INTO public.gh_story_views (story_id, viewer_id)
  VALUES (p_story_id, p_viewer_id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_save_toggle(p_user_id text, p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exists boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.gh_saves WHERE user_id = p_user_id AND post_id = p_post_id
  ) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.gh_saves WHERE user_id = p_user_id AND post_id = p_post_id;
  ELSE
    INSERT INTO public.gh_saves (user_id, post_id) VALUES (p_user_id, p_post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'saved', NOT v_exists);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gh_post_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_comment_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_follow_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_follow_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_block_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_story_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role;

-- PASS 5 — durable mute / restrict (soft limits; block remains ghc_user_blocks)

CREATE TABLE IF NOT EXISTS public.gh_user_mutes (
  muter_id   text NOT NULL,
  muted_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT gh_user_mutes_no_self CHECK (muter_id <> muted_id)
);

CREATE TABLE IF NOT EXISTS public.gh_user_restricts (
  restrictor_id text NOT NULL,
  restricted_id text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restrictor_id, restricted_id),
  CONSTRAINT gh_user_restricts_no_self CHECK (restrictor_id <> restricted_id)
);

ALTER TABLE public.gh_user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_restricts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_user_mutes_no_client ON public.gh_user_mutes;
CREATE POLICY gh_user_mutes_no_client ON public.gh_user_mutes FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_user_restricts_no_client ON public.gh_user_restricts;
CREATE POLICY gh_user_restricts_no_client ON public.gh_user_restricts FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_mute_set(p_muter text, p_muted text, p_mute boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_muter = p_muted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_mute THEN
    INSERT INTO public.gh_user_mutes (muter_id, muted_id) VALUES (p_muter, p_muted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_mutes WHERE muter_id = p_muter AND muted_id = p_muted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'muted', p_mute);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_restrict_set(p_restrictor text, p_restricted text, p_restrict boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_restrictor = p_restricted THEN RETURN jsonb_build_object('ok', false, 'error', 'SELF'); END IF;
  IF p_restrict THEN
    INSERT INTO public.gh_user_restricts (restrictor_id, restricted_id) VALUES (p_restrictor, p_restricted) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.gh_user_restricts WHERE restrictor_id = p_restrictor AND restricted_id = p_restricted;
  END IF;
  RETURN jsonb_build_object('ok', true, 'restricted', p_restrict);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role;

-- Minimal durable polls (feed post-linked)

CREATE TABLE IF NOT EXISTS public.gh_polls (
  id         text PRIMARY KEY,
  post_id    text,
  author_id  text NOT NULL,
  question   text NOT NULL,
  options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gh_poll_votes (
  poll_id    text NOT NULL REFERENCES public.gh_polls(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  option_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.gh_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_polls_no_client ON public.gh_polls;
CREATE POLICY gh_polls_no_client ON public.gh_polls FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_poll_votes_no_client ON public.gh_poll_votes;
CREATE POLICY gh_poll_votes_no_client ON public.gh_poll_votes FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_poll_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text := COALESCE(p_row->>'id', '');
BEGIN
  IF v_id = '' OR COALESCE(p_row->>'authorId','') = '' OR COALESCE(p_row->>'question','') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  INSERT INTO public.gh_polls (id, post_id, author_id, question, options, closes_at)
  VALUES (
    v_id,
    NULLIF(p_row->>'postId',''),
    p_row->>'authorId',
    p_row->>'question',
    COALESCE(p_row->'options', '[]'::jsonb),
    CASE WHEN p_row ? 'closesAt' THEN to_timestamp((p_row->>'closesAt')::bigint/1000.0) ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gh_polls WHERE id = p_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 037: 20261022010037_gh_poll_vote_authoritative.sql
-- SHA256: e6c8199ffb1771b2625f0566aad40af8435b1dd98c898a4068d30859a6898e19
-- ============================================================================
-- Authoritative gh_poll_vote (after social_core / pass5 soft-limits).
-- Restores option/closed/duplicate checks that were overwritten by later CREATE OR REPLACE.
-- ACL: service_role only.

CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_options jsonb;
  v_closes timestamptz;
  v_found boolean := false;
  v_opt jsonb;
BEGIN
  SELECT options, closes_at INTO v_options, v_closes
  FROM public.gh_polls WHERE id = p_poll_id;
  IF v_options IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_closes IS NOT NULL AND v_closes < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CLOSED');
  END IF;
  FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
  LOOP
    IF (v_opt->>'id') = p_option_id THEN
      v_found := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OPTION');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_poll_vote(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 038: 20261022010038_gh_post_list_feed_order_fix.sql
-- SHA256: e2827e36ef7c5c09da7c5a1ca5f817cdf21293331741ef32bbd46030788aee18
-- ============================================================================
-- Fix gh_post_list_feed: outer ORDER BY must use subquery alias "createdAt"
-- (PostgreSQL 42703: column q.created_at does not exist).
-- Safe: CREATE OR REPLACE only; does not drop tables or mutate post rows.

CREATE OR REPLACE FUNCTION public.gh_post_list_feed(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (p_before_ms IS NULL OR (extract(epoch from p.created_at)*1000) < p_before_ms)
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed(text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role;

-- ============================================================================
-- SOURCE 039: 20261022010039_rpc_acl_lockdown.sql
-- SHA256: bc877ab415f9bec66025b81474dd209abcf848416fb241c560d28a1e190019df
-- ============================================================================
-- RPC ACL lockdown (idempotent / partial-DB safe)
-- REVOKE PUBLIC execute; GRANT service_role only.
-- Apply on BOTH Mainnet and Testnet after core migrations.
-- Does not alter table data or function bodies.

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_block_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_block_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_block_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_comment_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_comment_list(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_comment_list(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_comment_list(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_join(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_join(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_join(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_join_decide(text, text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_leave(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_leave(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_leave(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_list_public(integer) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_list_public(integer) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_list_public(integer)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_member_role(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_member_role(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_member_role(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_set_role(text, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_set_role(text, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_set_role(text, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_follow_list(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_follow_list(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_follow_list(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_follow_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_follow_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_follow_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_listing_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_listing_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_listing_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_order_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_order_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_order_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_orders_list_for_user(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_mute_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_mute_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_poll_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_poll_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_poll_vote(text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_poll_vote(text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_list_feed(text, integer, bigint) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_list_feed(text, integer, bigint)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_soft_delete(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_soft_delete(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_reaction_toggle(text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_restrict_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_restrict_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_save_toggle(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_list_active(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_view(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_view(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_accept_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_accept_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_accept_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_available_balance(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_available_balance(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_available_balance(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_cancel_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_cancel_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_cancel_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_claim_pending(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_claim_pending(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_claim_pending(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_commit_claim_day(text, date, int, int, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_accept(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_accept(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_accept(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_decline(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_decline(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_decline(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_upsert(text, text, jsonb, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_create_transfer_request(text, text, numeric, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_decline_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_decline_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_decline_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_economic_population_stats() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_economic_population_stats() TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_economic_population_stats()';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_ensure_account_created_at(text, timestamptz) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_ensure_account_created_at(text, timestamptz) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_ensure_account_created_at(text, timestamptz)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_ensure_public_id(text, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_spend(text, numeric, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_transfer(text, text, numeric, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_expire_request_if_needed(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_expire_request_if_needed(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_expire_request_if_needed(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_get_claim_streak(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_get_claim_streak(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_get_claim_streak(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_get_global_demand(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_get_global_demand(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_get_global_demand(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_membership_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_membership_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_membership_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_provider(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_by_provider(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_record_global_demand(text, numeric) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_record_global_demand(text, numeric) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_record_global_demand(text, numeric)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_resolve_public_id(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_resolve_public_id(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_wallet_snapshot(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_wallet_snapshot(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_wallet_snapshot(text)';
  END;
END $$;

-- ============================================================================
-- SOURCE 040: 20261022010040_ghc_withdrawal_requests.sql
-- SHA256: 7d52a328498b8a116beb535cc98b1340c688dd088d22bcf87b626dd7e851be5c
-- ============================================================================
-- GHC → Pi withdrawal requests (manual/platform settlement).
-- Lock model: pending rows reserve GHC; settle posts one durable spend on complete.
-- Rate: freeze ghc_per_pi on each request (default from app: REFERENCE_GHC_PER_PI = 100).

CREATE TABLE IF NOT EXISTS public.ghc_withdrawal_requests (
  id                text PRIMARY KEY,
  user_id           text NOT NULL,
  ghc_amount        numeric(24, 8) NOT NULL CHECK (ghc_amount > 0),
  ghc_per_pi        numeric(24, 8) NOT NULL CHECK (ghc_per_pi > 0),
  pi_amount         numeric(24, 12) NOT NULL CHECK (pi_amount > 0),
  min_pi_threshold  numeric(24, 8) NOT NULL DEFAULT 100,
  pi_wallet_address text NOT NULL,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested', 'under_review', 'approved', 'processing',
                      'completed', 'rejected', 'failed'
                    )),
  idempotency_key   text NOT NULL,
  reject_reason     text,
  settlement_ref    text,
  operator_id       text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_withdrawal_idempotency
  ON public.ghc_withdrawal_requests (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ghc_withdrawal_user_created
  ON public.ghc_withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ghc_withdrawal_status
  ON public.ghc_withdrawal_requests (status, created_at DESC)
  WHERE status NOT IN ('completed', 'rejected', 'failed');

ALTER TABLE public.ghc_withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_withdrawal_requests_no_client ON public.ghc_withdrawal_requests;
CREATE POLICY ghc_withdrawal_requests_no_client ON public.ghc_withdrawal_requests
  FOR ALL USING (false) WITH CHECK (false);

-- Pending lock total for a user
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_locked_ghc(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(ghc_amount), 0)
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id
    AND status IN ('requested', 'under_review', 'approved', 'processing');
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_locked_ghc(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_locked_ghc(text) TO service_role;

-- Create request + virtual lock (atomic under advisory lock)
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_create(
  p_user_id text,
  p_ghc_amount numeric,
  p_ghc_per_pi numeric,
  p_pi_wallet text,
  p_idempotency_key text,
  p_min_pi numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
  v_withdrawable numeric;
  v_pi numeric;
  v_id text;
  v_existing public.ghc_withdrawal_requests%ROWTYPE;
  v_wallet text := trim(COALESCE(p_pi_wallet, ''));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF p_ghc_amount IS NULL OR p_ghc_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_ghc_per_pi IS NULL OR p_ghc_per_pi <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  END IF;
  IF length(v_wallet) < 8 OR length(v_wallet) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WALLET');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_withdraw:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request', to_jsonb(v_existing)
    );
  END IF;

  -- Ledger balance: sum of posted amounts (same convention as wallet)
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.ghc_transactions
  WHERE user_id = p_user_id AND status = 'posted';

  v_locked := public.ghc_withdrawal_locked_ghc(p_user_id);
  v_withdrawable := v_balance - v_locked;
  IF v_withdrawable < p_ghc_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_WITHDRAWABLE',
      'balance', v_balance,
      'locked', v_locked,
      'withdrawable', v_withdrawable
    );
  END IF;

  v_pi := round((p_ghc_amount / p_ghc_per_pi)::numeric, 8);
  IF v_pi < COALESCE(p_min_pi, 100) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'BELOW_MINIMUM_PI',
      'piAmount', v_pi,
      'minPi', COALESCE(p_min_pi, 100)
    );
  END IF;

  v_id := 'wd_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.ghc_withdrawal_requests (
    id, user_id, ghc_amount, ghc_per_pi, pi_amount, min_pi_threshold,
    pi_wallet_address, status, idempotency_key
  ) VALUES (
    v_id, p_user_id, p_ghc_amount, p_ghc_per_pi, v_pi, COALESCE(p_min_pi, 100),
    v_wallet, 'requested', trim(p_idempotency_key)
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'request', to_jsonb(v_existing),
    'balance', v_balance,
    'locked', v_locked + p_ghc_amount,
    'withdrawable', v_withdrawable - p_ghc_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) TO service_role;

-- Operator status transition (no balance side-effects except reject/fail release via status)
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_set_status(
  p_id text,
  p_operator_id text,
  p_status text,
  p_settlement_ref text DEFAULT NULL,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_withdrawal_requests%ROWTYPE;
  v_next text := lower(trim(COALESCE(p_status, '')));
BEGIN
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_operator_id IS NULL OR length(trim(p_operator_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPERATOR_REQUIRED');
  END IF;
  IF v_next NOT IN (
    'under_review', 'approved', 'processing', 'completed', 'rejected', 'failed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT * INTO v_row FROM public.ghc_withdrawal_requests WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_row.status IN ('completed', 'rejected', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATE', 'request', to_jsonb(v_row));
  END IF;

  IF v_next = 'completed' AND (p_settlement_ref IS NULL OR length(trim(p_settlement_ref)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SETTLEMENT_REF_REQUIRED');
  END IF;

  UPDATE public.ghc_withdrawal_requests
  SET
    status = v_next,
    operator_id = trim(p_operator_id),
    settlement_ref = CASE WHEN v_next = 'completed' THEN trim(p_settlement_ref) ELSE settlement_ref END,
    reject_reason = CASE WHEN v_next IN ('rejected', 'failed') THEN left(trim(COALESCE(p_reject_reason, '')), 500) ELSE reject_reason END,
    updated_at = now(),
    completed_at = CASE WHEN v_next = 'completed' THEN now() ELSE completed_at END
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'request', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_set_status(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_set_status(text, text, text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 041: 20261022010041_gh_reaction_multi_type.sql
-- SHA256: 13ed44cdc21bc4a526f1674481d8f04f880f38a59a737c863a26b160cd9e017c
-- ============================================================================
-- Multi-type durable reactions (allowlist) + clearer toggle response.
-- Safe on existing gh_post_reactions (post_id, user_id, reaction) PK.
-- like_count on gh_posts only moves for reaction = 'like'.

CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text,
  p_user_id text,
  p_reaction text DEFAULT 'like'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
BEGIN
  IF v_reaction NOT IN (
    'like', 'love', 'laugh', 'wow', 'sad', 'angry',
    'support', 'inspire', 'insight', 'celebrate'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = v_reaction
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.gh_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = v_reaction;
    IF v_reaction = 'like' THEN
      UPDATE public.gh_posts
        SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
        WHERE id = p_post_id;
    END IF;
  ELSE
    INSERT INTO public.gh_post_reactions (post_id, user_id, reaction)
    VALUES (p_post_id, p_user_id, v_reaction)
    ON CONFLICT DO NOTHING;
    IF v_reaction = 'like' THEN
      UPDATE public.gh_posts
        SET like_count = like_count + 1, updated_at = now()
        WHERE id = p_post_id;
    END IF;
  END IF;

  SELECT like_count INTO v_count FROM public.gh_posts WHERE id = p_post_id;
  RETURN jsonb_build_object(
    'ok', true,
    'reaction', v_reaction,
    'active', NOT v_exists,
    'liked', CASE WHEN v_reaction = 'like' THEN NOT v_exists ELSE
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions
        WHERE post_id = p_post_id AND user_id = p_user_id AND reaction = 'like'
      )
    END,
    'likeCount', COALESCE(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 042: 20261022010042_gh_content_events.sql
-- SHA256: b199e0581b602b1c5136f2e674aec307c171b21e2b8c706302c86f60975f244a
-- ============================================================================
-- Phase 2.2: durable content attention events (no economy / ranking).
-- Spec: docs/GH_ATTENTION.md
-- Does NOT mint GHC, alter balances, or compute reputation.
--
-- Existing structures (do not duplicate):
--   gh_saves          → authoritative save toggle (Phase 1)
--   gh_posts.share_count → aggregate share counter
--   gh_story_views    → story-only views
--   gh_posts          → no view_count column today
--
-- New: gh_content_events for view / qualified_view / complete (and optional
-- unified log rows for save/share without replacing gh_saves).

CREATE TABLE IF NOT EXISTS public.gh_content_events (
  id            text PRIMARY KEY,
  content_id    text NOT NULL,
  content_kind  text NOT NULL DEFAULT 'post'
                CHECK (content_kind IN ('post', 'story', 'other')),
  actor_id      text NOT NULL,
  event_type    text NOT NULL
                CHECK (event_type IN (
                  'view', 'qualified_view', 'complete', 'save', 'share'
                )),
  -- Dedup window: e.g. UTC date '2026-09-25' or hour bucket '2026-09-25T14'
  window_key    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Optional non-economic metadata only (dwell_ms, client build, etc.)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Idempotency: one row per actor × content × event × window
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_content_events_dedup
  ON public.gh_content_events (content_id, actor_id, event_type, window_key);

CREATE INDEX IF NOT EXISTS idx_gh_content_events_content_type_created
  ON public.gh_content_events (content_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_content_events_actor_created
  ON public.gh_content_events (actor_id, created_at DESC);

ALTER TABLE public.gh_content_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_events_no_client ON public.gh_content_events;
CREATE POLICY gh_content_events_no_client ON public.gh_content_events
  FOR ALL USING (false) WITH CHECK (false);

-- Optional denormalized counters on posts (views only; never client-written)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_posts'
  ) THEN
    ALTER TABLE public.gh_posts
      ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0
        CHECK (view_count >= 0);
    ALTER TABLE public.gh_posts
      ADD COLUMN IF NOT EXISTS qualified_view_count integer NOT NULL DEFAULT 0
        CHECK (qualified_view_count >= 0);
  END IF;
END $$;

/**
 * Record one attention event. Actor must be supplied by trusted server (session).
 * Returns ok + whether a new row was inserted.
 */
CREATE OR REPLACE FUNCTION public.gh_content_event_record(
  p_content_id   text,
  p_actor_id     text,
  p_event_type   text,
  p_window_key   text,
  p_content_kind text DEFAULT 'post',
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_kind text := lower(trim(COALESCE(p_content_kind, 'post')));
  v_window text := trim(COALESCE(p_window_key, ''));
  v_id text;
  v_inserted boolean := false;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_type NOT IN ('view', 'qualified_view', 'complete', 'save', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF v_kind NOT IN ('post', 'story', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTENT_KIND');
  END IF;
  IF length(v_window) = 0 OR length(v_window) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  -- Soft existence check for posts (skip hard fail for other kinds)
  IF v_kind = 'post' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_posts
      WHERE id = trim(p_content_id) AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;
  END IF;

  v_id := 'ce_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_content_events (
    id, content_id, content_kind, actor_id, event_type, window_key, metadata
  ) VALUES (
    v_id,
    trim(p_content_id),
    v_kind,
    trim(p_actor_id),
    v_type,
    v_window,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (content_id, actor_id, event_type, window_key)
  DO UPDATE SET
    updated_at = now(),
    metadata = COALESCE(EXCLUDED.metadata, public.gh_content_events.metadata)
  RETURNING (xmax = 0) INTO v_inserted;

  -- Increment denormalized counters only on first insert for view types
  IF v_inserted AND v_kind = 'post' THEN
    IF v_type = 'view' THEN
      UPDATE public.gh_posts
        SET view_count = view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    ELSIF v_type = 'qualified_view' THEN
      UPDATE public.gh_posts
        SET qualified_view_count = qualified_view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'recorded', v_inserted,
    'eventType', v_type,
    'contentId', trim(p_content_id),
    'windowKey', v_window
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_content_events IS
  'Phase 2 attention signals only. No GHC/Pi/reward semantics. Saves authoritative in gh_saves.';
COMMENT ON FUNCTION public.gh_content_event_record IS
  'Server-only attention recorder. Actor must come from session, never client body identity.';

-- ============================================================================
-- SOURCE 043: 20261022010043_gh_content_attention_read.sql
-- SHA256: 3c3cf89075afc69f3f74a0fb51fe52861d8cbc13166ce0ff89a92cc2e1eb5e7d
-- ============================================================================
-- Phase 2.5: attention read model (aggregates only; no economy).
-- Spec: docs/GH_ATTENTION.md
-- Uses denormalized counters on gh_posts + gh_saves count + optional complete count.
-- Does NOT scan full event history for feed listing.

CREATE OR REPLACE FUNCTION public.gh_post_attention_summary(
  p_post_id text,
  p_viewer_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE;
  v_saves integer := 0;
  v_completes integer := 0;
  v_is_author boolean := false;
  v_views integer := 0;
  v_qviews integer := 0;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_viewer_id IS NULL OR length(trim(p_viewer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  SELECT * INTO v_post
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_is_author := (v_post.author_id = trim(p_viewer_id));

  -- Non-authors: only public posts may expose coarse public aggregates
  IF NOT v_is_author THEN
    IF v_post.visibility <> 'public' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  -- Denormalized counters (O(1) on post row; requires 20260927_gh_content_events.sql)
  SELECT
    COALESCE(p.view_count, 0),
    COALESCE(p.qualified_view_count, 0)
  INTO v_views, v_qviews
  FROM public.gh_posts p
  WHERE p.id = v_post.id;

  SELECT COUNT(*)::integer INTO v_saves
  FROM public.gh_saves
  WHERE post_id = v_post.id;

  -- Completes: count distinct actors (bounded by post; not a full-table scan)
  SELECT COUNT(*)::integer INTO v_completes
  FROM public.gh_content_events
  WHERE content_id = v_post.id
    AND event_type = 'complete';

  -- Author gets full private insights; public viewers get the same counters
  -- (no viewer identity list, no raw events).
  RETURN jsonb_build_object(
    'ok', true,
    'postId', v_post.id,
    'isAuthor', v_is_author,
    'visibility', v_post.visibility,
    'metrics', jsonb_build_object(
      'views', v_views,
      'qualifiedViews', v_qviews,
      'completions', v_completes,
      'saves', v_saves,
      'shares', COALESCE(v_post.share_count, 0),
      'likes', COALESCE(v_post.like_count, 0),
      'comments', COALESCE(v_post.comment_count, 0)
    ),
    'source', 'server_aggregates'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_attention_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_attention_summary(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_attention_summary IS
  'Phase 2.5 read model. Author or public-post viewer only. No raw event export. No economy.';

-- ============================================================================
-- SOURCE 044: 20261022010044_gh_content_event_access_guard.sql
-- SHA256: 88b381e6e290f72998c42aa39677c637a98e57beebae88adb9b4930ac0de9fe5
-- ============================================================================
-- Phase 2.6 minimal security: attention writes respect visibility + blocks.
-- Does not change economy, ranking, or client APIs.

CREATE OR REPLACE FUNCTION public.gh_content_event_record(
  p_content_id   text,
  p_actor_id     text,
  p_event_type   text,
  p_window_key   text,
  p_content_kind text DEFAULT 'post',
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_kind text := lower(trim(COALESCE(p_content_kind, 'post')));
  v_window text := trim(COALESCE(p_window_key, ''));
  v_id text;
  v_inserted boolean := false;
  v_author text;
  v_visibility text;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_type NOT IN ('view', 'qualified_view', 'complete', 'save', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF v_kind NOT IN ('post', 'story', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CONTENT_KIND');
  END IF;
  IF length(v_window) = 0 OR length(v_window) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  IF v_kind = 'post' THEN
    SELECT author_id, visibility INTO v_author, v_visibility
    FROM public.gh_posts
    WHERE id = trim(p_content_id) AND deleted_at IS NULL;

    IF v_author IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;

    -- Block either direction
    IF EXISTS (
      SELECT 1 FROM public.ghc_user_blocks
      WHERE (blocker_id = trim(p_actor_id) AND blocked_id = v_author)
         OR (blocker_id = v_author AND blocked_id = trim(p_actor_id))
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;

    -- Visibility: public | author always; followers needs follow edge; mutuals/private author-only for attention
    IF v_visibility = 'public' OR v_author = trim(p_actor_id) THEN
      NULL; -- allowed
    ELSIF v_visibility = 'followers' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.gh_follows
        WHERE follower_id = trim(p_actor_id) AND following_id = v_author
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
      END IF;
    ELSE
      -- mutuals / private: author-only for attention writes
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;

  v_id := 'ce_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_content_events (
    id, content_id, content_kind, actor_id, event_type, window_key, metadata
  ) VALUES (
    v_id,
    trim(p_content_id),
    v_kind,
    trim(p_actor_id),
    v_type,
    v_window,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (content_id, actor_id, event_type, window_key)
  DO UPDATE SET
    updated_at = now(),
    metadata = COALESCE(EXCLUDED.metadata, public.gh_content_events.metadata)
  RETURNING (xmax = 0) INTO v_inserted;

  IF v_inserted AND v_kind = 'post' THEN
    IF v_type = 'view' THEN
      UPDATE public.gh_posts
        SET view_count = view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    ELSIF v_type = 'qualified_view' THEN
      UPDATE public.gh_posts
        SET qualified_view_count = qualified_view_count + 1, updated_at = now()
        WHERE id = trim(p_content_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'recorded', v_inserted,
    'eventType', v_type,
    'contentId', trim(p_content_id),
    'windowKey', v_window
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_event_record(text, text, text, text, text, jsonb) TO service_role;

-- ============================================================================
-- SOURCE 045: 20261022010045_gh_post_curation.sql
-- SHA256: 545de5b78115af918fba9aef554632f492ffab72cb8197695d67c51836681bed
-- ============================================================================
-- Phase 3: post curation (upvote / downvote) — quality signal only.
-- NOT financial. No GHC/Pi/reputation/Curation Power weights.
-- One active choice per (post_id, user_id). Likes remain separate.

ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0
    CHECK (upvote_count >= 0);
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS downvote_count integer NOT NULL DEFAULT 0
    CHECK (downvote_count >= 0);

CREATE TABLE IF NOT EXISTS public.gh_post_curations (
  post_id     text NOT NULL,
  user_id     text NOT NULL,
  choice      text NOT NULL CHECK (choice IN ('upvote', 'downvote')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_post_curations_post_choice
  ON public.gh_post_curations (post_id, choice);

ALTER TABLE public.gh_post_curations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_curations_no_client ON public.gh_post_curations;
CREATE POLICY gh_post_curations_no_client ON public.gh_post_curations
  FOR ALL USING (false) WITH CHECK (false);

/**
 * Atomic curation set/toggle.
 * p_choice: 'upvote' | 'downvote' | 'neutral' (clear vote)
 * Returns authoritative counts + viewer state.
 */
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text := lower(trim(COALESCE(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer;
  v_down integer;
  v_state text := 'neutral';
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || trim(p_post_id) || ':' || trim(p_user_id)));

  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = trim(p_user_id) AND blocked_id = v_author)
       OR (blocker_id = v_author AND blocked_id = trim(p_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_visibility = 'public' OR v_author = trim(p_user_id) THEN
    NULL;
  ELSIF v_visibility = 'followers' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_follows
      WHERE follower_id = trim(p_user_id) AND following_id = v_author
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev
  FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);

  -- Toggle off if same choice sent again
  IF v_prev IS NOT NULL AND v_choice = v_prev THEN
    v_choice := 'neutral';
  END IF;

  IF v_prev IS NOT NULL THEN
    DELETE FROM public.gh_post_curations
    WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
    IF v_prev = 'upvote' THEN
      UPDATE public.gh_posts
        SET upvote_count = GREATEST(upvote_count - 1, 0), updated_at = now()
        WHERE id = trim(p_post_id);
    ELSIF v_prev = 'downvote' THEN
      UPDATE public.gh_posts
        SET downvote_count = GREATEST(downvote_count - 1, 0), updated_at = now()
        WHERE id = trim(p_post_id);
    END IF;
  END IF;

  IF v_choice IN ('upvote', 'downvote') THEN
    INSERT INTO public.gh_post_curations (post_id, user_id, choice)
    VALUES (trim(p_post_id), trim(p_user_id), v_choice)
    ON CONFLICT (post_id, user_id) DO UPDATE
      SET choice = EXCLUDED.choice, updated_at = now();
    IF v_choice = 'upvote' THEN
      UPDATE public.gh_posts
        SET upvote_count = upvote_count + 1, updated_at = now()
        WHERE id = trim(p_post_id);
    ELSE
      UPDATE public.gh_posts
        SET downvote_count = downvote_count + 1, updated_at = now()
        WHERE id = trim(p_post_id);
    END IF;
    v_state := v_choice;
  ELSE
    v_state := 'neutral';
  END IF;

  SELECT upvote_count, downvote_count INTO v_up, v_down
  FROM public.gh_posts WHERE id = trim(p_post_id);

  RETURN jsonb_build_object(
    'ok', true,
    'choice', v_state,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;

COMMENT ON TABLE public.gh_post_curations IS
  'Phase 3 curation votes. Quality signal only. Independent of likes.';

-- ============================================================================
-- SOURCE 046: 20261022010046_gh_reputation.sql
-- SHA256: ad3a4efd404c2413a70cd9bdbbb802186781cb14298c500ffa03db3a1140ffdc
-- ============================================================================
-- Phase 4: durable reputation (trust/quality signal only).
-- NOT financial. No GHC/Pi/rewards/Curation Power/ranking.
-- CURRENT STATE = gh_reputation_state (authoritative).
-- EVENT = gh_reputation_events (auditable inputs).
-- SNAPSHOT = gh_reputation_snapshots (history only).

CREATE TABLE IF NOT EXISTS public.gh_reputation_events (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  event_type      text NOT NULL,
  points          integer NOT NULL CHECK (points >= 0 AND points <= 10000),
  source_ref      text,
  idempotency_key text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_reputation_events_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_reputation_events_type_nonempty CHECK (length(trim(event_type)) > 0),
  CONSTRAINT gh_reputation_events_idem_nonempty CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_reputation_events_user_idem
  ON public.gh_reputation_events (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_gh_reputation_events_user_created
  ON public.gh_reputation_events (user_id, created_at DESC);

ALTER TABLE public.gh_reputation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_events_no_client ON public.gh_reputation_events;
CREATE POLICY gh_reputation_events_no_client ON public.gh_reputation_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_state (
  user_id         text PRIMARY KEY,
  total_points    integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level           integer NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 15),
  event_count     integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_reputation_state_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_reputation_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_state_no_client ON public.gh_reputation_state;
CREATE POLICY gh_reputation_state_no_client ON public.gh_reputation_state
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_reputation_snapshots (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  total_points    integer NOT NULL CHECK (total_points >= 0),
  level           integer NOT NULL CHECK (level >= 1 AND level <= 15),
  reason          text NOT NULL DEFAULT 'event',
  event_id        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_reputation_snapshots_user_created
  ON public.gh_reputation_snapshots (user_id, created_at DESC);

ALTER TABLE public.gh_reputation_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_reputation_snapshots_no_client ON public.gh_reputation_snapshots;
CREATE POLICY gh_reputation_snapshots_no_client ON public.gh_reputation_snapshots
  FOR ALL USING (false) WITH CHECK (false);

-- Level from points (mirrors lib/social-economy/reputation-levels.ts)
CREATE OR REPLACE FUNCTION public.gh_reputation_level_from_points(p_points integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_points >= 30000 THEN 15
    WHEN p_points >= 22000 THEN 14
    WHEN p_points >= 16000 THEN 13
    WHEN p_points >= 11500 THEN 12
    WHEN p_points >= 8000 THEN 11
    WHEN p_points >= 5500 THEN 10
    WHEN p_points >= 3700 THEN 9
    WHEN p_points >= 2400 THEN 8
    WHEN p_points >= 1500 THEN 7
    WHEN p_points >= 900 THEN 6
    WHEN p_points >= 500 THEN 5
    WHEN p_points >= 250 THEN 4
    WHEN p_points >= 100 THEN 3
    WHEN p_points >= 25 THEN 2
    ELSE 1
  END;
$$;

/**
 * Apply one reputation event (idempotent).
 * Points must be server-supplied (never client-trusted amounts).
 * Allowed event_type values are enforced by the application layer; DB accepts vetted types only via CHECK-like allowlist here.
 */
CREATE OR REPLACE FUNCTION public.gh_reputation_apply_event(
  p_user_id text,
  p_event_type text,
  p_points integer,
  p_idempotency_key text,
  p_source_ref text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_pts integer := GREATEST(0, LEAST(COALESCE(p_points, 0), 10000));
  v_id text;
  v_existing public.gh_reputation_events%ROWTYPE;
  v_total integer;
  v_level integer;
  v_count integer;
  v_snap_id text;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF length(v_type) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_TYPE_REQUIRED');
  END IF;
  -- Allowlist: only known non-financial participation signals
  IF v_type NOT IN (
    'profile_complete',
    'first_post',
    'community_join',
    'marketplace_order_complete',
    'report_resolved_helpful',
    'manual_adjustment_credit'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EVENT_TYPE');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;
  -- manual_adjustment reserved; still non-negative only in this phase
  IF v_type = 'manual_adjustment_credit' AND v_pts = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POINTS');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_rep:' || trim(p_user_id)));

  SELECT * INTO v_existing
  FROM public.gh_reputation_events
  WHERE user_id = trim(p_user_id) AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF FOUND THEN
    SELECT total_points, level, event_count INTO v_total, v_level, v_count
    FROM public.gh_reputation_state WHERE user_id = trim(p_user_id);
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'eventId', v_existing.id,
      'totalPoints', COALESCE(v_total, 0),
      'level', COALESCE(v_level, 1),
      'eventCount', COALESCE(v_count, 0)
    );
  END IF;

  v_id := 're_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_reputation_events (
    id, user_id, event_type, points, source_ref, idempotency_key, metadata
  ) VALUES (
    v_id, trim(p_user_id), v_type, v_pts,
    NULLIF(trim(COALESCE(p_source_ref, '')), ''),
    trim(p_idempotency_key),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  INSERT INTO public.gh_reputation_state (user_id, total_points, level, event_count, updated_at)
  VALUES (trim(p_user_id), v_pts, public.gh_reputation_level_from_points(v_pts), 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = public.gh_reputation_state.total_points + EXCLUDED.total_points,
    level = public.gh_reputation_level_from_points(
      public.gh_reputation_state.total_points + EXCLUDED.total_points
    ),
    event_count = public.gh_reputation_state.event_count + 1,
    updated_at = now();

  SELECT total_points, level, event_count INTO v_total, v_level, v_count
  FROM public.gh_reputation_state WHERE user_id = trim(p_user_id);

  v_snap_id := 'rs_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_reputation_snapshots (
    id, user_id, total_points, level, reason, event_id
  ) VALUES (
    v_snap_id, trim(p_user_id), v_total, v_level, 'event', v_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'eventId', v_id,
    'totalPoints', v_total,
    'level', v_level,
    'eventCount', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reputation_apply_event(text, text, integer, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reputation_apply_event(text, text, integer, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_reputation_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_level integer := 1;
  v_count integer := 0;
  v_updated timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  SELECT total_points, level, event_count, updated_at
  INTO v_total, v_level, v_count, v_updated
  FROM public.gh_reputation_state
  WHERE user_id = trim(p_user_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'userId', trim(p_user_id),
      'totalPoints', 0,
      'level', 1,
      'eventCount', 0,
      'updatedAt', null
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', trim(p_user_id),
    'totalPoints', v_total,
    'level', v_level,
    'eventCount', v_count,
    'updatedAt', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_reputation_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_reputation_get(text) TO service_role;

COMMENT ON TABLE public.gh_reputation_state IS
  'Authoritative current reputation. Not GHC balance. Service-role only.';
COMMENT ON TABLE public.gh_reputation_events IS
  'Auditable reputation inputs. Idempotent per user+key. No financial meaning.';

-- ============================================================================
-- SOURCE 047: 20261022010047_gh_creator_studio.sql
-- SHA256: 88468569378ea775fe2fea2578390d87faf3be1873497d50aa6439544ba3786b
-- ============================================================================
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

-- ============================================================================
-- SOURCE 048: 20261022010048_gh_ad_verification.sql
-- SHA256: d1163c37adbe0f320ba868d7c334677899463ba5bafe9ed360dfd0552edd33c6
-- ============================================================================
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

-- ============================================================================
-- SOURCE 049: 20261022010049_gh_media_assets.sql
-- SHA256: 3f20473221ee98df1635b6880fc30d17264d858b5b76d925a3dc4297190e6f97
-- ============================================================================
-- Phase 8: Durable media asset records (additive).
-- Ownership is always server-derived user_id. No financial columns.

CREATE TABLE IF NOT EXISTS public.gh_media_assets (
  id              text PRIMARY KEY,
  owner_id        text NOT NULL,
  bucket          text NOT NULL DEFAULT 'gh-media',
  storage_path    text NOT NULL,
  media_kind      text NOT NULL
                  CHECK (media_kind IN ('image', 'video', 'file')),
  mime_type       text NOT NULL,
  byte_size       bigint NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  width           integer,
  height          integer,
  duration_ms     integer,
  status          text NOT NULL DEFAULT 'ready'
                  CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  public_url      text,
  thumb_path      text,
  thumb_url       text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT gh_media_owner_nonempty CHECK (length(trim(owner_id)) > 0),
  CONSTRAINT gh_media_path_nonempty CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT gh_media_path_owned CHECK (storage_path LIKE owner_id || '/%')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_media_bucket_path
  ON public.gh_media_assets (bucket, storage_path);

CREATE INDEX IF NOT EXISTS idx_gh_media_owner_created
  ON public.gh_media_assets (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_media_status
  ON public.gh_media_assets (status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.gh_media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_media_assets_no_client ON public.gh_media_assets;
CREATE POLICY gh_media_assets_no_client ON public.gh_media_assets
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_media_assets IS
  'Durable media references. Owner is session-derived. Path must be under owner_id/. No economy fields.';

/**
 * Insert a media asset. owner_id and storage_path must align.
 */
CREATE OR REPLACE FUNCTION public.gh_media_asset_create(
  p_id text,
  p_owner_id text,
  p_bucket text,
  p_storage_path text,
  p_media_kind text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL,
  p_public_url text DEFAULT NULL,
  p_thumb_path text DEFAULT NULL,
  p_thumb_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := lower(trim(COALESCE(p_media_kind, '')));
  v_path text := trim(COALESCE(p_storage_path, ''));
  v_owner text := trim(COALESCE(p_owner_id, ''));
BEGIN
  IF v_owner = '' OR p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED_FIELDS');
  END IF;
  IF v_kind NOT IN ('image', 'video', 'file') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_KIND');
  END IF;
  IF v_path = '' OR position(v_owner || '/' in v_path) <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PATH_OWNERSHIP');
  END IF;
  IF COALESCE(p_byte_size, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SIZE');
  END IF;

  INSERT INTO public.gh_media_assets (
    id, owner_id, bucket, storage_path, media_kind, mime_type, byte_size,
    width, height, duration_ms, status, public_url, thumb_path, thumb_url, metadata
  ) VALUES (
    trim(p_id),
    v_owner,
    COALESCE(NULLIF(trim(p_bucket), ''), 'gh-media'),
    v_path,
    v_kind,
    COALESCE(NULLIF(trim(p_mime_type), ''), 'application/octet-stream'),
    COALESCE(p_byte_size, 0),
    p_width,
    p_height,
    p_duration_ms,
    'ready',
    NULLIF(trim(COALESCE(p_public_url, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_path, '')), ''),
    NULLIF(trim(COALESCE(p_thumb_url, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_id),
    'ownerId', v_owner,
    'path', v_path
  );
END;
$$;

/**
 * Resolve media assets owned by actor (or public_url only for ready assets by id list).
 * Callers must only request IDs they are allowed to attach; ownership enforced for private use.
 */
CREATE OR REPLACE FUNCTION public.gh_media_assets_resolve(
  p_actor_id text,
  p_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'ownerId', m.owner_id,
    'kind', m.media_kind,
    'mime', m.mime_type,
    'url', COALESCE(m.public_url, ''),
    'thumbUrl', COALESCE(m.thumb_url, ''),
    'width', m.width,
    'height', m.height,
    'status', m.status,
    'owned', (m.owner_id = trim(p_actor_id))
  ) ORDER BY m.created_at), '[]'::jsonb)
  INTO v_rows
  FROM public.gh_media_assets m
  WHERE m.deleted_at IS NULL
    AND m.status = 'ready'
    AND m.id = ANY (COALESCE(p_ids, ARRAY[]::text[]))
    AND (
      m.owner_id = trim(p_actor_id)
      OR (m.public_url IS NOT NULL AND length(m.public_url) > 0)
    );

  RETURN jsonb_build_object('ok', true, 'assets', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_media_asset_create(text, text, text, text, text, text, bigint, integer, integer, integer, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.gh_media_assets_resolve(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_media_assets_resolve(text, text[]) TO service_role;

-- ============================================================================
-- SOURCE 050: 20261022010050_gh_follow_status.sql
-- SHA256: 42bd7e23422f08860c63347ad66af689cd55b95153ded3926f662b3a27340df8
-- ============================================================================
-- Phase 10: compact follow status + counts (additive).
-- Does not alter gh_follows schema. Session actor must be passed by server only.

CREATE OR REPLACE FUNCTION public.gh_follow_status(
  p_actor_id text,
  p_target_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_following boolean := false;
  v_followers_count integer := 0;
  v_following_count integer := 0;
  v_blocked boolean := false;
BEGIN
  IF p_target_id IS NULL OR length(trim(p_target_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TARGET_REQUIRED');
  END IF;

  IF p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = trim(p_actor_id) AND b.blocked_id = trim(p_target_id))
         OR (b.blocker_id = trim(p_target_id) AND b.blocked_id = trim(p_actor_id))
    ) INTO v_blocked;

    IF NOT v_blocked THEN
      SELECT EXISTS (
        SELECT 1 FROM public.gh_follows f
        WHERE f.follower_id = trim(p_actor_id)
          AND f.following_id = trim(p_target_id)
      ) INTO v_following;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_followers_count
  FROM public.gh_follows WHERE following_id = trim(p_target_id);

  SELECT COUNT(*)::integer INTO v_following_count
  FROM public.gh_follows WHERE follower_id = trim(p_target_id);

  RETURN jsonb_build_object(
    'ok', true,
    'targetUserId', trim(p_target_id),
    'isFollowing', v_following,
    'blocked', v_blocked,
    'followersCount', v_followers_count,
    'followingCount', v_following_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_follow_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_follow_status(text, text) TO service_role;

-- ============================================================================
-- SOURCE 051: 20261022010051_gh_social_notifications.sql
-- SHA256: c1bbd82257c0ee767d6fab91c43b5b4f66bb8f58a5225f8363534c93f7e3bad0
-- ============================================================================
-- Phase 11: durable social notifications (informational only — no economy fields).

CREATE TABLE IF NOT EXISTS public.gh_social_notifications (
  id                text PRIMARY KEY,
  recipient_user_id text NOT NULL,
  actor_user_id     text,
  notification_type text NOT NULL
                    CHECK (notification_type IN (
                      'follow',
                      'post_like',
                      'post_comment',
                      'comment_reply',
                      'curation',
                      'mention'
                    )),
  entity_type       text NOT NULL DEFAULT 'none'
                    CHECK (entity_type IN ('none', 'user', 'post', 'comment')),
  entity_id         text,
  title             text NOT NULL DEFAULT '',
  body              text NOT NULL DEFAULT '',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key        text NOT NULL,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_social_notif_recipient_nonempty CHECK (length(trim(recipient_user_id)) > 0),
  CONSTRAINT gh_social_notif_dedupe_nonempty CHECK (length(trim(dedupe_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_social_notifications_dedupe
  ON public.gh_social_notifications (recipient_user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_gh_social_notifications_recipient_created
  ON public.gh_social_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gh_social_notifications_recipient_unread
  ON public.gh_social_notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.gh_social_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_social_notifications_no_client ON public.gh_social_notifications;
CREATE POLICY gh_social_notifications_no_client ON public.gh_social_notifications
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_social_notifications IS
  'In-app social activity only. No GHC/Pi/ledger columns. Writes via service_role RPC.';

CREATE OR REPLACE FUNCTION public.gh_social_notification_create(
  p_recipient_id text,
  p_actor_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_type text := lower(trim(COALESCE(p_type, '')));
  v_entity text := lower(trim(COALESCE(p_entity_type, 'none')));
  v_recipient text := trim(COALESCE(p_recipient_id, ''));
  v_actor text := NULLIF(trim(COALESCE(p_actor_id, '')), '');
  v_dedupe text := trim(COALESCE(p_dedupe_key, ''));
  v_existing text;
BEGIN
  IF v_recipient = '' OR v_dedupe = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_actor IS NOT NULL AND v_actor = v_recipient THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN ('follow', 'post_like', 'post_comment', 'comment_reply', 'curation', 'mention') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;

  -- Block either direction → no notification
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;

  SELECT id INTO v_existing
  FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;

  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id,
    v_recipient,
    v_actor,
    v_type,
    v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_dedupe
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_list(
  p_recipient_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_unread_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      n.id,
      n.recipient_user_id AS "recipientUserId",
      n.actor_user_id AS "actorUserId",
      n.notification_type AS "type",
      n.entity_type AS "entityType",
      n.entity_id AS "entityId",
      n.title,
      n.body,
      n.metadata,
      n.read_at AS "readAt",
      (extract(epoch from n.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_social_notifications n
    WHERE n.recipient_user_id = trim(p_recipient_id)
      AND (NOT p_unread_only OR n.read_at IS NULL)
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from n.created_at) * 1000)::bigint < p_before_ms
      )
    ORDER BY n.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'notifications', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_unread_count(p_recipient_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;
  SELECT COUNT(*)::integer INTO v_count
  FROM public.gh_social_notifications
  WHERE recipient_user_id = trim(p_recipient_id) AND read_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'unreadCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notifications_mark_read(
  p_recipient_id text,
  p_ids text[] DEFAULT NULL,
  p_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_recipient_id IS NULL OR length(trim(p_recipient_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RECIPIENT_REQUIRED');
  END IF;

  IF p_all THEN
    UPDATE public.gh_social_notifications
    SET read_at = now()
    WHERE recipient_user_id = trim(p_recipient_id) AND read_at IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_ids IS NOT NULL AND array_length(p_ids, 1) > 0 THEN
    UPDATE public.gh_social_notifications
    SET read_at = now()
    WHERE recipient_user_id = trim(p_recipient_id)
      AND read_at IS NULL
      AND id = ANY (p_ids);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_unread_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_unread_count(text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean) TO service_role;

-- ============================================================================
-- SOURCE 052: 20261022010052_gh_search.sql
-- SHA256: 0ebee488460048a0aeb524d878d964bb99dd3db5749f76343975b56762ee4086
-- ============================================================================
-- Phase 12: server-authoritative discovery search (no ranking scores, no economy).
-- Parameterized ILIKE only. Visibility + blocks enforced in RPCs.

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_display_name_trgm
  ON public.gh_user_profiles (lower(display_name));

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_username_trgm
  ON public.gh_user_profiles (lower(username));

CREATE INDEX IF NOT EXISTS idx_gh_posts_content_created
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL;

/**
 * People search — public profile fields only.
 */
CREATE OR REPLACE FUNCTION public.gh_search_people(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'people', '[]'::jsonb);
  END IF;
  -- Escape LIKE wildcards from user input
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.gh_user_id AS "userId",
      COALESCE(p.display_name, '') AS "displayName",
      COALESCE(p.username, '') AS "username",
      COALESCE(p.bio, '') AS "bio",
      CASE
        WHEN jsonb_typeof(p.photos) = 'array' AND jsonb_array_length(p.photos) > 0
          THEN p.photos->>0
        ELSE ''
      END AS "avatarUrl",
      EXISTS (
        SELECT 1 FROM public.gh_follows f
        WHERE f.follower_id = trim(COALESCE(p_actor_id, ''))
          AND f.following_id = p.gh_user_id
      ) AS "isFollowing"
    FROM public.gh_user_profiles p
    WHERE p.onboarded IS TRUE
      AND p.gh_user_id IS NOT NULL
      AND (
        lower(COALESCE(p.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(p.username, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND (
        p_actor_id IS NULL OR length(trim(p_actor_id)) = 0
        OR p.gh_user_id <> trim(p_actor_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = p.gh_user_id)
            OR (b.blocker_id = p.gh_user_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'people', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

/**
 * Post search — public + visible-to-actor only, non-deleted.
 */
CREATE OR REPLACE FUNCTION public.gh_search_posts(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20,
  p_video_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'posts', '[]'::jsonb);
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      left(p.content, 280) AS "content",
      p.video,
      p.content_type AS "contentType",
      (extract(epoch from p.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        lower(p.content) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(p.author_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND (
        NOT p_video_only
        OR (p.video IS NOT NULL AND length(trim(p.video)) > 0 AND p.video NOT LIKE 'blob:%')
      )
      AND (
        p.visibility = 'public'
        OR p.author_id = trim(COALESCE(p_actor_id, ''))
        OR (
          p.visibility = 'followers'
          AND p_actor_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = trim(p_actor_id) AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = p.author_id)
            OR (b.blocker_id = p.author_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

/**
 * Creator directory search — discoverable creators only.
 */
CREATE OR REPLACE FUNCTION public.gh_search_creators(
  p_actor_id text,
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_rows jsonb;
BEGIN
  IF length(v_q) < 2 OR length(v_q) > 80 THEN
    RETURN jsonb_build_object('ok', true, 'creators', '[]'::jsonb);
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.user_id AS "userId",
      COALESCE(c.display_name, up.display_name, '') AS "displayName",
      COALESCE(c.bio, up.bio, '') AS "bio",
      c.tips_enabled AS "tipsEnabled"
    FROM public.gh_creator_profiles c
    LEFT JOIN public.gh_user_profiles up ON up.gh_user_id = c.user_id
    WHERE c.is_enabled IS TRUE
      AND (
        lower(COALESCE(c.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(c.bio, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(up.display_name, '')) LIKE '%' || v_q || '%' ESCAPE '\'
        OR lower(COALESCE(up.username, '')) LIKE '%' || v_q || '%' ESCAPE '\'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE p_actor_id IS NOT NULL AND length(trim(p_actor_id)) > 0
          AND (
            (b.blocker_id = trim(p_actor_id) AND b.blocked_id = c.user_id)
            OR (b.blocker_id = c.user_id AND b.blocked_id = trim(p_actor_id))
          )
      )
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'creators', COALESCE(v_rows, '[]'::jsonb));
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', true, 'creators', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_search_people(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_people(text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.gh_search_posts(text, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_posts(text, text, integer, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.gh_search_creators(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_search_creators(text, text, integer) TO service_role;

-- ============================================================================
-- SOURCE 053: 20261022010053_gh_post_shares.sql
-- SHA256: c9f86bcb5612199a39426084c803d2676890b6f230104882ccc48e0e805d853f
-- ============================================================================
-- Phase 13: durable share/repost relationship (metadata only — not a second post store).

CREATE TABLE IF NOT EXISTS public.gh_post_shares (
  id              text PRIMARY KEY,
  post_id         text NOT NULL,
  sharer_id       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_post_shares_post_nonempty CHECK (length(trim(post_id)) > 0),
  CONSTRAINT gh_post_shares_sharer_nonempty CHECK (length(trim(sharer_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_post_shares_user_post
  ON public.gh_post_shares (sharer_id, post_id);

CREATE INDEX IF NOT EXISTS idx_gh_post_shares_post_created
  ON public.gh_post_shares (post_id, created_at DESC);

ALTER TABLE public.gh_post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_shares_no_client ON public.gh_post_shares;
CREATE POLICY gh_post_shares_no_client ON public.gh_post_shares
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_post_shares IS
  'Share/repost edges only. Original content remains on gh_posts. No media copies.';

CREATE OR REPLACE FUNCTION public.gh_post_share(
  p_sharer_id text,
  p_post_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
  v_id text;
  v_count integer;
BEGIN
  IF p_sharer_id IS NULL OR length(trim(p_sharer_id)) = 0 OR p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts WHERE id = trim(p_post_id);

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_sharer_id) AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = trim(p_sharer_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;

  v_id := 'share_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.gh_post_shares (id, post_id, sharer_id)
  VALUES (v_id, trim(p_post_id), trim(p_sharer_id))
  ON CONFLICT (sharer_id, post_id) DO NOTHING;

  UPDATE public.gh_posts
  SET share_count = (
    SELECT COUNT(*)::integer FROM public.gh_post_shares WHERE post_id = trim(p_post_id)
  )
  WHERE id = trim(p_post_id);

  SELECT share_count INTO v_count FROM public.gh_posts WHERE id = trim(p_post_id);

  RETURN jsonb_build_object(
    'ok', true,
    'shareId', v_id,
    'postId', trim(p_post_id),
    'authorId', v_author,
    'shareCount', COALESCE(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_share(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_share(text, text) TO service_role;

-- ============================================================================
-- SOURCE 054: 20261022010054_gh_notif_share_type.sql
-- SHA256: cce44e1f98451cb16ea4a3a8c7339f89f34c56f99de729e334885b5aab93fa37
-- ============================================================================
-- Allow share notification type (additive constraint refresh).
ALTER TABLE public.gh_social_notifications DROP CONSTRAINT IF EXISTS gh_social_notifications_notification_type_check;
ALTER TABLE public.gh_social_notifications ADD CONSTRAINT gh_social_notifications_notification_type_check
  CHECK (notification_type IN (
    'follow', 'post_like', 'post_comment', 'comment_reply', 'curation', 'mention', 'share'
  ));

CREATE OR REPLACE FUNCTION public.gh_social_notification_create(
  p_recipient_id text,
  p_actor_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_type text := lower(trim(COALESCE(p_type, '')));
  v_entity text := lower(trim(COALESCE(p_entity_type, 'none')));
  v_recipient text := trim(COALESCE(p_recipient_id, ''));
  v_actor text := NULLIF(trim(COALESCE(p_actor_id, '')), '');
  v_dedupe text := trim(COALESCE(p_dedupe_key, ''));
  v_existing text;
BEGIN
  IF v_recipient = '' OR v_dedupe = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_actor IS NOT NULL AND v_actor = v_recipient THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN ('follow', 'post_like', 'post_comment', 'comment_reply', 'curation', 'mention', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;
  SELECT id INTO v_existing FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;
  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id, v_recipient, v_actor, v_type, v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_dedupe
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

-- ============================================================================
-- SOURCE 055: 20261022010055_gh_messaging_edit_pin_prefs.sql
-- SHA256: 5547ba3d0e4647a3884d36d3296fb92dd7cf0c2a49e9470344eabe7a40701746
-- ============================================================================
-- Migration 55 — Message edit/pin + per-user conversation preferences
-- Additive only. Does not modify economy / payment tables.
-- Service-role writes; RLS denies direct client access (matches existing messaging pattern).

-- ---------------------------------------------------------------------------
-- Message pin flag (conversation-scoped; only members may pin via server API)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gh_messages_pinned
  ON public.gh_messages (conversation_id, is_pinned)
  WHERE is_pinned = true AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Per-user conversation preferences (pin / archive are personal, not global)
-- muted_until already exists on gh_conversation_members; extend with prefs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE public.gh_conversation_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user_pinned
  ON public.gh_conversation_members (gh_user_id, is_pinned)
  WHERE left_at IS NULL AND is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_gh_conversation_members_user_archived
  ON public.gh_conversation_members (gh_user_id, is_archived)
  WHERE left_at IS NULL AND is_archived = true;

-- ---------------------------------------------------------------------------
-- RPC: edit own message (sender only, not deleted, body length bound)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_edit_message(
  p_message_id text,
  p_actor_id text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gh_messages%ROWTYPE;
  v_body text;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  v_body := left(trim(COALESCE(p_body, '')), 8000);
  IF length(v_body) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMPTY_BODY');
  END IF;

  SELECT * INTO v_row FROM public.gh_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;
  IF v_row.sender_id IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = v_row.conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_messages
  SET body = v_body,
      edited_at = now()
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', p_message_id,
    'body', v_body,
    'edited_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_edit_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_edit_message(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: pin / unpin message (member of conversation only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_pin_message(
  p_message_id text,
  p_actor_id text,
  p_pinned boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gh_messages%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_row FROM public.gh_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND OR v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = v_row.conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_messages
  SET is_pinned = COALESCE(p_pinned, false)
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', p_message_id,
    'is_pinned', COALESCE(p_pinned, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pin_message(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_pin_message(text, text, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: set personal conversation prefs (pin / archive / mute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_set_conversation_prefs(
  p_conversation_id text,
  p_actor_id text,
  p_is_pinned boolean DEFAULT NULL,
  p_is_archived boolean DEFAULT NULL,
  p_muted_until timestamptz DEFAULT NULL,
  p_clear_mute boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.gh_user_id = p_actor_id
      AND m.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_conversation_members
  SET
    is_pinned = COALESCE(p_is_pinned, is_pinned),
    is_archived = COALESCE(p_is_archived, is_archived),
    muted_until = CASE
      WHEN p_clear_mute THEN NULL
      WHEN p_muted_until IS NOT NULL THEN p_muted_until
      ELSE muted_until
    END
  WHERE conversation_id = p_conversation_id
    AND gh_user_id = p_actor_id
    AND left_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'conversation_id', p_conversation_id,
    'is_pinned', (SELECT is_pinned FROM public.gh_conversation_members
                  WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id),
    'is_archived', (SELECT is_archived FROM public.gh_conversation_members
                    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id),
    'muted_until', (SELECT muted_until FROM public.gh_conversation_members
                    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_set_conversation_prefs(text, text, boolean, boolean, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_set_conversation_prefs(text, text, boolean, boolean, timestamptz, boolean) TO service_role;

-- ============================================================================
-- SOURCE 056: 20261022010056_gh_post_archive_quote.sql
-- SHA256: 0f15d247369a5648f3bcd701a2539142de06cc832805e21aa767600ec087f2e9
-- ============================================================================
-- Migration 56 — Durable post archive + quote-repost reference
-- Additive only. Does not modify economy / payment tables.
-- Soft-delete remains deleted_at; archive is a distinct non-destructive state.

-- ---------------------------------------------------------------------------
-- Archive (owner-only via server API; distinct from soft-delete)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gh_posts_author_archived
  ON public.gh_posts (author_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- Exclude archived from public feed index usage (new partial for active feed)
CREATE INDEX IF NOT EXISTS idx_gh_posts_feed_active
  ON public.gh_posts (created_at DESC)
  WHERE deleted_at IS NULL
    AND archived_at IS NULL
    AND visibility = 'public';

-- ---------------------------------------------------------------------------
-- Quote repost: reference original post by id (do not duplicate authoritative body)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gh_posts
  ADD COLUMN IF NOT EXISTS quote_of_post_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gh_posts_quote_of_fk'
  ) THEN
    ALTER TABLE public.gh_posts
      ADD CONSTRAINT gh_posts_quote_of_fk
      FOREIGN KEY (quote_of_post_id) REFERENCES public.gh_posts(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    -- If constraint cannot be added (legacy rows), leave column without FK
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_gh_posts_quote_of
  ON public.gh_posts (quote_of_post_id)
  WHERE quote_of_post_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- RPC: archive / unarchive own post
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_set_post_archived(
  p_post_id text,
  p_actor_id text,
  p_archived boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts WHERE id = p_post_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DELETED');
  END IF;
  IF v_author IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.gh_posts
  SET archived_at = CASE WHEN COALESCE(p_archived, false) THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'ok', true,
    'post_id', p_post_id,
    'archived', COALESCE(p_archived, false),
    'archived_at', (SELECT archived_at FROM public.gh_posts WHERE id = p_post_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_set_post_archived(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_set_post_archived(text, text, boolean) TO service_role;

-- ============================================================================
-- SOURCE 057: 20261022010057_ghc_balance_lock_and_spendable.sql
-- SHA256: 999aee10e765c5e8b3d3ee673c3cb983a5816c085eb6e1bdeabcd4f5d4c0101e
-- ============================================================================
-- =============================================================================
-- 20261022010057_ghc_balance_lock_and_spendable.sql
-- Shared per-user balance serialization + withdrawal-aware spendable check.
-- Forward-only. Does not rewrite ledger history.
--
-- Problem:
--   ghc_execute_transfer locked ghc_send:{user}
--   ghc_execute_spend locked ghc_spend:{user}
--   ghc_withdrawal_create locked ghc_withdraw:{user}
--   Spend used ghc_available_balance without subtracting pending withdrawal locks.
-- Cross-domain races could authorize the same GHC twice.
--
-- Fix:
--   1) Shared advisory lock namespace: ghc_balance:{userId}
--   2) ghc_spendable_balance = posted ledger - pending withdrawal locks
--   3) Transfer, spend, withdrawal create all acquire ghc_balance lock
--   4) Spend and transfer debit checks use spendable (transfer: ledger available
--      is still correct for dual-entry; spend subtracts withdrawal locks)
-- =============================================================================

-- Spendable = posted ledger balance minus GHC reserved by open withdrawals
CREATE OR REPLACE FUNCTION public.ghc_spendable_balance(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE(public.ghc_available_balance(p_user_id), 0)
      - COALESCE(public.ghc_withdrawal_locked_ghc(p_user_id), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.ghc_spendable_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_spendable_balance(text) TO service_role;

COMMENT ON FUNCTION public.ghc_spendable_balance(text) IS
  'Posted ledger balance minus pending withdrawal reservations; used by spend/transfer authorization.';

-- ---------------------------------------------------------------------------
-- Spend: shared balance lock + withdrawal-aware available check
-- Signature preserved from 202609080001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_execute_spend(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT NULL,
  p_source_event text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := abs(coalesce(p_amount, 0));
  v_signed numeric;
  v_avail numeric;
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF v_amount <> round(v_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION');
  END IF;

  -- Shared balance serialization (transfer / spend / withdrawal)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
    IF abs(v_existing.amount) <> v_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'message', 'referenceId already used with a different amount'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'transactionId', v_existing.id,
      'referenceId', p_reference_id,
      'amount', abs(v_existing.amount)
    );
  END IF;

  -- Must not spend GHC reserved for pending withdrawals
  v_avail := public.ghc_spendable_balance(p_user_id);
  IF v_avail < v_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE', 'available', v_avail);
  END IF;

  v_signed := -v_amount;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id, 'spent', v_signed, 'posted', coalesce(p_reason, 'Purchase'),
    coalesce(p_source_event, 'SPEND'), p_reference_id, v_now, v_now
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'transactionId', v_tx_id,
    'referenceId', p_reference_id,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Transfer: shared balance lock on sender (single-user debit serialization)
-- Signature preserved from 20260821
-- ---------------------------------------------------------------------------
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

  -- Shared balance lock (same namespace as spend/withdrawal)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_sender_id));

  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_sender_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_sender_id AND blocked_id = p_to_user_id)
       OR (blocker_id = p_to_user_id AND blocked_id = p_sender_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Transfers not allowed');
  END IF;

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

  -- Spendable: do not transfer GHC reserved for pending withdrawals
  v_available := public.ghc_spendable_balance(p_sender_id);
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
      'amount', -p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    ),
    'creditTx', jsonb_build_object(
      'id', v_credit_id, 'userId', p_to_user_id, 'kind', 'transfer_in',
      'amount', p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Withdrawal create: shared balance lock (same namespace)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ghc_withdrawal_create(
  p_user_id text,
  p_ghc_amount numeric,
  p_ghc_per_pi numeric,
  p_pi_wallet text,
  p_idempotency_key text,
  p_min_pi numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_locked numeric;
  v_withdrawable numeric;
  v_pi numeric;
  v_id text;
  v_existing public.ghc_withdrawal_requests%ROWTYPE;
  v_wallet text := trim(COALESCE(p_pi_wallet, ''));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;
  IF p_ghc_amount IS NULL OR p_ghc_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_ghc_per_pi IS NULL OR p_ghc_per_pi <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RATE');
  END IF;
  IF length(v_wallet) < 8 OR length(v_wallet) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WALLET');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  -- Shared with spend/transfer
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_user_id));

  SELECT * INTO v_existing
  FROM public.ghc_withdrawal_requests
  WHERE user_id = p_user_id AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'request', to_jsonb(v_existing)
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.ghc_transactions
  WHERE user_id = p_user_id AND status = 'posted';

  v_locked := public.ghc_withdrawal_locked_ghc(p_user_id);
  v_withdrawable := v_balance - v_locked;
  IF v_withdrawable < p_ghc_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_WITHDRAWABLE',
      'balance', v_balance,
      'locked', v_locked,
      'withdrawable', v_withdrawable
    );
  END IF;

  v_pi := round((p_ghc_amount / p_ghc_per_pi)::numeric, 8);
  IF v_pi < COALESCE(p_min_pi, 100) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'BELOW_MINIMUM_PI',
      'piAmount', v_pi,
      'minPi', COALESCE(p_min_pi, 100)
    );
  END IF;

  v_id := 'wd_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.ghc_withdrawal_requests (
    id, user_id, ghc_amount, ghc_per_pi, pi_amount, min_pi_threshold,
    pi_wallet_address, status, idempotency_key
  ) VALUES (
    v_id, p_user_id, p_ghc_amount, p_ghc_per_pi, v_pi, COALESCE(p_min_pi, 100),
    v_wallet, 'requested', trim(p_idempotency_key)
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'request', to_jsonb(v_existing),
    'balance', v_balance,
    'locked', v_locked + p_ghc_amount,
    'withdrawable', v_withdrawable - p_ghc_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_create(text, numeric, numeric, text, text, numeric) TO service_role;

COMMENT ON FUNCTION public.ghc_execute_spend IS
  'Spend debit; ghc_balance advisory lock; spendable excludes pending withdrawal locks; idempotent reference.';
COMMENT ON FUNCTION public.ghc_execute_transfer IS
  'Dual-entry transfer; ghc_balance lock on sender; spendable excludes pending withdrawal locks.';

-- ============================================================================
-- SOURCE 058: 20261022010058_ghc_withdrawal_settle_atomic.sql
-- SHA256: fbef6cfdab6858edc2ba56c875603958aaa89a3e3d824675df58c4cb352abe1c
-- ============================================================================
-- =============================================================================
-- 20261022010058_ghc_withdrawal_settle_atomic.sql
-- Atomic withdrawal settlement: debit + complete in one transaction.
--
-- Fixes P1.4A: ordinary ghc_execute_spend uses ghc_spendable_balance which
-- subtracts ALL active locks including status=processing. Settlement could not
-- consume its own reservation.
--
-- This RPC:
--   - locks ghc_balance:{userId}
--   - FOR UPDATE the withdrawal row
--   - excludes ONLY this withdrawal from the reservation sum
--   - posts one debit with reference withdrawal_settle:{id}
--   - sets status=completed in the same transaction
-- Ordinary ghc_execute_spend / ghc_spendable_balance are UNCHANGED.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ghc_withdrawal_settle(
  p_id text,
  p_operator_id text,
  p_settlement_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_withdrawal_requests%ROWTYPE;
  v_ledger numeric;
  v_locked_others numeric;
  v_settle_avail numeric;
  v_amount numeric;
  v_ref text;
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF p_operator_id IS NULL OR length(trim(p_operator_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OPERATOR_REQUIRED');
  END IF;
  IF p_settlement_ref IS NULL OR length(trim(p_settlement_ref)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SETTLEMENT_REF_REQUIRED');
  END IF;

  -- Lock withdrawal row first (stable order: row then balance key is fine for single-user settle)
  SELECT * INTO v_row
  FROM public.ghc_withdrawal_requests
  WHERE id = trim(p_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  v_amount := v_row.ghc_amount;
  v_ref := 'withdrawal_settle:' || v_row.id;

  -- Shared balance serialization with spend/transfer/withdrawal-create
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || v_row.user_id));

  -- Idempotent: already completed
  IF v_row.status = 'completed' THEN
    SELECT * INTO v_existing
    FROM public.ghc_transactions
    WHERE user_id = v_row.user_id
      AND reference_id = v_ref
      AND kind IN ('spent', 'purchased')
      AND status = 'posted'
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'request', to_jsonb(v_row),
        'transactionId', v_existing.id,
        'referenceId', v_ref
      );
    END IF;
    -- Completed without ledger row is inconsistent; do not invent a second debit path here
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'COMPLETED_WITHOUT_DEBIT',
      'request', to_jsonb(v_row)
    );
  END IF;

  IF v_row.status IN ('rejected', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATE', 'request', to_jsonb(v_row));
  END IF;

  IF v_row.status NOT IN ('requested', 'under_review', 'approved', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'request', to_jsonb(v_row));
  END IF;

  -- Existing debit for this settle ref (retry after partial failure)
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = v_row.user_id
    AND reference_id = v_ref
    AND kind IN ('spent', 'purchased')
    AND status = 'posted'
  LIMIT 1;

  IF FOUND THEN
    IF abs(v_existing.amount) <> v_amount THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'message', 'settlement reference exists with different amount'
      );
    END IF;
    -- Debit exists; complete withdrawal in this transaction
    UPDATE public.ghc_withdrawal_requests
    SET
      status = 'completed',
      operator_id = trim(p_operator_id),
      settlement_ref = trim(p_settlement_ref),
      updated_at = v_now,
      completed_at = COALESCE(completed_at, v_now)
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'request', to_jsonb(v_row),
      'transactionId', v_existing.id,
      'referenceId', v_ref
    );
  END IF;

  v_ledger := public.ghc_available_balance(v_row.user_id);

  -- Exclude ONLY this withdrawal from active locks
  SELECT COALESCE(SUM(ghc_amount), 0) INTO v_locked_others
  FROM public.ghc_withdrawal_requests
  WHERE user_id = v_row.user_id
    AND status IN ('requested', 'under_review', 'approved', 'processing')
    AND id <> v_row.id;

  v_settle_avail := v_ledger - COALESCE(v_locked_others, 0);
  IF v_settle_avail < v_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_BALANCE',
      'available', GREATEST(0, v_settle_avail),
      'ledger', v_ledger,
      'lockedOthers', v_locked_others,
      'amount', v_amount
    );
  END IF;

  -- Authoritative debit (negative amount, same convention as ghc_execute_spend)
  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    v_row.user_id,
    'spent',
    -v_amount,
    'posted',
    'GHC withdrawal settled to Pi',
    'WITHDRAWAL_SETTLE',
    v_ref,
    v_now,
    v_now
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.ghc_withdrawal_requests
  SET
    status = 'completed',
    operator_id = trim(p_operator_id),
    settlement_ref = trim(p_settlement_ref),
    updated_at = v_now,
    completed_at = v_now
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'request', to_jsonb(v_row),
    'transactionId', v_tx_id,
    'referenceId', v_ref,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_withdrawal_settle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_withdrawal_settle(text, text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_withdrawal_settle(text, text, text) IS
  'Atomic withdrawal settlement: ghc_balance lock; exclude only this reservation; one debit; completed in same txn.';

-- ============================================================================
-- SOURCE 059: 20261022010059_ghc_activity_stage_atomic.sql
-- SHA256: 36975e301aa16bb9e4b500633e4c56440900325cf0048ffd7e7196f5b73014c9
-- ============================================================================
-- =============================================================================
-- 20261022010059_ghc_activity_stage_atomic.sql
-- Atomic activity emission grant + pending stage (single transaction).
--
-- Closes P1.5A.1 gap: sequential try_grant then ghc_stage_pending could leave
-- emission capacity consumed when stage failed (DAILY_CAP/COOLDOWN/TARGET_CAP/etc).
--
-- Does NOT replace ghc_stage_pending or ghc_activity_try_grant (callers preserved).
-- SECURITY DEFINER; service_role only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ghc_activity_stage_reward(
  p_user_id text,
  p_base_amount numeric,
  p_day_key text,
  p_week_key text,
  p_daily_cap numeric,
  p_weekly_cap numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL,
  p_daily_limit integer DEFAULT NULL,
  p_cooldown_ms bigint DEFAULT NULL,
  p_max_per_target integer DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_stage_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric := abs(coalesce(p_base_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event text := upper(trim(coalesce(p_source_event, 'SYSTEM')));
  v_target text := nullif(trim(coalesce(p_target_id, '')), '');
  v_day numeric := 0;
  v_week numeric := 0;
  v_room numeric := 0;
  v_grant numeric := 0;
  v_stage numeric := 0;
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
  v_day_key text;
  v_day_count integer := 0;
  v_target_count integer := 0;
  v_last_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_base <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_day_key IS NULL OR length(trim(p_day_key)) = 0
     OR p_week_key IS NULL OR length(trim(p_week_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  -- Serialize stage + emission for this user (same domain family as stage)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_activity:' || p_user_id));

  v_day_key := to_char((v_now AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD');

  -- Already posted earned for this reference → idempotent (no new emission)
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'earned'
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', true,
      'holdId', v_posted.id,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'status', 'posted',
      'granted', 0,
      'emissionConsumed', 0
    );
  END IF;

  -- Existing pending for same reference → idempotent (no new emission)
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'status', 'pending',
      'granted', 0,
      'emissionConsumed', 0,
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'referenceId', v_existing.reference_id,
        'sourceEvent', v_existing.source_event
      )
    );
  END IF;

  -- Cooldown
  IF p_cooldown_ms IS NOT NULL AND p_cooldown_ms > 0 THEN
    SELECT max(created_at) INTO v_last_at
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned');

    IF v_last_at IS NOT NULL
       AND (extract(epoch from (v_now - v_last_at)) * 1000) < p_cooldown_ms THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'COOLDOWN',
        'cooldownMs', p_cooldown_ms,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Daily limit
  IF p_daily_limit IS NOT NULL AND p_daily_limit >= 0 THEN
    SELECT count(*)::integer INTO v_day_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key;

    IF v_day_count >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'DAILY_CAP',
        'dailyLimit', p_daily_limit,
        'dayCount', v_day_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Target cap
  IF p_max_per_target IS NOT NULL AND p_max_per_target >= 0 AND v_target IS NOT NULL THEN
    SELECT count(*)::integer INTO v_target_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key
      AND split_part(coalesce(reference_id, ''), ':', 3) = v_target;

    IF v_target_count >= p_max_per_target THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'TARGET_CAP',
        'maxPerTarget', p_max_per_target,
        'targetCount', v_target_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Emission windows (same semantics as ghc_activity_try_grant)
  SELECT coalesce(amount_ghc, 0) INTO v_day
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'day' AND window_key = p_day_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_day := 0;
  END IF;

  SELECT coalesce(amount_ghc, 0) INTO v_week
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'week' AND window_key = p_week_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_week := 0;
  END IF;

  v_room := least(
    greatest(0, coalesce(p_daily_cap, 0) - v_day),
    greatest(0, coalesce(p_weekly_cap, 0) - v_week)
  );

  IF v_room <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'dayRemaining', 0,
      'weekRemaining', 0,
      'emissionConsumed', 0
    );
  END IF;

  v_grant := least(v_base, v_room);
  IF v_grant <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'emissionConsumed', 0
    );
  END IF;

  -- Stage amount: optional post m×g amount, never above grant
  IF p_stage_amount IS NOT NULL AND p_stage_amount > 0 THEN
    v_stage := least(abs(p_stage_amount), v_grant);
  ELSE
    v_stage := v_grant;
  END IF;

  IF v_stage <> round(v_stage, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION', 'emissionConsumed', 0);
  END IF;

  -- Commit emission windows
  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'week', p_week_key, v_week + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  -- Stage pending reward
  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id,
    'pending',
    v_stage,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    v_event,
    v_ref,
    v_now,
    NULL
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_stage,
    'status', 'pending',
    'granted', v_grant,
    'baseGhc', v_grant,
    'emissionConsumed', v_grant,
    'dayRemaining', greatest(0, coalesce(p_daily_cap, 0) - (v_day + v_grant)),
    'weekRemaining', greatest(0, coalesce(p_weekly_cap, 0) - (v_week + v_grant)),
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_stage,
      'status', 'pending',
      'referenceId', v_ref,
      'sourceEvent', v_event
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) TO service_role;

COMMENT ON FUNCTION public.ghc_activity_stage_reward IS
  'Atomic activity emission grant + pending stage; failed limits consume zero emission.';

-- ============================================================================
-- SOURCE 060: 20261022010060_ghc_activity_stage_lock_align.sql
-- SHA256: fdebe14d56e1746438ce3fb411f35083c1ae7eae34d99dc12255c328516a746d
-- ============================================================================
-- =============================================================================
-- 20261022010060_ghc_activity_stage_lock_align.sql
-- Align activity advisory lock with ghc_activity_try_grant (ghc_act: namespace).
-- Replaces body of ghc_activity_stage_reward only; same signature and grants.
--
-- Closes P1.5A.1 gap: sequential try_grant then ghc_stage_pending could leave
-- emission capacity consumed when stage failed (DAILY_CAP/COOLDOWN/TARGET_CAP/etc).
--
-- Does NOT replace ghc_stage_pending or ghc_activity_try_grant (callers preserved).
-- SECURITY DEFINER; service_role only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ghc_activity_stage_reward(
  p_user_id text,
  p_base_amount numeric,
  p_day_key text,
  p_week_key text,
  p_daily_cap numeric,
  p_weekly_cap numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Reward',
  p_source_event text DEFAULT 'SYSTEM',
  p_rule_id text DEFAULT NULL,
  p_daily_limit integer DEFAULT NULL,
  p_cooldown_ms bigint DEFAULT NULL,
  p_max_per_target integer DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_stage_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric := abs(coalesce(p_base_amount, 0));
  v_ref text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_event text := upper(trim(coalesce(p_source_event, 'SYSTEM')));
  v_target text := nullif(trim(coalesce(p_target_id, '')), '');
  v_day numeric := 0;
  v_week numeric := 0;
  v_room numeric := 0;
  v_grant numeric := 0;
  v_stage numeric := 0;
  v_existing public.ghc_transactions%ROWTYPE;
  v_posted public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_now timestamptz := now();
  v_day_key text;
  v_day_count integer := 0;
  v_target_count integer := 0;
  v_last_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF v_base <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_day_key IS NULL OR length(trim(p_day_key)) = 0
     OR p_week_key IS NULL OR length(trim(p_week_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_WINDOW');
  END IF;

  -- Serialize stage + emission for this user (same domain family as stage)
  PERFORM pg_advisory_xact_lock(hashtext('ghc_stage:' || p_user_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_act:' || p_user_id));

  v_day_key := to_char((v_now AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD');

  -- Already posted earned for this reference → idempotent (no new emission)
  SELECT * INTO v_posted
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'earned'
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', true,
      'holdId', v_posted.id,
      'transactionId', v_posted.id,
      'amount', v_posted.amount,
      'status', 'posted',
      'granted', 0,
      'emissionConsumed', 0
    );
  END IF;

  -- Existing pending for same reference → idempotent (no new emission)
  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = v_ref
    AND kind = 'pending'
    AND status = 'pending'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyPosted', false,
      'holdId', v_existing.id,
      'transactionId', v_existing.id,
      'amount', v_existing.amount,
      'status', 'pending',
      'granted', 0,
      'emissionConsumed', 0,
      'tx', jsonb_build_object(
        'id', v_existing.id,
        'userId', v_existing.user_id,
        'kind', v_existing.kind,
        'amount', v_existing.amount,
        'status', v_existing.status,
        'referenceId', v_existing.reference_id,
        'sourceEvent', v_existing.source_event
      )
    );
  END IF;

  -- Cooldown
  IF p_cooldown_ms IS NOT NULL AND p_cooldown_ms > 0 THEN
    SELECT max(created_at) INTO v_last_at
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned');

    IF v_last_at IS NOT NULL
       AND (extract(epoch from (v_now - v_last_at)) * 1000) < p_cooldown_ms THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'COOLDOWN',
        'cooldownMs', p_cooldown_ms,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Daily limit
  IF p_daily_limit IS NOT NULL AND p_daily_limit >= 0 THEN
    SELECT count(*)::integer INTO v_day_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key;

    IF v_day_count >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'DAILY_CAP',
        'dailyLimit', p_daily_limit,
        'dayCount', v_day_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Target cap
  IF p_max_per_target IS NOT NULL AND p_max_per_target >= 0 AND v_target IS NOT NULL THEN
    SELECT count(*)::integer INTO v_target_count
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND upper(trim(source_event)) = v_event
      AND status NOT IN ('reversed', 'failed')
      AND amount > 0
      AND kind IN ('pending', 'earned')
      AND to_char((created_at AT TIME ZONE 'Africa/Lagos'), 'YYYY-MM-DD') = v_day_key
      AND split_part(coalesce(reference_id, ''), ':', 3) = v_target;

    IF v_target_count >= p_max_per_target THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'TARGET_CAP',
        'maxPerTarget', p_max_per_target,
        'targetCount', v_target_count,
        'emissionConsumed', 0
      );
    END IF;
  END IF;

  -- Emission windows (same semantics as ghc_activity_try_grant)
  SELECT coalesce(amount_ghc, 0) INTO v_day
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'day' AND window_key = p_day_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_day := 0;
  END IF;

  SELECT coalesce(amount_ghc, 0) INTO v_week
  FROM public.ghc_activity_emission_windows
  WHERE user_id = p_user_id AND window_type = 'week' AND window_key = p_week_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_week := 0;
  END IF;

  v_room := least(
    greatest(0, coalesce(p_daily_cap, 0) - v_day),
    greatest(0, coalesce(p_weekly_cap, 0) - v_week)
  );

  IF v_room <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'dayRemaining', 0,
      'weekRemaining', 0,
      'emissionConsumed', 0
    );
  END IF;

  v_grant := least(v_base, v_room);
  IF v_grant <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ACTIVITY_CAP_REACHED',
      'emissionConsumed', 0
    );
  END IF;

  -- Stage amount: optional post m×g amount, never above grant
  IF p_stage_amount IS NOT NULL AND p_stage_amount > 0 THEN
    v_stage := least(abs(p_stage_amount), v_grant);
  ELSE
    v_stage := v_grant;
  END IF;

  IF v_stage <> round(v_stage, 4) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_PRECISION', 'emissionConsumed', 0);
  END IF;

  -- Commit emission windows
  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'day', p_day_key, v_day + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  INSERT INTO public.ghc_activity_emission_windows (user_id, window_type, window_key, amount_ghc, updated_at)
  VALUES (p_user_id, 'week', p_week_key, v_week + v_grant, now())
  ON CONFLICT (user_id, window_type, window_key)
  DO UPDATE SET amount_ghc = EXCLUDED.amount_ghc, updated_at = now();

  -- Stage pending reward
  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, created_at, posted_at
  ) VALUES (
    p_user_id,
    'pending',
    v_stage,
    'pending',
    coalesce(nullif(trim(p_reason), ''), 'Reward'),
    v_event,
    v_ref,
    v_now,
    NULL
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'alreadyPosted', false,
    'holdId', v_tx_id,
    'transactionId', v_tx_id,
    'amount', v_stage,
    'status', 'pending',
    'granted', v_grant,
    'baseGhc', v_grant,
    'emissionConsumed', v_grant,
    'dayRemaining', greatest(0, coalesce(p_daily_cap, 0) - (v_day + v_grant)),
    'weekRemaining', greatest(0, coalesce(p_weekly_cap, 0) - (v_week + v_grant)),
    'tx', jsonb_build_object(
      'id', v_tx_id,
      'userId', p_user_id,
      'kind', 'pending',
      'amount', v_stage,
      'status', 'pending',
      'referenceId', v_ref,
      'sourceEvent', v_event
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_activity_stage_reward(
  text, numeric, text, text, numeric, numeric, text, text, text, text,
  integer, bigint, integer, text, numeric
) TO service_role;

COMMENT ON FUNCTION public.ghc_activity_stage_reward IS
  'Atomic stage+grant; activity lock uses ghc_act: to serialize with ghc_activity_try_grant.';

-- ============================================================================
-- SOURCE 061: 20261022010061_ghpv_judgment_infrastructure.sql
-- SHA256: f516e8779341682984fb0eeec102d26519c2f1eaab3224df88591c64d4170a3b
-- ============================================================================
-- =============================================================================
-- 20261022010061_ghpv_judgment_infrastructure.sql
-- GHPV-1: Judgment infrastructure (NO GHC mutation, NO vote-minting).
-- Extends curation/reputation foundations without changing financial RPCs.
-- SECURITY DEFINER RPCs granted to service_role only.
-- =============================================================================

-- Content-level quality state (server-maintained snapshot)
CREATE TABLE IF NOT EXISTS public.gh_content_quality_state (
  content_id        text PRIMARY KEY,
  content_kind      text NOT NULL DEFAULT 'post'
                    CHECK (content_kind IN ('post', 'comment', 'other')),
  judgment_mode     text NOT NULL DEFAULT 'useful'
                    CHECK (judgment_mode IN (
                      'factual', 'useful', 'creative', 'opinion', 'harm'
                    )),
  quality_score     numeric(8, 4) NOT NULL DEFAULT 0,
  confidence        numeric(8, 4) NOT NULL DEFAULT 0
                    CHECK (confidence >= 0 AND confidence <= 100),
  upvote_weight     numeric(18, 6) NOT NULL DEFAULT 0,
  downvote_weight   numeric(18, 6) NOT NULL DEFAULT 0,
  independent_voters integer NOT NULL DEFAULT 0 CHECK (independent_voters >= 0),
  settlement_status text NOT NULL DEFAULT 'open'
                    CHECK (settlement_status IN (
                      'open', 'pending', 'settled', 'quarantined'
                    )),
  settled_at        timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cqs_content_nonempty CHECK (length(trim(content_id)) > 0)
);

ALTER TABLE public.gh_content_quality_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cqs_no_client ON public.gh_content_quality_state;
CREATE POLICY gh_cqs_no_client ON public.gh_content_quality_state
  FOR ALL USING (false) WITH CHECK (false);

-- Curator calibration (JCS foundation)
CREATE TABLE IF NOT EXISTS public.gh_curator_calibration (
  user_id           text PRIMARY KEY,
  jcs               numeric(8, 4) NOT NULL DEFAULT 50
                    CHECK (jcs >= 0 AND jcs <= 100),
  correct_count     integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  incorrect_count   integer NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
  unresolved_count  integer NOT NULL DEFAULT 0 CHECK (unresolved_count >= 0),
  integrity_score   numeric(8, 4) NOT NULL DEFAULT 70
                    CHECK (integrity_score >= 0 AND integrity_score <= 100),
  curation_power    numeric(12, 6) NOT NULL DEFAULT 1
                    CHECK (curation_power >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cal_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_curator_calibration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cal_no_client ON public.gh_curator_calibration;
CREATE POLICY gh_cal_no_client ON public.gh_curator_calibration
  FOR ALL USING (false) WITH CHECK (false);

-- Judgment settlement records (idempotent epochs)
CREATE TABLE IF NOT EXISTS public.gh_judgment_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        text NOT NULL,
  settlement_epoch  text NOT NULL,
  confidence        numeric(8, 4) NOT NULL DEFAULT 0
                    CHECK (confidence >= 0 AND confidence <= 100),
  consensus_choice  text
                    CHECK (consensus_choice IS NULL OR consensus_choice IN (
                      'upvote', 'downvote', 'neutral', 'unresolved'
                    )),
  quality_delta     numeric(8, 4) NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_js_content_nonempty CHECK (length(trim(content_id)) > 0),
  CONSTRAINT gh_js_epoch_nonempty CHECK (length(trim(settlement_epoch)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_judgment_settlement_epoch
  ON public.gh_judgment_settlements (content_id, settlement_epoch);

ALTER TABLE public.gh_judgment_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_js_no_client ON public.gh_judgment_settlements;
CREATE POLICY gh_js_no_client ON public.gh_judgment_settlements
  FOR ALL USING (false) WITH CHECK (false);

-- Per-reviewer outcome on a settlement (calibration input; no GHC)
CREATE TABLE IF NOT EXISTS public.gh_judgment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id     uuid NOT NULL REFERENCES public.gh_judgment_settlements(id),
  reviewer_id       text NOT NULL,
  choice            text NOT NULL
                    CHECK (choice IN ('upvote', 'downvote', 'neutral')),
  alignment         text NOT NULL DEFAULT 'unresolved'
                    CHECK (alignment IN (
                      'aligned', 'misaligned', 'neutral', 'unresolved', 'protected'
                    )),
  jcs_delta         numeric(8, 4) NOT NULL DEFAULT 0,
  idempotency_key   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_je_reviewer_nonempty CHECK (length(trim(reviewer_id)) > 0),
  CONSTRAINT gh_je_idem_nonempty CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_judgment_event_idem
  ON public.gh_judgment_events (idempotency_key);

ALTER TABLE public.gh_judgment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_je_no_client ON public.gh_judgment_events;
CREATE POLICY gh_je_no_client ON public.gh_judgment_events
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_content_quality_state IS
  'GHPV-1 server quality snapshot; not a balance; clients cannot write.';
COMMENT ON TABLE public.gh_curator_calibration IS
  'GHPV-1 JCS/CP foundation; vote weight never from GHC balance.';
COMMENT ON TABLE public.gh_judgment_settlements IS
  'GHPV-1 consensus settlement epochs; no GHC minting.';
COMMENT ON TABLE public.gh_judgment_events IS
  'GHPV-1 per-reviewer calibration outcomes; no GHC.';

-- ============================================================================
-- SOURCE 062: 20261022010062_ghpv_curation_weight_and_settle.sql
-- SHA256: 6984f9726333812e2f4a3ab93fdcf18de3c9119c17f4f74aea0dcd641664e352
-- ============================================================================
-- GHPV-1A/1B: record weighted curation into quality state; settle judgment (no GHC).
-- Depends on 20261022010061_ghpv_judgment_infrastructure.sql

-- Allow unresolved-style statuses on quality state
ALTER TABLE public.gh_content_quality_state
  DROP CONSTRAINT IF EXISTS gh_content_quality_state_settlement_status_check;

ALTER TABLE public.gh_content_quality_state
  ADD CONSTRAINT gh_content_quality_state_settlement_status_check
  CHECK (settlement_status IN (
    'open', 'eligible', 'settling', 'settled', 'unresolved', 'quarantined', 'pending'
  ));

/**
 * After a durable vote: adjust open quality weights. Does NOT settle, does NOT mint GHC.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_record_curation_weight(
  p_content_id text,
  p_reviewer_id text,
  p_choice text,
  p_weight numeric,
  p_judgment_mode text DEFAULT 'useful'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_w numeric := greatest(0, coalesce(p_weight, 0));
  v_mode text := lower(trim(coalesce(p_judgment_mode, 'useful')));
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_reviewer_id IS NULL OR length(trim(p_reviewer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  IF v_mode NOT IN ('factual', 'useful', 'creative', 'opinion', 'harm') THEN
    v_mode := 'useful';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_q:' || trim(p_content_id)));

  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', v_mode, 0, 0,
    CASE WHEN v_choice = 'upvote' THEN v_w ELSE 0 END,
    CASE WHEN v_choice = 'downvote' THEN v_w ELSE 0 END,
    CASE WHEN v_choice IN ('upvote', 'downvote') THEN 1 ELSE 0 END,
    'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    judgment_mode = EXCLUDED.judgment_mode,
    upvote_weight = CASE
      WHEN v_choice = 'upvote' THEN public.gh_content_quality_state.upvote_weight + v_w
      WHEN v_choice = 'neutral' THEN public.gh_content_quality_state.upvote_weight
      ELSE public.gh_content_quality_state.upvote_weight
    END,
    downvote_weight = CASE
      WHEN v_choice = 'downvote' THEN public.gh_content_quality_state.downvote_weight + v_w
      WHEN v_choice = 'neutral' THEN public.gh_content_quality_state.downvote_weight
      ELSE public.gh_content_quality_state.downvote_weight
    END,
    independent_voters = public.gh_content_quality_state.independent_voters
      + CASE WHEN v_choice IN ('upvote', 'downvote') THEN 1 ELSE 0 END,
    settlement_status = CASE
      WHEN public.gh_content_quality_state.settlement_status IN ('settled') THEN 'settled'
      ELSE 'open'
    END,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'choice', v_choice,
    'weight', v_w,
    'settled', false,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) TO service_role;

/**
 * Idempotent settlement insert. Application computes outcome; RPC persists.
 * p_payload: jsonb from server settlement engine.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_persist_settlement(
  p_content_id text,
  p_settlement_epoch text,
  p_status text,
  p_consensus text,
  p_confidence numeric,
  p_quality_delta numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0
     OR p_settlement_epoch IS NULL OR length(trim(p_settlement_epoch)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_settle:' || trim(p_content_id)));

  SELECT id INTO v_existing
  FROM public.gh_judgment_settlements
  WHERE content_id = trim(p_content_id) AND settlement_epoch = trim(p_settlement_epoch);

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'settlementId', v_existing, 'ghcMutated', false);
  END IF;

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    coalesce(p_quality_delta, 0),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  UPDATE public.gh_content_quality_state
  SET
    settlement_status = CASE
      WHEN lower(trim(p_status)) = 'settled' THEN 'settled'
      WHEN lower(trim(p_status)) = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = quality_score + coalesce(p_quality_delta, 0),
    settled_at = CASE WHEN lower(trim(p_status)) = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'settlementId', v_id,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_persist_settlement(text, text, text, text, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_persist_settlement(text, text, text, text, numeric, numeric, jsonb) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_record_curation_weight IS
  'GHPV-1A weighted vote into quality state; no settlement; no GHC.';
COMMENT ON FUNCTION public.gh_ghpv_persist_settlement IS
  'GHPV-1B idempotent settlement persist; no GHC.';

-- ============================================================================
-- SOURCE 063: 20261022010063_gh_post_list_feed_stable_cursor.sql
-- SHA256: 7e5abca169c15ce6b0a8719964740496b9f0c273290c8057c49beb8a427a9477
-- ============================================================================
-- GreenHaven Phase 2: stable feed pagination.
-- Additive RPC; preserves legacy gh_post_list_feed for staged rollout.
CREATE OR REPLACE FUNCTION public.gh_post_list_feed_v2(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEED_CURSOR');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at)*1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at)*1000)::bigint = p_before_ms
          AND p.id < p_before_id
        )
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) TO service_role;

-- ============================================================================
-- SOURCE 064: 20261022010064_gh_comment_stable_cursor.sql
-- SHA256: d61030823b92eabf38e501c46fbf988910e1d2948ddd5f33427a51a93f4be373
-- ============================================================================
-- Phase 4: stable comment pagination + parent integrity.
-- Additive: legacy gh_comment_list remains available for rollback compatibility.
CREATE OR REPLACE FUNCTION public.gh_comment_list_v2(
  p_post_id text,
  p_viewer_id text DEFAULT NULL,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
  INTO v_rows FROM (
    SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
      c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_comments c
    WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
      AND (p_before_ms IS NULL OR
        (extract(epoch from c.created_at)*1000)::bigint < p_before_ms OR
        ((extract(epoch from c.created_at)*1000)::bigint = p_before_ms AND c.id < COALESCE(p_before_id, chr(255))))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,40),1),101)
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) TO service_role;

-- Reject cross-post/orphan parents at the durable boundary.
CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text := COALESCE(p_row->>'id',''); v_post text := COALESCE(p_row->>'postId',''); v_parent text := NULLIF(p_row->>'parentId','');
BEGIN
  IF v_id = '' OR v_post = '' THEN RETURN jsonb_build_object('ok',false,'error','INVALID'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id=v_post AND deleted_at IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','POST_NOT_FOUND'); END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gh_post_comments WHERE id=v_parent AND post_id=v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok',false,'error','PARENT_NOT_FOUND');
  END IF;
  INSERT INTO public.gh_post_comments(id,post_id,author_id,author_name,author_photo,text,parent_id,created_at)
  VALUES(v_id,v_post,COALESCE(p_row->>'authorId',''),COALESCE(p_row->>'authorName',''),COALESCE(p_row->>'authorPhoto',''),COALESCE(p_row->>'text',''),v_parent,
    CASE WHEN p_row ? 'createdAt' THEN to_timestamp((p_row->>'createdAt')::bigint/1000.0) ELSE now() END);
  UPDATE public.gh_posts SET comment_count=comment_count+1,updated_at=now() WHERE id=v_post;
  RETURN jsonb_build_object('ok',true,'id',v_id);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',true,'id',v_id,'idempotent',true);
END; $$;

-- ============================================================================
-- SOURCE 065: 20261022010065_ghc_wallet_snapshot_spendable.sql
-- SHA256: b80c30c926a0b163e087d9bdeef636db7aad44de8705ffdc59ca69187d2b669d
-- ============================================================================
-- Phase 5: make the wallet snapshot match debit authorization.
-- `balance` is spendable/available GHC; `ledgerBalance` is posted ledger total;
-- `locked` is server-reserved GHC (currently active withdrawal reservations).
CREATE OR REPLACE FUNCTION public.ghc_wallet_snapshot(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger numeric := 0;
  v_locked numeric := 0;
  v_available numeric := 0;
  v_pending numeric := 0;
  v_earned numeric := 0;
  v_spent numeric := 0;
  v_purchased numeric := 0;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('userId', p_user_id, 'balance', 0, 'ledgerBalance', 0,
      'locked', 0, 'pending', 0, 'lifetimeEarned', 0, 'lifetimeSpent', 0,
      'lifetimePurchased', 0, 'updatedAt', (extract(epoch from now()) * 1000)::bigint);
  END IF;

  SELECT
    coalesce(sum(CASE WHEN status='posted' AND kind <> 'transfer_request' THEN amount ELSE 0 END),0),
    coalesce(sum(CASE WHEN status='pending' AND amount > 0 AND kind <> 'transfer_request' THEN amount ELSE 0 END),0),
    coalesce(sum(CASE WHEN status='posted' AND amount > 0 AND kind IN ('earned','transfer_in') THEN amount ELSE 0 END),0),
    coalesce(sum(CASE WHEN status='posted' AND amount < 0 AND kind IN ('spent','transfer_out') THEN abs(amount) ELSE 0 END),0),
    coalesce(sum(CASE WHEN status='posted' AND amount > 0 AND kind='purchased' THEN amount ELSE 0 END),0)
  INTO v_ledger, v_pending, v_earned, v_spent, v_purchased
  FROM public.ghc_transactions WHERE user_id=p_user_id;

  v_ledger := greatest(0, v_ledger);
  -- Migration 20261009 defines the same reservation-aware balance used by spend/transfer.
  v_available := public.ghc_spendable_balance(p_user_id);
  v_locked := greatest(0, v_ledger - v_available);

  RETURN jsonb_build_object('userId',p_user_id,'balance',v_available,'ledgerBalance',v_ledger,
    'locked',v_locked,'pending',v_pending,'lifetimeEarned',v_earned,'lifetimeSpent',v_spent,
    'lifetimePurchased',v_purchased,'updatedAt',(extract(epoch from now())*1000)::bigint);
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_wallet_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_wallet_snapshot(text) TO service_role;

-- ============================================================================
-- SOURCE 066: 20261022010066_ghpv_curator_calibration_apply.sql
-- SHA256: becc5fd32ec5201a1c6a3145fd5ed028d56fcf50877c348d51e79c06fc8a2c60
-- ============================================================================
-- GHPV-3: persist curator calibration updates (no GHC).
-- Depends on 20261013 gh_curator_calibration.

CREATE TABLE IF NOT EXISTS public.gh_ghpv_calibration_applies (
  idempotency_key text PRIMARY KEY,
  user_id         text NOT NULL,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cal_apply_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_ghpv_calibration_applies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cal_apply_no_client ON public.gh_ghpv_calibration_applies;
CREATE POLICY gh_cal_apply_no_client ON public.gh_ghpv_calibration_applies
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_ghpv_apply_calibration(
  p_user_id text,
  p_jcs numeric,
  p_integrity numeric,
  p_correct integer,
  p_incorrect integer,
  p_unresolved integer,
  p_curation_power numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_cal:' || trim(p_user_id)));

  IF EXISTS (
    SELECT 1 FROM public.gh_ghpv_calibration_applies WHERE idempotency_key = v_key
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'ghcMutated', false);
  END IF;

  INSERT INTO public.gh_curator_calibration (
    user_id, jcs, integrity_score, correct_count, incorrect_count,
    unresolved_count, curation_power, updated_at
  ) VALUES (
    trim(p_user_id),
    greatest(0, least(100, coalesce(p_jcs, 50))),
    greatest(0, least(100, coalesce(p_integrity, 70))),
    greatest(0, coalesce(p_correct, 0)),
    greatest(0, coalesce(p_incorrect, 0)),
    greatest(0, coalesce(p_unresolved, 0)),
    greatest(0, coalesce(p_curation_power, 1)),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    jcs = EXCLUDED.jcs,
    integrity_score = EXCLUDED.integrity_score,
    correct_count = EXCLUDED.correct_count,
    incorrect_count = EXCLUDED.incorrect_count,
    unresolved_count = EXCLUDED.unresolved_count,
    curation_power = EXCLUDED.curation_power,
    updated_at = now();

  INSERT INTO public.gh_ghpv_calibration_applies (idempotency_key, user_id)
  VALUES (v_key, trim(p_user_id));

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'userId', trim(p_user_id),
    'jcs', greatest(0, least(100, coalesce(p_jcs, 50))),
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_apply_calibration(
  text, numeric, numeric, integer, integer, integer, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_apply_calibration(
  text, numeric, numeric, integer, integer, integer, numeric, text
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_apply_calibration IS
  'GHPV-3 curator calibration persist; no GHC mutation.';

-- ============================================================================
-- SOURCE 067: 20261022010067_ghpv_active_weight_set_semantics.sql
-- SHA256: a6610389fc1a27806fb4b082ac60bc4ad5debfb6fb101044378b2c9ca21f37a1
-- ============================================================================
-- =============================================================================
-- 20261022010067_ghpv_active_weight_set_semantics.sql
-- GHPV-1A fix: active per-reviewer weight (set/replace), not cumulative API adds.
-- Does NOT mint GHC. Does NOT settle judgments. Does NOT change gh_post_curations.
-- Depends on: 20261013 (quality state), 20261014 (record RPC name).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gh_ghpv_active_weights (
  content_id     text NOT NULL,
  reviewer_id    text NOT NULL,
  choice         text NOT NULL CHECK (choice IN ('upvote', 'downvote')),
  weight         numeric(18, 6) NOT NULL CHECK (weight >= 0),
  curation_power numeric(12, 6) NOT NULL DEFAULT 0 CHECK (curation_power >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, reviewer_id),
  CONSTRAINT gh_ghpv_aw_content_nonempty CHECK (length(trim(content_id)) > 0),
  CONSTRAINT gh_ghpv_aw_reviewer_nonempty CHECK (length(trim(reviewer_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_ghpv_active_weights_content
  ON public.gh_ghpv_active_weights (content_id);

ALTER TABLE public.gh_ghpv_active_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_ghpv_aw_no_client ON public.gh_ghpv_active_weights;
CREATE POLICY gh_ghpv_aw_no_client ON public.gh_ghpv_active_weights
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_ghpv_active_weights IS
  'GHPV-1A: one active weighted contribution per (content, reviewer). Not a ledger.';

/**
 * Recompute aggregate quality weights from active reviewer rows.
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_recompute_quality_aggregates(
  p_content_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_up numeric(18, 6);
  v_down numeric(18, 6);
  v_n integer;
BEGIN
  SELECT
    coalesce(sum(CASE WHEN choice = 'upvote' THEN weight ELSE 0 END), 0),
    coalesce(sum(CASE WHEN choice = 'downvote' THEN weight ELSE 0 END), 0),
    count(*)::integer
  INTO v_up, v_down, v_n
  FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id);

  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', 'useful', 0, 0,
    v_up, v_down, v_n, 'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    upvote_weight = EXCLUDED.upvote_weight,
    downvote_weight = EXCLUDED.downvote_weight,
    independent_voters = EXCLUDED.independent_voters,
    settlement_status = CASE
      WHEN q.settlement_status IN ('settled', 'quarantined') THEN q.settlement_status
      ELSE 'open'
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_recompute_quality_aggregates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_recompute_quality_aggregates(text) TO service_role;

/**
 * SET semantics (not ADD): establishes the reviewer's CURRENT contribution only.
 * neutral → delete active row; recompute aggregates from remaining rows.
 * Idempotent for identical (choice, weight).
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_record_curation_weight(
  p_content_id text,
  p_reviewer_id text,
  p_choice text,
  p_weight numeric,
  p_judgment_mode text DEFAULT 'useful'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_w numeric := greatest(0, coalesce(p_weight, 0));
  v_mode text := lower(trim(coalesce(p_judgment_mode, 'useful')));
  v_prev_choice text;
  v_prev_weight numeric;
  v_up numeric;
  v_down numeric;
  v_n integer;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_reviewer_id IS NULL OR length(trim(p_reviewer_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  IF v_mode NOT IN ('factual', 'useful', 'creative', 'opinion', 'harm') THEN
    v_mode := 'useful';
  END IF;

  -- Serialize per (content, reviewer) — matches curation lock grain
  PERFORM pg_advisory_xact_lock(
    hashtext('gh_ghpv_aw:' || trim(p_content_id) || ':' || trim(p_reviewer_id))
  );

  SELECT choice, weight INTO v_prev_choice, v_prev_weight
  FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id) AND reviewer_id = trim(p_reviewer_id);

  IF v_choice = 'neutral' THEN
    DELETE FROM public.gh_ghpv_active_weights
    WHERE content_id = trim(p_content_id) AND reviewer_id = trim(p_reviewer_id);
  ELSE
    INSERT INTO public.gh_ghpv_active_weights (
      content_id, reviewer_id, choice, weight, curation_power, updated_at
    ) VALUES (
      trim(p_content_id), trim(p_reviewer_id), v_choice, v_w, v_w, now()
    )
    ON CONFLICT (content_id, reviewer_id) DO UPDATE SET
      choice = EXCLUDED.choice,
      weight = EXCLUDED.weight,
      curation_power = EXCLUDED.curation_power,
      updated_at = now();
  END IF;

  -- Ensure quality state row exists with judgment_mode
  INSERT INTO public.gh_content_quality_state AS q (
    content_id, content_kind, judgment_mode, quality_score, confidence,
    upvote_weight, downvote_weight, independent_voters, settlement_status, updated_at
  ) VALUES (
    trim(p_content_id), 'post', v_mode, 0, 0, 0, 0, 0, 'open', now()
  )
  ON CONFLICT (content_id) DO UPDATE SET
    judgment_mode = COALESCE(NULLIF(v_mode, ''), q.judgment_mode),
    updated_at = now();

  PERFORM public.gh_ghpv_recompute_quality_aggregates(trim(p_content_id));

  SELECT upvote_weight, downvote_weight, independent_voters
  INTO v_up, v_down, v_n
  FROM public.gh_content_quality_state
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'reviewerId', trim(p_reviewer_id),
    'choice', v_choice,
    'weight', CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_w END,
    'previousChoice', v_prev_choice,
    'previousWeight', v_prev_weight,
    'upvoteWeight', coalesce(v_up, 0),
    'downvoteWeight', coalesce(v_down, 0),
    'independentVoters', coalesce(v_n, 0),
    'settled', false,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_record_curation_weight(text, text, text, numeric, text) IS
  'GHPV-1A SET active weight per reviewer; recompute aggregates; no settlement; no GHC.';

-- ============================================================================
-- SOURCE 068: 20261022010068_ghpv_settlement_engine.sql
-- SHA256: 8a7bfaf8612e2f785a11c45270010e22e961ef543481cb20837aed88ae93506d
-- ============================================================================
-- =============================================================================
-- 20261022010068_ghpv_settlement_engine.sql
-- GHPV-1B: authoritative settlement snapshot + idempotent commit.
--
-- Purpose:
--   Derive settlement inputs only from server tables (posts, curations, active weights).
--   Persist one settlement per (content_id, settlement_epoch).
--   Record judgment events and optional calibration updates in the same transaction.
--
-- Dependencies:
--   20261022010061_ghpv_judgment_infrastructure.sql
--   20261022010062_ghpv_curation_weight_and_settle.sql
--   20261022010066_ghpv_curator_calibration_apply.sql
--   20261022010067_ghpv_active_weight_set_semantics.sql
--
-- Objects:
--   gh_ghpv_settlement_snapshot(text)
--   gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT EXECUTE TO service_role only
--   Client roles cannot call these RPCs or write GHPV tables (RLS deny-all remains)
--
-- Idempotency:
--   Unique (content_id, settlement_epoch) + advisory lock.
--   Repeat commit returns existing settlement and does not re-apply calibration.
--
-- Concurrency:
--   pg_advisory_xact_lock on content settlement key.
--   Snapshot is the active-weight rows that still match gh_post_curations.
--
-- Rollback:
--   Forward-only. Do not drop historical settlements in production.
--   Safe to re-run CREATE OR REPLACE / IF NOT EXISTS objects.
--
-- GHC / economy:
--   NONE. No ghc_* tables or RPCs are referenced.
--
-- Deployment:
--   Apply on Testnet only after 20261013–20261016. Do not apply from this repo automatically.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_ghpv_settlement_snapshot(
  p_content_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_mode text;
  v_status text;
  v_votes jsonb;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;

  SELECT author_id INTO v_author
  FROM public.gh_posts
  WHERE id = trim(p_content_id) AND deleted_at IS NULL;

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT judgment_mode, settlement_status
  INTO v_mode, v_status
  FROM public.gh_content_quality_state
  WHERE content_id = trim(p_content_id);

  -- Only votes that exist in BOTH active weights and current curation row.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'reviewerId', w.reviewer_id,
    'choice', w.choice,
    'weight', w.weight
  ) ORDER BY w.reviewer_id), '[]'::jsonb)
  INTO v_votes
  FROM public.gh_ghpv_active_weights w
  JOIN public.gh_post_curations c
    ON c.post_id = w.content_id
   AND c.user_id = w.reviewer_id
   AND c.choice = w.choice
  WHERE w.content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'authorId', v_author,
    'judgmentMode', coalesce(v_mode, 'useful'),
    'settlementStatus', coalesce(v_status, 'open'),
    'votes', v_votes,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_settlement_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_settlement_snapshot(text) TO service_role;

/**
 * Commit one epoch. p_effects is server-computed only.
 * Shape: [{reviewerId, choice, alignment, jcsDelta, nextJcs, nextIntegrity,
 *          correctCount, incorrectCount, unresolvedCount, curationPower}]
 */
CREATE OR REPLACE FUNCTION public.gh_ghpv_commit_settlement(
  p_content_id text,
  p_settlement_epoch text,
  p_status text,
  p_consensus text,
  p_confidence numeric,
  p_quality_delta numeric,
  p_effects jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
  v_effect jsonb;
  v_key text;
  v_status text := lower(trim(coalesce(p_status, 'unresolved')));
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0
     OR p_settlement_epoch IS NULL OR length(trim(p_settlement_epoch)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_posts
    WHERE id = trim(p_content_id) AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_settle:' || trim(p_content_id)));

  SELECT id INTO v_existing
  FROM public.gh_judgment_settlements
  WHERE content_id = trim(p_content_id)
    AND settlement_epoch = trim(p_settlement_epoch);

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'settlementId', v_existing,
      'ghcMutated', false
    );
  END IF;

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    coalesce(p_quality_delta, 0),
    jsonb_build_object(
      'status', v_status,
      'engine', 'ghpv-1b',
      'antiWhaleShare', 0.12
    )
  )
  RETURNING id INTO v_id;

  IF jsonb_typeof(p_effects) = 'array' THEN
    FOR v_effect IN SELECT * FROM jsonb_array_elements(p_effects)
    LOOP
      v_key := 'judgment:' || trim(p_content_id) || ':' || trim(p_settlement_epoch)
        || ':' || coalesce(v_effect->>'reviewerId', '');
      INSERT INTO public.gh_judgment_events (
        settlement_id, reviewer_id, choice, alignment, jcs_delta, idempotency_key
      ) VALUES (
        v_id,
        coalesce(v_effect->>'reviewerId', ''),
        CASE
          WHEN coalesce(v_effect->>'choice', 'neutral') IN ('upvote', 'downvote', 'neutral')
          THEN coalesce(v_effect->>'choice', 'neutral')
          ELSE 'neutral'
        END,
        CASE
          WHEN coalesce(v_effect->>'alignment', 'unresolved') IN (
            'aligned', 'misaligned', 'neutral', 'unresolved', 'protected'
          ) THEN coalesce(v_effect->>'alignment', 'unresolved')
          ELSE 'unresolved'
        END,
        coalesce((v_effect->>'jcsDelta')::numeric, 0),
        v_key
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      IF coalesce(v_effect->>'reviewerId', '') <> ''
         AND v_effect ? 'nextJcs' THEN
        INSERT INTO public.gh_curator_calibration (
          user_id, jcs, integrity_score, correct_count, incorrect_count,
          unresolved_count, curation_power, updated_at
        ) VALUES (
          v_effect->>'reviewerId',
          greatest(0, least(100, coalesce((v_effect->>'nextJcs')::numeric, 50))),
          greatest(0, least(100, coalesce((v_effect->>'nextIntegrity')::numeric, 70))),
          greatest(0, coalesce((v_effect->>'correctCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'incorrectCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'unresolvedCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'curationPower')::numeric, 1)),
          now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          jcs = EXCLUDED.jcs,
          integrity_score = EXCLUDED.integrity_score,
          correct_count = EXCLUDED.correct_count,
          incorrect_count = EXCLUDED.incorrect_count,
          unresolved_count = EXCLUDED.unresolved_count,
          curation_power = EXCLUDED.curation_power,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  UPDATE public.gh_content_quality_state
  SET
    settlement_status = CASE
      WHEN v_status = 'settled' THEN 'settled'
      WHEN v_status = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = quality_score + coalesce(p_quality_delta, 0),
    settled_at = CASE WHEN v_status = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'settlementId', v_id,
    'status', v_status,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_settlement_snapshot(text) IS
  'GHPV-1B authoritative vote snapshot. Joins active weights to current curations. No GHC.';
COMMENT ON FUNCTION public.gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb) IS
  'GHPV-1B idempotent epoch commit + judgment events + calibration. No GHC.';

-- ============================================================================
-- SOURCE 069: 20261022010069_match_signals_durable.sql
-- SHA256: 86ecb2b0dff81d1feeef4b525fe5b69115cc5aaa676ebf4e4c2b0323c3457a22
-- ============================================================================
-- Phase 5 — Match interest signals (like / pass / superlike)
-- Additive. Operator applies after review. Not auto-applied.
-- Match ≠ Friend. Mutual like may create match edge; does not auto-friend.

CREATE TABLE IF NOT EXISTS public.ghc_match_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  signal text NOT NULL CHECK (signal IN ('like', 'pass', 'superlike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_match_signals_no_self CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghc_match_signals_pair_uidx
  ON public.ghc_match_signals (from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS ghc_match_signals_to_like_idx
  ON public.ghc_match_signals (to_user_id, created_at DESC)
  WHERE signal IN ('like', 'superlike');

CREATE INDEX IF NOT EXISTS ghc_match_signals_from_idx
  ON public.ghc_match_signals (from_user_id, created_at DESC);

ALTER TABLE public.ghc_match_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghc_match_signals FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghc_match_signals TO service_role;

-- Upsert signal
CREATE OR REPLACE FUNCTION public.ghc_match_signal_upsert(
  p_from_user_id text,
  p_to_user_id text,
  p_signal text
)
RETURNS public.ghc_match_signals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_match_signals;
BEGIN
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL OR p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'INVALID_PAIR';
  END IF;
  IF p_signal NOT IN ('like', 'pass', 'superlike') THEN
    RAISE EXCEPTION 'INVALID_SIGNAL';
  END IF;

  INSERT INTO public.ghc_match_signals (from_user_id, to_user_id, signal, updated_at)
  VALUES (p_from_user_id, p_to_user_id, p_signal, now())
  ON CONFLICT (from_user_id, to_user_id)
  DO UPDATE SET signal = EXCLUDED.signal, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_match_signal_upsert(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_match_signal_upsert(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 070: 20261022010070_ghpv_calibration_bounds.sql
-- SHA256: dcd3a889333a34bdea75c68335706d85ac2b01918be3967b473edc76ff964185
-- ============================================================================
-- =============================================================================
-- 20261022010070_ghpv_calibration_bounds.sql
-- GHPV-1B: database-enforced calibration bounds on settlement commit.
--
-- Purpose:
--   Do not trust application-computed nextJcs / jcsDelta blindly.
--   Clamp JCS to 0–100, integrity to 0–100, and per-event JCS delta to ±2.5.
--   Unresolved/protected alignments persist delta 0.
--
-- Dependencies:
--   20261022010068_ghpv_settlement_engine.sql
--
-- Objects modified:
--   gh_ghpv_commit_settlement (CREATE OR REPLACE)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT service_role only
--   Existing RLS deny-all on GHPV tables is unchanged
--
-- Idempotency:
--   Unchanged. Existing (content_id, settlement_epoch) returns without re-apply.
--
-- Rollback:
--   Forward-only. Re-applying this file is safe (CREATE OR REPLACE).
--
-- GHC impact:
--   NONE.
--
-- Deployment:
--   Apply after 20261017 on Testnet only. Not executed by this repository change.
--
-- Quality lifecycle (existing settlement_status values):
--   open        = judgment still collecting
--   pending     = reserved; not auto-set by this migration
--   settled     = validated consensus recorded
--   unresolved  = epoch closed without a forced truth
--   quarantined = operator hold; commit does not clear it
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_ghpv_commit_settlement(
  p_content_id text,
  p_settlement_epoch text,
  p_status text,
  p_consensus text,
  p_confidence numeric,
  p_quality_delta numeric,
  p_effects jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
  v_effect jsonb;
  v_key text;
  v_status text := lower(trim(coalesce(p_status, 'unresolved')));
  v_align text;
  v_delta numeric;
  v_jcs numeric;
  v_integrity numeric;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0
     OR p_settlement_epoch IS NULL OR length(trim(p_settlement_epoch)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_posts
    WHERE id = trim(p_content_id) AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_ghpv_settle:' || trim(p_content_id)));

  SELECT id INTO v_existing
  FROM public.gh_judgment_settlements
  WHERE content_id = trim(p_content_id)
    AND settlement_epoch = trim(p_settlement_epoch);

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true, 'settlementId', v_existing, 'ghcMutated', false
    );
  END IF;

  -- Quality delta is a signal, not money. Bound it.
  p_quality_delta := greatest(-25, least(25, coalesce(p_quality_delta, 0)));

  INSERT INTO public.gh_judgment_settlements (
    content_id, settlement_epoch, confidence, consensus_choice, quality_delta, metadata
  ) VALUES (
    trim(p_content_id),
    trim(p_settlement_epoch),
    greatest(0, least(100, coalesce(p_confidence, 0))),
    nullif(trim(coalesce(p_consensus, '')), ''),
    p_quality_delta,
    jsonb_build_object('status', v_status, 'engine', 'ghpv-1b', 'antiWhaleShare', 0.12)
  )
  RETURNING id INTO v_id;

  IF jsonb_typeof(p_effects) = 'array' THEN
    FOR v_effect IN SELECT * FROM jsonb_array_elements(p_effects)
    LOOP
      v_align := coalesce(v_effect->>'alignment', 'unresolved');
      IF v_align NOT IN ('aligned', 'misaligned', 'neutral', 'unresolved', 'protected') THEN
        v_align := 'unresolved';
      END IF;
      v_delta := coalesce((v_effect->>'jcsDelta')::numeric, 0);
      IF v_align IN ('unresolved', 'protected', 'neutral') THEN
        v_delta := 0;
      END IF;
      v_delta := greatest(-2.5, least(2.5, v_delta));
      v_jcs := greatest(0, least(100, coalesce((v_effect->>'nextJcs')::numeric, 50)));
      v_integrity := greatest(0, least(100, coalesce((v_effect->>'nextIntegrity')::numeric, 70)));

      v_key := 'judgment:' || trim(p_content_id) || ':' || trim(p_settlement_epoch)
        || ':' || coalesce(v_effect->>'reviewerId', '');
      INSERT INTO public.gh_judgment_events (
        settlement_id, reviewer_id, choice, alignment, jcs_delta, idempotency_key
      ) VALUES (
        v_id,
        coalesce(v_effect->>'reviewerId', ''),
        CASE
          WHEN coalesce(v_effect->>'choice', 'neutral') IN ('upvote', 'downvote', 'neutral')
          THEN coalesce(v_effect->>'choice', 'neutral')
          ELSE 'neutral'
        END,
        v_align,
        v_delta,
        v_key
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      IF coalesce(v_effect->>'reviewerId', '') <> '' AND v_effect ? 'nextJcs' THEN
        INSERT INTO public.gh_curator_calibration (
          user_id, jcs, integrity_score, correct_count, incorrect_count,
          unresolved_count, curation_power, updated_at
        ) VALUES (
          v_effect->>'reviewerId',
          v_jcs,
          v_integrity,
          greatest(0, coalesce((v_effect->>'correctCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'incorrectCount')::integer, 0)),
          greatest(0, coalesce((v_effect->>'unresolvedCount')::integer, 0)),
          greatest(0, least(100, coalesce((v_effect->>'curationPower')::numeric, 1))),
          now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          jcs = EXCLUDED.jcs,
          integrity_score = EXCLUDED.integrity_score,
          correct_count = EXCLUDED.correct_count,
          incorrect_count = EXCLUDED.incorrect_count,
          unresolved_count = EXCLUDED.unresolved_count,
          curation_power = EXCLUDED.curation_power,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  UPDATE public.gh_content_quality_state
  SET
    settlement_status = CASE
      WHEN settlement_status = 'quarantined' THEN 'quarantined'
      WHEN v_status = 'settled' THEN 'settled'
      WHEN v_status = 'unresolved' THEN 'unresolved'
      ELSE 'open'
    END,
    confidence = greatest(0, least(100, coalesce(p_confidence, 0))),
    quality_score = greatest(-100, least(100, quality_score + p_quality_delta)),
    settled_at = CASE WHEN v_status = 'settled' THEN now() ELSE settled_at END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'settlementId', v_id, 'status', v_status, 'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_commit_settlement(
  text, text, text, text, numeric, numeric, jsonb
) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_commit_settlement(text, text, text, text, numeric, numeric, jsonb) IS
  'GHPV-1B commit with DB-enforced JCS 0-100 and delta ±2.5. No GHC.';

-- ============================================================================
-- SOURCE 071: 20261022010071_ghc_curation_rewards.sql
-- SHA256: d73fbeba9ee2056dec6a2028e0e244d478d6bb1bd0d8e180ae8f68af923b176f
-- ============================================================================
-- GreenHaven curation rewards: additive, server-authoritative, idempotent.
-- Apply to TESTNET first. This migration does not execute itself against any database.

CREATE TABLE IF NOT EXISTS public.ghc_curation_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  post_id text NOT NULL,
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  status text NOT NULL CHECK (status IN ('credited','ineligible','capped','zero_amount','failed')),
  calculated_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (calculated_amount >= 0),
  credited_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (credited_amount >= 0),
  reputation_level integer NOT NULL DEFAULT 1 CHECK (reputation_level BETWEEN 1 AND 15),
  balance_basis numeric(18,4) NOT NULL DEFAULT 0 CHECK (balance_basis >= 0),
  ledger_transaction_id uuid,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.ghc_curation_reward_claims ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ghc_curation_reward_claims_user_created
  ON public.ghc_curation_reward_claims (user_id, created_at DESC);
ALTER TABLE public.ghc_curation_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ghc_curation_reward_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ghc_curation_reward_claims TO service_role;
DROP POLICY IF EXISTS ghc_curation_reward_claims_no_client ON public.ghc_curation_reward_claims;
CREATE POLICY ghc_curation_reward_claims_no_client ON public.ghc_curation_reward_claims
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.ghc_curation_reward_credit(
  p_user_id text,
  p_post_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_pct numeric(5,2) := round(coalesce(p_percentage, 0), 2);
  v_author text;
  v_current_choice text;
  v_balance numeric(18,4) := 0;
  v_level integer := 1;
  v_calculated numeric(18,4) := 0;
  v_daily_cap numeric(18,4) := 500;
  v_earned_today numeric(18,4) := 0;
  v_credit numeric(18,4) := 0;
  v_local_day date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_claim_id uuid;
  v_tx_id uuid;
  v_status text := 'ineligible';
  v_reason text := '';
  v_existing public.ghc_curation_reward_claims%ROWTYPE;
BEGIN
  IF v_user = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_pct < 0 OR v_pct > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;
  IF v_choice <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE');
  END IF;

  -- Use the same post/voter lock as gh_post_curation_set, then the shared
  -- wallet lock. This prevents a concurrent toggle from racing eligibility.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || v_post || ':' || v_user));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_curation_reward:' || v_user || ':' || v_post));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || v_user));

  SELECT author_id INTO v_author FROM public.gh_posts
   WHERE id = v_post AND deleted_at IS NULL;
  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_author = v_user THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'SELF_VOTE');
  END IF;
  SELECT choice INTO v_current_choice FROM public.gh_post_curations
    WHERE post_id = v_post AND user_id = v_user;
  IF coalesce(v_current_choice, '') <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'amount', 0, 'reason', 'UPVOTE_NOT_ACTIVE');
  END IF;

  SELECT * INTO v_existing FROM public.ghc_curation_reward_claims
   WHERE user_id = v_user AND post_id = v_post
   FOR UPDATE;
  IF FOUND THEN
    -- A posted reward is immutable and can never be claimed again. A no-balance,
    -- zero-percentage, or restricted attempt is retryable after conditions change;
    -- capped and other terminal outcomes remain one-shot for anti-abuse safety.
    IF v_existing.credited_amount > 0 OR NOT (
      v_existing.status IN ('ineligible', 'zero_amount') AND
      v_existing.reason IN ('NO_ELIGIBLE_BALANCE', 'PERCENTAGE_ZERO', 'ACCOUNT_RESTRICTED')
    ) THEN
      RETURN jsonb_build_object('ok', true, 'credited', v_existing.credited_amount > 0,
        'amount', v_existing.credited_amount, 'reason', 'ALREADY_CLAIMED', 'claimId', v_existing.id);
    END IF;
    v_claim_id := v_existing.id;
    UPDATE public.ghc_curation_reward_claims
      SET percentage = v_pct, status = 'ineligible', reason = 'EVALUATING', updated_at = now()
      WHERE id = v_claim_id;
  ELSE
    INSERT INTO public.ghc_curation_reward_claims
      (user_id, post_id, percentage, status, reason)
    VALUES (v_user, v_post, v_pct, 'ineligible', 'EVALUATING')
    RETURNING id INTO v_claim_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = v_user AND (restricted OR suspended)) THEN
    v_reason := 'ACCOUNT_RESTRICTED';
  ELSE
    -- Read spendable balance and reputation in one SQL statement/snapshot.
    SELECT greatest(0, coalesce(public.ghc_spendable_balance(v_user), 0)),
           greatest(1, least(15, coalesce(r.level, 1)))
      INTO v_balance, v_level
      FROM (SELECT 1) AS seed
      LEFT JOIN public.gh_reputation_state AS r ON r.user_id = v_user;
    SELECT greatest(0, coalesce(max_daily_earn, 500)) INTO v_daily_cap
      FROM public.ghc_economy_limits WHERE id = 1 FOR SHARE;
    -- Honor the existing centrally configured economy cap; do not introduce
    -- a separate hard-coded curation cap that changes established economics.
    v_daily_cap := greatest(0, coalesce(v_daily_cap, 500));

    IF v_balance <= 0 THEN
      v_reason := 'NO_ELIGIBLE_BALANCE';
    ELSIF v_pct <= 0 THEN
      v_status := 'zero_amount'; v_reason := 'PERCENTAGE_ZERO';
    ELSE
      -- Formula: (eligible balance / 10) * level * percentage / 100 / 100.
      -- 1,000 balance × level 5 × 100% = 5 GHC.
      v_calculated := round((v_balance / 10) * v_level * (v_pct / 100) / 100, 4);
      SELECT coalesce(sum(amount), 0) INTO v_earned_today
      FROM public.ghc_transactions
      WHERE user_id = v_user AND kind = 'earned' AND status = 'posted'
        AND created_at >= (v_local_day::timestamp AT TIME ZONE 'Africa/Lagos')
        AND created_at < ((v_local_day + 1)::timestamp AT TIME ZONE 'Africa/Lagos');
      v_credit := least(v_calculated, greatest(0, v_daily_cap - v_earned_today));
      IF v_credit <= 0 THEN
        v_status := 'capped'; v_reason := 'DAILY_EARN_CAP_REACHED';
      ELSE
        INSERT INTO public.ghc_transactions
          (user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at)
        VALUES
          (v_user, 'earned', v_credit, 'posted', 'Curation upvote reward',
           'curation_reward', 'curation:' || v_user || ':' || v_post,
           jsonb_build_object('postId', v_post, 'percentage', v_pct,
             'balanceBasis', v_balance, 'reputationLevel', v_level,
             'calculatedAmount', v_calculated, 'dailyCap', v_daily_cap,
             'localDay', v_local_day), now())
        RETURNING id INTO v_tx_id;
        v_status := 'credited'; v_reason := 'CREDITED';
      END IF;
    END IF;
  END IF;

  UPDATE public.ghc_curation_reward_claims
  SET percentage = v_pct, status = v_status,
      calculated_amount = v_calculated, credited_amount = v_credit,
      reputation_level = v_level, balance_basis = v_balance,
      ledger_transaction_id = v_tx_id, reason = v_reason
  WHERE id = v_claim_id;

  RETURN jsonb_build_object('ok', true, 'credited', v_credit > 0, 'amount', v_credit,
    'calculatedAmount', v_calculated, 'status', v_status, 'reason', v_reason,
    'reputationLevel', v_level, 'balanceBasis', v_balance, 'claimId', v_claim_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) TO service_role;
COMMENT ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) IS
  'Atomically evaluates and credits one curation upvote reward per user/post; server-authoritative balance, level, daily cap and ledger.';


-- Keep the durable vote mutation and its one-time reward decision in the same
-- PostgreSQL transaction. If reward evaluation fails unexpectedly, the vote
-- mutation rolls back too; clients never observe a successful vote with a
-- silently lost reward attempt.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
BEGIN
  v_vote := public.gh_post_curation_set(p_post_id, p_user_id, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;

  v_choice := coalesce(v_vote->>'choice', 'neutral');
  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(
      p_user_id, p_post_id, v_choice, p_percentage
    );
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  RETURN v_vote || jsonb_build_object('reward', v_reward);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric) IS
  'Atomically applies the authoritative curation vote and its idempotent GHC reward decision.';

-- ============================================================================
-- SOURCE 072: 20261022010072_gh_curation_pipeline_atomic.sql
-- SHA256: 18f07ee249784eeab8275b5889bd8dbd52f30770d6352edd7457400da0e60019
-- ============================================================================
-- GreenHaven curation pipeline hardening.
-- TESTNET first. Keeps vote, one-time GHC reward decision, and active GHPV weight
-- in one PostgreSQL transaction. No database is modified by adding this file.

DROP FUNCTION IF EXISTS public.gh_post_curation_set_with_reward(text, text, text, numeric);

-- Persist the selected percentage alongside the active vote instead of keeping
-- it only in a card's transient React state.
ALTER TABLE public.gh_post_curations
  ADD COLUMN IF NOT EXISTS reward_percentage numeric(5,2) NOT NULL DEFAULT 100
  CHECK (reward_percentage >= 0 AND reward_percentage <= 100);

CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100,
  p_curation_weight numeric DEFAULT 0,
  p_judgment_mode text DEFAULT 'useful'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
  v_weighted jsonb;
  v_weight numeric(18,6) := greatest(0, least(coalesce(p_curation_weight, 0), 1000000));
  v_percentage numeric(5,2) := round(coalesce(p_percentage, 100), 2);
BEGIN
  IF v_percentage < 0 OR v_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;

  v_vote := public.gh_post_curation_set(p_post_id, p_user_id, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;

  v_choice := coalesce(v_vote->>'choice', 'neutral');
  IF v_choice IN ('upvote', 'downvote') THEN
    UPDATE public.gh_post_curations
      SET reward_percentage = v_percentage, updated_at = now()
      WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
  END IF;
  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(
      p_user_id, p_post_id, v_choice, v_percentage
    );
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  -- The GHPV active-weight record is part of the same transaction. The caller
  -- derives p_curation_weight from server-side reputation/calibration, never client input.
  v_weighted := public.gh_ghpv_record_curation_weight(
    p_post_id,
    p_user_id,
    v_choice,
    CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_weight * (v_percentage / 100) END,
    p_judgment_mode
  );
  IF coalesce((v_weighted->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GHPV curation weight update failed: %',
      coalesce(v_weighted->>'error', 'GHPV_WEIGHT_UPDATE_FAILED');
  END IF;

  RETURN v_vote || jsonb_build_object('reward', v_reward, 'ghpv', v_weighted,
    'rewardPercentage', v_percentage);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) IS
  'Atomic curation pipeline: authoritative vote, one-time GHC reward decision, and active GHPV weight. Percentage scales reward and active curation weight; does not mutate account reputation directly.';

-- ============================================================================
-- SOURCE 073: 20261022010073_reputation_event_integrity.sql
-- SHA256: 6f7e2a02cf5b37040797a820a219b99e07dd1cbf097cfc2564d17be1784ace3d
-- ============================================================================
-- GreenHaven reputation integrity hardening.
-- TESTNET first. This migration adds a database-level guard so service code
-- cannot accidentally write non-canonical points for catalogued events.
-- It does not invent negative vote penalties or make curation a reputation award.

CREATE OR REPLACE FUNCTION public.gh_reputation_validate_event_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expected integer;
BEGIN
  v_expected := CASE NEW.event_type
    WHEN 'profile_complete' THEN 25
    WHEN 'first_post' THEN 15
    WHEN 'community_join' THEN 10
    WHEN 'marketplace_order_complete' THEN 20
    WHEN 'report_resolved_helpful' THEN 5
    WHEN 'manual_adjustment_credit' THEN NULL
    ELSE -1
  END;

  IF v_expected = -1 THEN
    RAISE EXCEPTION 'Unsupported reputation event type: %', NEW.event_type
      USING ERRCODE = '22023';
  END IF;
  IF v_expected IS NOT NULL AND NEW.points <> v_expected THEN
    RAISE EXCEPTION 'Non-canonical reputation points for %: expected %, got %',
      NEW.event_type, v_expected, NEW.points
      USING ERRCODE = '22023';
  END IF;
  IF NEW.points < 0 OR NEW.points > 10000 THEN
    RAISE EXCEPTION 'Reputation points outside permitted range'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.event_type = 'manual_adjustment_credit' AND NEW.points <= 0 THEN
    RAISE EXCEPTION 'Manual reputation adjustment must be positive'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gh_reputation_event_points_guard ON public.gh_reputation_events;
CREATE TRIGGER gh_reputation_event_points_guard
BEFORE INSERT OR UPDATE OF event_type, points
ON public.gh_reputation_events
FOR EACH ROW EXECUTE FUNCTION public.gh_reputation_validate_event_points();

REVOKE ALL ON FUNCTION public.gh_reputation_validate_event_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_validate_event_points() TO service_role;

COMMENT ON FUNCTION public.gh_reputation_validate_event_points() IS
  'Database-level canonical point guard for reputation events; no curation vote penalties or GHC effects.';

-- ============================================================================
-- SOURCE 074: 20261022010074_curation_self_vote_guard.sql
-- SHA256: d96540143428f9ff403ed0886078521b7d7dec9729e7f98f3e8111b81a9fcb9d
-- ============================================================================
-- GreenHaven anti-gaming guard: a content author cannot curate their own post.
-- TESTNET FIRST. This does not award/deduct reputation or mutate GHC.
-- Service-role only; existing RLS deny-all policies remain in force.

CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer;
  v_down integer;
  v_state text := 'neutral';
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0
     OR length(trim(p_post_id)) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || trim(p_post_id) || ':' || trim(p_user_id)));

  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author = trim(p_user_id) AND v_choice IN ('upvote', 'downvote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_CURATION_FORBIDDEN');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = trim(p_user_id) AND blocked_id = v_author)
       OR (blocker_id = v_author AND blocked_id = trim(p_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_visibility = 'public' THEN
    NULL;
  ELSIF v_visibility = 'followers' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gh_follows
      WHERE follower_id = trim(p_user_id) AND following_id = v_author
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev
  FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);

  IF v_prev IS NOT NULL AND v_choice = v_prev THEN
    v_choice := 'neutral';
  END IF;

  IF v_prev IS NOT NULL THEN
    DELETE FROM public.gh_post_curations
    WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
    IF v_prev = 'upvote' THEN
      UPDATE public.gh_posts SET upvote_count = greatest(upvote_count - 1, 0), updated_at = now()
      WHERE id = trim(p_post_id);
    ELSIF v_prev = 'downvote' THEN
      UPDATE public.gh_posts SET downvote_count = greatest(downvote_count - 1, 0), updated_at = now()
      WHERE id = trim(p_post_id);
    END IF;
  END IF;

  IF v_choice IN ('upvote', 'downvote') THEN
    INSERT INTO public.gh_post_curations (post_id, user_id, choice)
    VALUES (trim(p_post_id), trim(p_user_id), v_choice)
    ON CONFLICT (post_id, user_id) DO UPDATE
      SET choice = EXCLUDED.choice, updated_at = now();
    IF v_choice = 'upvote' THEN
      UPDATE public.gh_posts SET upvote_count = upvote_count + 1, updated_at = now()
      WHERE id = trim(p_post_id);
    ELSE
      UPDATE public.gh_posts SET downvote_count = downvote_count + 1, updated_at = now()
      WHERE id = trim(p_post_id);
    END IF;
    v_state := v_choice;
  ELSE
    v_state := 'neutral';
  END IF;

  SELECT upvote_count, downvote_count INTO v_up, v_down
  FROM public.gh_posts WHERE id = trim(p_post_id);

  RETURN jsonb_build_object('ok', true, 'choice', v_state,
    'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Authoritative curation SET/toggle; blocks self-curation; no direct reputation or GHC mutation.';

-- ============================================================================
-- SOURCE 075: 20261022010075_allow_self_curation.sql
-- SHA256: b703568a507b77b36e97fca6ee5100f720a91e13fa7151ee4183c507fb667976
-- ============================================================================
-- GreenHaven product policy update: creators may self-curate their own content.
-- Self-curation is an encouragement/display signal only: it must never generate GHC
-- reward, reputation points, or independent-reviewer evidence. TESTNET FIRST.
-- The prior 004 function is replaced here with the same SET/toggle and access checks,
-- removing only the author-equals-voter rejection.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text, p_user_id text, p_choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text; v_visibility text; v_prev text;
  v_up integer; v_down integer; v_state text := 'neutral';
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 OR length(trim(p_post_id)) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate:' || trim(p_post_id) || ':' || trim(p_user_id)));
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF v_author IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF EXISTS (SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = trim(p_user_id) AND blocked_id = v_author)
       OR (blocker_id = v_author AND blocked_id = trim(p_user_id))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' THEN NULL;
  ELSIF v_visibility = 'followers' THEN
    IF NOT EXISTS (SELECT 1 FROM public.gh_follows
      WHERE follower_id = trim(p_user_id) AND following_id = v_author) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT choice INTO v_prev FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
  IF v_prev IS NOT NULL AND v_choice = v_prev THEN v_choice := 'neutral'; END IF;
  IF v_prev IS NOT NULL THEN
    DELETE FROM public.gh_post_curations WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
    IF v_prev = 'upvote' THEN UPDATE public.gh_posts SET upvote_count = greatest(upvote_count - 1, 0), updated_at = now() WHERE id = trim(p_post_id);
    ELSIF v_prev = 'downvote' THEN UPDATE public.gh_posts SET downvote_count = greatest(downvote_count - 1, 0), updated_at = now() WHERE id = trim(p_post_id); END IF;
  END IF;
  IF v_choice IN ('upvote', 'downvote') THEN
    INSERT INTO public.gh_post_curations (post_id, user_id, choice) VALUES (trim(p_post_id), trim(p_user_id), v_choice)
    ON CONFLICT (post_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now();
    IF v_choice = 'upvote' THEN UPDATE public.gh_posts SET upvote_count = upvote_count + 1, updated_at = now() WHERE id = trim(p_post_id);
    ELSE UPDATE public.gh_posts SET downvote_count = downvote_count + 1, updated_at = now() WHERE id = trim(p_post_id); END IF;
    v_state := v_choice;
  END IF;
  SELECT upvote_count, downvote_count INTO v_up, v_down FROM public.gh_posts WHERE id = trim(p_post_id);
  RETURN jsonb_build_object('ok', true, 'choice', v_state, 'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Author may self-curate for display/encouragement; self-curation is never reward or independent-settlement evidence.';

-- ============================================================================
-- SOURCE 076: 20261022010076_daily_claim_48h_lock.sql
-- SHA256: 689c427c659a66f5db2b15b0800b1c49e5962194c1d5ebe31074d02e76a1920c
-- ============================================================================
-- Phase 2: Daily Claim rewards become pending entitlements for 48 hours.
-- Additive migration; do not apply to production until Testnet validation passes.

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_daily_claim_pending_ref
  ON public.ghc_transactions (user_id, reference_id)
  WHERE kind = 'earned' AND status = 'pending'
    AND source_event = 'DAILY_CLAIM_V12' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ghc_execute_daily_claim_v12(
  p_user_id text,
  p_claim_day_key date,
  p_cycle_day int,
  p_completed_cycles int,
  p_idempotency_key text,
  p_gross_amount numeric,
  p_user_amount numeric,
  p_reserve_amount numeric,
  p_base_gross numeric,
  p_m numeric,
  p_g numeric,
  p_economic_version text DEFAULT '1.2',
  p_missed_day_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak public.ghc_claim_streak_state%ROWTYPE;
  v_user_tx public.ghc_transactions%ROWTYPE;
  v_rsv_tx public.ghc_transactions%ROWTYPE;
  v_user_id uuid;
  v_rsv_id uuid;
  v_reserve_user text := '__PROTOCOL_RESERVE__';
  v_rsv_ref text;
  v_total int;
  v_meta jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_claim_day_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAY');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_IDEMPOTENCY');
  END IF;
  IF p_cycle_day IS NULL OR p_cycle_day < 1 OR p_cycle_day > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CYCLE_DAY');
  END IF;
  IF p_user_amount IS NULL OR p_user_amount <= 0 OR p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_reserve_amount IS NULL OR p_reserve_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_RESERVE');
  END IF;
  -- 80/20 integrity: user + reserve must equal gross within 0.0001
  IF abs((p_user_amount + p_reserve_amount) - p_gross_amount) > 0.0001 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SPLIT_MISMATCH');
  END IF;
  IF abs(p_user_amount - (p_gross_amount * 0.8)) > 0.0002 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_SHARE_MISMATCH');
  END IF;

  v_rsv_ref := p_idempotency_key || ':reserve';
  v_meta := jsonb_build_object(
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'claimDayKey', p_claim_day_key,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'baseGross', p_base_gross,
    'gross', p_gross_amount,
    'userAmount', p_user_amount,
    'pending', true,
    'redeemableAt', (now() + interval '48 hours'),
    'reserveAmount', p_reserve_amount,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'claimKind', 'DAILY_CLAIM_V12'
  );

  -- Lock streak row (create empty shell if missing so concurrent claims serialize)
  INSERT INTO public.ghc_claim_streak_state (
    user_id, cycle_day, completed_cycles, last_claim_day_key,
    total_successful_claims, economic_version, last_idempotency_key, updated_at
  ) VALUES (
    p_user_id, 0, 0, NULL, 0, COALESCE(p_economic_version, '1.2'), NULL, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.ghc_claim_streak_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Already claimed same day or same idempotency key → return existing ledger rows
  IF (v_streak.last_idempotency_key IS NOT NULL AND v_streak.last_idempotency_key = p_idempotency_key)
     OR (v_streak.last_claim_day_key IS NOT NULL AND v_streak.last_claim_day_key = p_claim_day_key) THEN
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id
      AND reference_id = COALESCE(v_streak.last_idempotency_key, p_idempotency_key)
      AND kind = 'earned'
      AND status IN ('pending', 'posted')
    ORDER BY CASE WHEN status = 'posted' THEN 0 ELSE 1 END
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_user_tx
      FROM public.ghc_transactions
      WHERE user_id = p_user_id
        AND reference_id = p_idempotency_key
        AND kind = 'earned'
        AND status IN ('pending', 'posted')
      ORDER BY CASE WHEN status = 'posted' THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    SELECT * INTO v_rsv_tx
    FROM public.ghc_transactions
    WHERE user_id = v_reserve_user
      AND reference_id = COALESCE(v_user_tx.reference_id, p_idempotency_key) || ':reserve'
      AND kind = 'earned'
      AND status = 'posted'
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', v_streak.cycle_day,
      'completedCycles', v_streak.completed_cycles,
      'lastClaimDayKey', v_streak.last_claim_day_key,
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'pending', COALESCE(v_user_tx.status = 'pending', true),
      'redeemableAt', COALESCE(v_user_tx.metadata->>'redeemableAt', (v_user_tx.created_at + interval '48 hours')::text),
      'reserveAmount', COALESCE(v_rsv_tx.amount, p_reserve_amount),
      'grossAmount', COALESCE((v_user_tx.metadata->>'gross')::numeric, p_gross_amount),
      'transactionId', v_user_tx.id,
      'reserveTransactionId', v_rsv_tx.id,
      'referenceId', COALESCE(v_user_tx.reference_id, p_idempotency_key),
      'm', COALESCE((v_user_tx.metadata->>'m')::numeric, p_m),
      'g', COALESCE((v_user_tx.metadata->>'g')::numeric, p_g),
      'economicVersion', COALESCE(v_user_tx.metadata->>'economicVersion', p_economic_version)
    );
  END IF;

  -- Insert user credit (unique index prevents double mint under race)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      p_user_id,
      'earned',
      p_user_amount,
      'pending',
      format('Daily claim day %s/7 (%s)', p_cycle_day, COALESCE(p_economic_version, '1.2')),
      'DAILY_CLAIM_V12',
      p_idempotency_key,
      v_meta || jsonb_build_object('claimedAt', now(), 'redeemableAt', now() + interval '48 hours', 'rewardLifecycle', 'daily_claim_48h'),
      NULL
    )
    RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent insert won — treat as idempotent success
    SELECT * INTO v_user_tx
    FROM public.ghc_transactions
    WHERE user_id = p_user_id AND reference_id = p_idempotency_key AND kind = 'earned' AND status IN ('pending', 'posted')
    ORDER BY CASE WHEN status = 'posted' THEN 0 ELSE 1 END
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'idempotent', true,
      'cycleDay', COALESCE(v_streak.cycle_day, p_cycle_day),
      'userAmount', COALESCE(v_user_tx.amount, p_user_amount),
      'pending', COALESCE(v_user_tx.status = 'pending', true),
      'redeemableAt', COALESCE(v_user_tx.metadata->>'redeemableAt', (v_user_tx.created_at + interval '48 hours')::text),
      'transactionId', v_user_tx.id,
      'referenceId', p_idempotency_key
    );
  END;

  -- Protocol reserve leg (non-spendable system account)
  BEGIN
    INSERT INTO public.ghc_transactions (
      user_id, kind, amount, status, reason, source_event, reference_id, metadata, posted_at
    ) VALUES (
      v_reserve_user,
      'earned',
      p_reserve_amount,
      'posted',
      format('Protocol reserve day %s/7', p_cycle_day),
      'PROTOCOL_RESERVE_V12',
      v_rsv_ref,
      v_meta || jsonb_build_object('forUserId', p_user_id),
      now()
    )
    RETURNING id INTO v_rsv_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_rsv_id FROM public.ghc_transactions
    WHERE user_id = v_reserve_user AND reference_id = v_rsv_ref AND status = 'posted'
    LIMIT 1;
  END;

  -- Commit streak only after ledger legs succeed (same transaction)
  v_total := COALESCE(v_streak.total_successful_claims, 0) + 1;
  UPDATE public.ghc_claim_streak_state
  SET
    cycle_day = p_cycle_day,
    completed_cycles = GREATEST(COALESCE(p_completed_cycles, 0), 0),
    last_claim_day_key = p_claim_day_key,
    total_successful_claims = v_total,
    economic_version = COALESCE(p_economic_version, '1.2'),
    last_idempotency_key = p_idempotency_key,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'idempotent', false,
    'cycleDay', p_cycle_day,
    'completedCycles', GREATEST(COALESCE(p_completed_cycles, 0), 0),
    'lastClaimDayKey', p_claim_day_key,
    'totalSuccessfulClaims', v_total,
    'userAmount', p_user_amount,
    'reserveAmount', p_reserve_amount,
    'grossAmount', p_gross_amount,
    'baseGross', p_base_gross,
    'm', p_m,
    'g', p_g,
    'missedDayReset', COALESCE(p_missed_day_reset, false),
    'economicVersion', COALESCE(p_economic_version, '1.2'),
    'transactionId', v_user_id,
    'reserveTransactionId', v_rsv_id,
    'referenceId', p_idempotency_key
  );
END;
$$;


REVOKE ALL ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) TO service_role;

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
    -- If the caller retries with the original pending-row ID after redemption,
    -- resolve its reference to the already-posted wallet credit.
    SELECT * INTO v_pending
    FROM public.ghc_transactions
    WHERE user_id = p_user_id AND id::text = p_hold_id
      AND status = 'expired' AND source_event = 'DAILY_CLAIM_V12'
    LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_posted FROM public.ghc_transactions
      WHERE user_id = p_user_id AND reference_id = v_pending.reference_id
        AND kind = 'earned' AND status = 'posted'
      LIMIT 1;
      IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true,
          'transactionId', v_posted.id, 'amount', v_posted.amount,
          'referenceId', v_posted.reference_id);
      END IF;
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CLAIMABLE');
  END IF;

  IF COALESCE((v_pending.metadata->>'reviewRequired')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNDER_REVIEW');
  END IF;

  -- Daily Claim entitlements have a fixed 48-hour lock. Legacy pending
  -- records from other sources retain their existing redemption semantics;
  -- Phase 3 separately disables new non-Daily-Claim issuance paths.
  IF COALESCE(v_pending.source_event, '') = 'DAILY_CLAIM_V12' THEN
    IF COALESCE(v_pending.metadata->>'claimKind', '') <> 'DAILY_CLAIM_V12' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DAILY_CLAIM_METADATA');
    END IF;
    IF now() < v_pending.created_at + interval '48 hours' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'NOT_YET_REDEEMABLE',
        'redeemableAt', (v_pending.created_at + interval '48 hours')
      );
    END IF;
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
    jsonb_build_object('fromPending', v_pending.id, 'claimedBy', p_user_id, 'claimKind', 'DAILY_CLAIM_V12', 'redeemedAt', now()),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'transactionId', v_new_id,
    'amount', v_pending.amount,
    'redeemableAt', v_pending.created_at + interval '48 hours',
    'referenceId', v_ref
  );
END;
$$;


REVOKE ALL ON FUNCTION public.ghc_claim_pending(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_claim_pending(text, text) TO service_role;

-- ============================================================================
-- SOURCE 077: 20261022010077_ghc_daily_claim_only_issuance.sql
-- SHA256: 4a457125d3699c19b07ba48bb66407f32c919047d3b4b054b2b1f0157183bbfc
-- ============================================================================
-- Phase 6: Daily Claim is the only permitted source of new user-available GHC.
-- Transfers remain redistribution. Existing ledger history is not rewritten.
-- Apply to TESTNET only after migration-history/schema reconciliation and review.

CREATE OR REPLACE FUNCTION public.ghc_enforce_daily_claim_only_issuance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event text := upper(trim(coalesce(NEW.source_event, '')));
  v_kind text := lower(trim(coalesce(NEW.kind, '')));
  v_status text := lower(trim(coalesce(NEW.status, '')));
  v_metadata jsonb := coalesce(NEW.metadata, '{}'::jsonb);
BEGIN
  -- Updates that do not post a transaction (for example expiring an old pending
  -- entitlement) do not create spendable value and must remain possible.
  IF TG_OP = 'UPDATE' AND v_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  -- Non-positive ledger entries are not issuance. Negative compensating entries
  -- remain auditable; spend/transfer-out records retain their existing semantics.
  IF coalesce(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Existing GHC may move between users only through the atomic transfer RPC.
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event = 'WALLET_TRANSFER'
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.ghc_transactions AS debit
       WHERE debit.kind = 'transfer_out'
         AND debit.status = 'posted'
         AND debit.source_event = 'WALLET_TRANSFER'
         AND debit.reference_id = NEW.reference_id
         AND debit.user_id = NEW.counterparty_id
         AND debit.counterparty_id = NEW.user_id
         AND debit.amount = -NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Daily Claim entitlement must be staged with the 48-hour lifecycle metadata.
  IF v_kind = 'earned'
     AND v_event = 'DAILY_CLAIM_V12'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND (
       (v_status = 'pending' AND v_metadata->>'rewardLifecycle' = 'daily_claim_48h')
       OR (v_status = 'posted' AND v_metadata->>'claimKind' = 'DAILY_CLAIM_V12')
     ) THEN
    RETURN NEW;
  END IF;

  -- The reserve leg is part of the same Daily Claim protocol operation and is
  -- not user-available wallet value. It must remain on the dedicated reserve ID.
  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'PROTOCOL_RESERVE_V12'
     AND NEW.user_id = '__PROTOCOL_RESERVE__'
     AND nullif(v_metadata->>'forUserId', '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'GHC_ISSUANCE_POLICY_VIOLATION',
    DETAIL = 'Only Daily Claim may issue new user GHC; positive ledger credits outside the approved claim or transfer paths are blocked.';
END;
$$;

DROP TRIGGER IF EXISTS ghc_daily_claim_only_issuance_guard ON public.ghc_transactions;
CREATE TRIGGER ghc_daily_claim_only_issuance_guard
BEFORE INSERT OR UPDATE OF amount, kind, status, source_event, user_id
ON public.ghc_transactions
FOR EACH ROW
EXECUTE FUNCTION public.ghc_enforce_daily_claim_only_issuance();

REVOKE ALL ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() TO service_role;

-- Generic staged activity/achievement/referral rewards are no longer callable
-- from the application service role. The trigger above remains the database-level
-- safety net for existing SECURITY DEFINER functions and direct privileged paths.
DO $$
BEGIN
  IF to_regprocedure('public.ghc_stage_pending(text,numeric,text,text,text,text,integer,bigint,integer,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.ghc_stage_pending(text,numeric,text,text,text,text,integer,bigint,integer,text) FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END;
$$;

-- Preserve curation voting, but turn off the reward side effect without making
-- a vote fail. The existing atomic wrapper receives an explicit non-credit result.
CREATE OR REPLACE FUNCTION public.ghc_curation_reward_credit(
  p_user_id text,
  p_post_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'credited', false,
    'amount', 0,
    'status', 'disabled',
    'reason', 'GHC_ISSUANCE_POLICY_LOCKED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) TO service_role;

COMMENT ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() IS
  'Phase 6 ledger guard: permits Daily Claim 48-hour entitlements, the protocol reserve leg, and atomic wallet transfers; blocks other positive credits.';
COMMENT ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) IS
  'GHC curation rewards are disabled under the Daily-Claim-only issuance policy; curation votes remain available.';

-- ============================================================================
-- SOURCE 078: 20261022010078_atomic_membership_purchase.sql
-- SHA256: e6d4eefeb0cca38ec234fb645973d31de13a0748d202c99590ef9d3bd4b8a49d
-- ============================================================================
-- Atomically spend GHC and persist the corresponding membership entitlement.
-- Requires the existing ghc_execute_spend and ghc_membership_upsert RPCs.
CREATE OR REPLACE FUNCTION public.ghc_purchase_membership(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text,
  p_row jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend jsonb;
  v_row jsonb;
  v_existing public.ghc_membership_entitlements%ROWTYPE;
  v_upsert jsonb;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_PURCHASE');
  END IF;
  IF p_row->>'user_id' IS DISTINCT FROM p_user_id
     OR p_row->>'purchase_ref' IS DISTINCT FROM p_reference_id
     OR p_row->>'tier' NOT IN ('vip', 'vvip')
     OR p_row->>'billing_period' NOT IN ('monthly', 'four_months', 'eight_months', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_ENTITLEMENT');
  END IF;

  -- A committed purchase replay returns the existing entitlement without spending again.
  SELECT * INTO v_existing
  FROM public.ghc_membership_entitlements
  WHERE user_id = p_user_id
  LIMIT 1;
  IF FOUND AND v_existing.purchase_ref = p_reference_id THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true,
      'spend', jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', p_reference_id),
      'entitlement', to_jsonb(v_existing));
  END IF;

  -- Both nested RPC operations run in this transaction; an entitlement write failure
  -- rolls back the ledger debit too.
  v_spend := public.ghc_execute_spend(
    p_user_id, p_amount, p_reference_id, p_reason, 'PREMIUM_PURCHASE'
  );
  IF coalesce((v_spend->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_spend;
  END IF;
  IF coalesce((v_spend->>'idempotent')::boolean, false) IS TRUE THEN
    -- An old debit without its matching entitlement must be reconciled by support;
    -- never turn an orphaned debit into a second grant on retry.
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED');
  END IF;

  v_row := p_row || jsonb_build_object(
    'updated_at', v_now,
    'audit', coalesce(v_existing.audit, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', floor(extract(epoch from v_now) * 1000),
      'action', 'GRANT',
      'detail', concat(p_row->>'tier', '/', p_row->>'billing_period', '/ghc')
    ))
  );
  v_upsert := public.ghc_membership_upsert(v_row);
  IF coalesce((v_upsert->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'MEMBERSHIP_ENTITLEMENT_WRITE_FAILED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'spend', v_spend,
    'entitlement', v_row
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_purchase_membership(text, numeric, text, text, jsonb) TO service_role;

-- ============================================================================
-- SOURCE 079: 20261022010079_atomic_marketplace_inventory_reservation.sql
-- SHA256: fa4f9d16612fd3b89d3f2feb24e1318a963e81d85b0582e0ccab7123f0b4ec9d
-- ============================================================================
-- Atomic marketplace inventory reservation and idempotent order creation.
-- Apply only after reconciling this migration against the target environment.

ALTER TABLE public.gh_marketplace_orders
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_buyer_request
  ON public.gh_marketplace_orders (buyer_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- A completed Pi intent may settle at most one marketplace order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_market_orders_payment_intent
  ON public.gh_marketplace_orders (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_stock_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' AND COALESCE(OLD.stock_reserved, 0) > 0 THEN
    UPDATE public.gh_marketplace_listings
       SET availability = availability + OLD.stock_reserved,
           status = CASE WHEN status = 'sold_out' THEN 'active' ELSE status END,
           updated_at = now()
     WHERE id = OLD.listing_id;
    NEW.stock_reserved := 0;
    NEW.audit := COALESCE(NEW.audit, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'STOCK_RESERVATION_RELEASED', 'detail', 'order_cancelled')
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'payment_verified' AND COALESCE(OLD.stock_reserved, 0) > 0 THEN
    -- Payment has been verified: stock is committed to this order, not released.
    NEW.stock_reserved := 0;
    NEW.reservation_expires_at := NULL;
    NEW.payment_claimed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gh_marketplace_order_stock_transition ON public.gh_marketplace_orders;
CREATE TRIGGER trg_gh_marketplace_order_stock_transition
BEFORE UPDATE OF status ON public.gh_marketplace_orders
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.gh_marketplace_order_stock_transition();

CREATE OR REPLACE FUNCTION public.gh_marketplace_release_expired_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.gh_marketplace_orders
     SET status = 'cancelled',
         payment_status = 'failed',
         updated_at = now(),
         cancelled_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'RESERVATION_EXPIRED')
         )
   WHERE status IN ('created', 'payment_pending')
     AND payment_status IN ('none', 'pending')
     AND stock_reserved > 0
     AND payment_claimed_at IS NULL
     AND reservation_expires_at IS NOT NULL
     AND reservation_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'releasedOrders', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_create_reserved(
  p_row jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_row->>'id', ''));
  v_listing_id text := trim(COALESCE(p_row->>'listingId', ''));
  v_buyer text := trim(COALESCE(p_row->>'buyerId', ''));
  v_key text := trim(COALESCE(p_idempotency_key, ''));
  v_qty integer := COALESCE((p_row->>'quantity')::integer, 0);
  v_listing public.gh_marketplace_listings%ROWTYPE;
  v_existing public.gh_marketplace_orders%ROWTYPE;
  v_order public.gh_marketplace_orders%ROWTYPE;
  v_total numeric(18,8);
BEGIN
  IF v_id = '' OR v_listing_id = '' OR v_buyer = '' OR length(v_key) < 8 OR length(v_key) > 128
     OR v_key !~ '^[A-Za-z0-9._:-]+$' OR v_qty < 1 OR v_qty > 99 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM public.gh_marketplace_release_expired_reservations();

  SELECT * INTO v_existing
    FROM public.gh_marketplace_orders
   WHERE buyer_id = v_buyer AND client_request_id = v_key;
  IF FOUND THEN
    IF v_existing.listing_id <> v_listing_id OR v_existing.quantity <> v_qty THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order', jsonb_build_object(
      'id', v_existing.id, 'listingId', v_existing.listing_id, 'listingTitle', v_existing.listing_title,
      'buyerId', v_existing.buyer_id, 'sellerId', v_existing.seller_id, 'quantity', v_existing.quantity,
      'unitPrice', v_existing.unit_price, 'currency', v_existing.currency, 'totalAmount', v_existing.total_amount,
      'status', v_existing.status, 'paymentMethod', v_existing.payment_method, 'paymentStatus', v_existing.payment_status,
      'paymentIntentId', v_existing.payment_intent_id, 'paymentId', v_existing.payment_id, 'txid', v_existing.txid,
      'ghcSpendRef', v_existing.ghc_spend_ref, 'audit', v_existing.audit,
      'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'updatedAt', extract(epoch from v_existing.updated_at) * 1000,
      'confirmedAt', CASE WHEN v_existing.confirmed_at IS NULL THEN NULL ELSE extract(epoch from v_existing.confirmed_at) * 1000 END,
      'fulfilledAt', CASE WHEN v_existing.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from v_existing.fulfilled_at) * 1000 END,
      'completedAt', CASE WHEN v_existing.completed_at IS NULL THEN NULL ELSE extract(epoch from v_existing.completed_at) * 1000 END,
      'cancelledAt', CASE WHEN v_existing.cancelled_at IS NULL THEN NULL ELSE extract(epoch from v_existing.cancelled_at) * 1000 END,
      'reservationExpiresAt', CASE WHEN v_existing.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from v_existing.reservation_expires_at) * 1000 END
    ));
  END IF;

  SELECT * INTO v_listing FROM public.gh_marketplace_listings WHERE id = v_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'LISTING_NOT_FOUND'); END IF;
  IF v_listing.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'LISTING_UNAVAILABLE'); END IF;
  IF upper(v_listing.currency) NOT IN ('GHC', 'PI') THEN RETURN jsonb_build_object('ok', false, 'error', 'UNSUPPORTED_CURRENCY'); END IF;
  IF v_listing.seller_id = v_buyer THEN RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_BUY_OWN'); END IF;
  IF v_listing.availability < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_STOCK', 'available', v_listing.availability);
  END IF;
  IF v_listing.price < 0 OR v_listing.price IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_LISTING_PRICE'); END IF;

  v_total := round(v_listing.price * v_qty, 8);
  UPDATE public.gh_marketplace_listings
     SET availability = availability - v_qty,
         status = CASE WHEN availability - v_qty = 0 THEN 'sold_out' ELSE status END,
         updated_at = now()
   WHERE id = v_listing_id;

  INSERT INTO public.gh_marketplace_orders (
    id, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price, currency, total_amount,
    status, payment_method, payment_status, audit, created_at, updated_at, client_request_id,
    stock_reserved, reservation_expires_at
  ) VALUES (
    v_id, v_listing.id, left(v_listing.title, 200), v_buyer, v_listing.seller_id, v_qty,
    v_listing.price, upper(v_listing.currency), v_total, 'payment_pending', 'none', 'pending',
    jsonb_build_array(jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'CREATED_AND_STOCK_RESERVED', 'detail', v_buyer)),
    now(), now(), v_key, v_qty, now() + interval '15 minutes'
  ) RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'order', jsonb_build_object(
    'id', v_order.id, 'listingId', v_order.listing_id, 'listingTitle', v_order.listing_title,
    'buyerId', v_order.buyer_id, 'sellerId', v_order.seller_id, 'quantity', v_order.quantity,
    'unitPrice', v_order.unit_price, 'currency', v_order.currency, 'totalAmount', v_order.total_amount,
    'status', v_order.status, 'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.payment_status,
    'audit', v_order.audit, 'createdAt', extract(epoch from v_order.created_at) * 1000,
    'updatedAt', extract(epoch from v_order.updated_at) * 1000,
    'reservationExpiresAt', extract(epoch from v_order.reservation_expires_at) * 1000
  ));
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.gh_marketplace_orders WHERE buyer_id = v_buyer AND client_request_id = v_key;
  IF FOUND AND v_existing.listing_id = v_listing_id AND v_existing.quantity = v_qty THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order', jsonb_build_object(
      'id', v_existing.id, 'listingId', v_existing.listing_id, 'listingTitle', v_existing.listing_title,
      'buyerId', v_existing.buyer_id, 'sellerId', v_existing.seller_id, 'quantity', v_existing.quantity,
      'unitPrice', v_existing.unit_price, 'currency', v_existing.currency, 'totalAmount', v_existing.total_amount,
      'status', v_existing.status, 'paymentMethod', v_existing.payment_method, 'paymentStatus', v_existing.payment_status,
      'audit', v_existing.audit, 'createdAt', extract(epoch from v_existing.created_at) * 1000,
      'updatedAt', extract(epoch from v_existing.updated_at) * 1000,
      'reservationExpiresAt', CASE WHEN v_existing.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from v_existing.reservation_expires_at) * 1000 END
    ));
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT');
END;
$$;

-- Claim a live reservation before any external or ledger payment operation.
-- A claimed reservation is excluded from automatic expiry until payment succeeds or
-- the application explicitly releases the claim after a definite payment failure.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_claim_payment(
  p_order_id text,
  p_buyer_id text,
  p_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_method text := lower(trim(COALESCE(p_method, '')));
BEGIN
  IF trim(COALESCE(p_order_id, '')) = '' OR trim(COALESCE(p_buyer_id, '')) = ''
     OR v_method NOT IN ('ghc', 'pi') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF r.buyer_id <> p_buyer_id THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  IF upper(r.currency) <> upper(v_method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_CURRENCY_MISMATCH');
  END IF;
  IF r.status NOT IN ('created', 'payment_pending') OR r.payment_status NOT IN ('none', 'pending')
     OR COALESCE(r.stock_reserved, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_PAYABLE');
  END IF;
  IF r.reservation_expires_at IS NULL OR r.reservation_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESERVATION_EXPIRED');
  END IF;
  IF r.payment_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENT_IN_PROGRESS');
  END IF;

  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = now(), updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'PAYMENT_CLAIMED', 'detail', v_method)
         )
   WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'claimed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_order_release_payment_claim(
  p_order_id text,
  p_buyer_id text,
  p_detail text DEFAULT 'payment_failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = NULL, updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'action', 'PAYMENT_CLAIM_RELEASED', 'detail', left(COALESCE(p_detail, 'payment_failed'), 120))
         )
   WHERE id = p_order_id AND buyer_id = p_buyer_id
     AND status IN ('created', 'payment_pending')
     AND payment_status IN ('none', 'pending')
     AND payment_claimed_at IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'CLAIM_NOT_FOUND'); END IF;
  RETURN jsonb_build_object('ok', true, 'released', true);
END;
$$;

-- Order reads also release expired holds before returning current durable state.
CREATE OR REPLACE FUNCTION public.gh_marketplace_order_get(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.gh_marketplace_orders%ROWTYPE;
BEGIN
  PERFORM public.gh_marketplace_release_expired_reservations();
  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id, 'listingId', r.listing_id, 'listingTitle', r.listing_title,
    'buyerId', r.buyer_id, 'sellerId', r.seller_id, 'quantity', r.quantity,
    'unitPrice', r.unit_price, 'currency', r.currency, 'totalAmount', r.total_amount,
    'status', r.status, 'paymentMethod', r.payment_method, 'paymentStatus', r.payment_status,
    'paymentIntentId', r.payment_intent_id, 'paymentId', r.payment_id, 'txid', r.txid,
    'ghcSpendRef', r.ghc_spend_ref, 'audit', r.audit,
    'createdAt', extract(epoch from r.created_at) * 1000,
    'updatedAt', extract(epoch from r.updated_at) * 1000,
    'confirmedAt', CASE WHEN r.confirmed_at IS NULL THEN NULL ELSE extract(epoch from r.confirmed_at) * 1000 END,
    'fulfilledAt', CASE WHEN r.fulfilled_at IS NULL THEN NULL ELSE extract(epoch from r.fulfilled_at) * 1000 END,
    'completedAt', CASE WHEN r.completed_at IS NULL THEN NULL ELSE extract(epoch from r.completed_at) * 1000 END,
    'cancelledAt', CASE WHEN r.cancelled_at IS NULL THEN NULL ELSE extract(epoch from r.cancelled_at) * 1000 END,
    'reservationExpiresAt', CASE WHEN r.reservation_expires_at IS NULL THEN NULL ELSE extract(epoch from r.reservation_expires_at) * 1000 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_order_stock_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_release_expired_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_claim_payment(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_marketplace_order_release_payment_claim(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_release_expired_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_create_reserved(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_claim_payment(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_release_payment_claim(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role;

-- ============================================================================
-- SOURCE 080: 20261022010080_gh_engagement_rosters.sql
-- SHA256: 1a7d05a7af000a4e9da187ddde05db08ffccb623bd52f601735809f14920c6b7
-- ============================================================================
-- Engagement rosters: who reacted / voted / viewed posts & stories.
-- Owner-gated for views & curation; authenticated readers for like roster when post is visible.
-- No economy / GHC minting.

-- ---------------------------------------------------------------------------
-- Reactions roster (gh_post_reactions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_reactions(
  p_actor_id text,
  p_post_id text,
  p_reaction text DEFAULT 'like',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_actor text := trim(COALESCE(p_actor_id, ''));
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  IF v_actor = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  -- Keep the roster no more visible than the post itself.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_actor AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_actor)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' OR v_author = v_actor THEN
    NULL;
  ELSIF v_visibility = 'followers' AND EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = v_actor AND f.following_id = v_author
  ) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      r.reaction AS "reaction",
      (extract(epoch from r.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_reactions r
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = r.user_id
    WHERE r.post_id = p_post_id
      AND (v_reaction = '' OR r.reaction = v_reaction)
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'reaction', v_reaction,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Curation votes roster (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_votes(
  p_actor_id text,
  p_post_id text,
  p_choice text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_choice text := lower(trim(COALESCE(p_choice, '')));
  v_author text;
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  -- Owner-only: who upvoted/downvoted is sensitive curation signal
  IF v_author IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_post_curations'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'CURATION_TABLE_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      v.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      v.choice AS "choice",
      (extract(epoch from v.updated_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_curations v
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = v.user_id
    WHERE v.post_id = p_post_id
      AND v.choice IN ('upvote', 'downvote')
      AND (v_choice = '' OR v.choice = v_choice)
    ORDER BY v.updated_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'choice', NULLIF(v_choice, ''),
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_votes(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_votes(text, text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Post viewers (owner only) — from gh_content_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_post_viewers(
  p_actor_id text,
  p_post_id text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_author text;
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  SELECT author_id INTO v_author FROM public.gh_posts WHERE id = p_post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_content_events'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'EVENTS_TABLE_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."lastViewedAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      e.actor_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      (extract(epoch from max(e.created_at))*1000)::bigint AS "lastViewedAt",
      count(*)::int AS "viewEvents"
    FROM public.gh_content_events e
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = e.actor_id
    WHERE e.content_id = p_post_id
      AND e.content_kind = 'post'
      AND e.event_type IN ('view', 'qualified_view')
      AND e.actor_id IS DISTINCT FROM v_author
    GROUP BY e.actor_id, pr.display_name, pr.username, pr.photos
    ORDER BY max(e.created_at) DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_viewers(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_viewers(text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Story viewers (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gh_list_story_viewers(
  p_actor_id text,
  p_story_id text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_owner text;
  v_rows jsonb;
BEGIN
  IF p_story_id IS NULL OR length(trim(p_story_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STORY');
  END IF;
  SELECT owner_id INTO v_owner FROM public.gh_stories WHERE id = p_story_id;
  IF NOT FOUND THEN
    -- try alternate column names
    BEGIN
      SELECT user_id INTO v_owner FROM public.gh_stories WHERE id = p_story_id;
    EXCEPTION WHEN undefined_column THEN
      v_owner := NULL;
    END;
  END IF;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_owner IS DISTINCT FROM trim(COALESCE(p_actor_id, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gh_story_views'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'users', '[]'::jsonb, 'message', 'STORY_VIEWS_MISSING');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."viewedAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      sv.viewer_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      (extract(epoch from sv.viewed_at)*1000)::bigint AS "viewedAt"
    FROM public.gh_story_views sv
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = sv.viewer_id
    WHERE sv.story_id = p_story_id
    ORDER BY sv.viewed_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'storyId', p_story_id,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_story_viewers(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_story_viewers(text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Comment emoji reactions (cross-account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gh_comment_reactions (
  comment_id   text NOT NULL,
  post_id      text NOT NULL,
  user_id      text NOT NULL,
  emoji        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_gh_comment_reactions_post
  ON public.gh_comment_reactions (post_id, created_at DESC);

ALTER TABLE public.gh_comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_comment_reactions_no_client ON public.gh_comment_reactions;
CREATE POLICY gh_comment_reactions_no_client ON public.gh_comment_reactions
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_comment_reaction_toggle(
  p_post_id text,
  p_comment_id text,
  p_user_id text,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := left(trim(COALESCE(p_emoji, '')), 16);
  v_active boolean;
  v_counts jsonb;
BEGIN
  IF p_post_id IS NULL OR p_comment_id IS NULL OR p_user_id IS NULL OR v_emoji = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments
    WHERE id = p_comment_id AND post_id = p_post_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = p_user_id AND emoji = v_emoji
  ) THEN
    DELETE FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = p_user_id AND emoji = v_emoji;
    v_active := false;
  ELSE
    INSERT INTO public.gh_comment_reactions (comment_id, post_id, user_id, emoji)
    VALUES (p_comment_id, p_post_id, p_user_id, v_emoji)
    ON CONFLICT DO NOTHING;
    v_active := true;
  END IF;

  SELECT COALESCE(jsonb_object_agg(emoji, cnt), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT emoji, count(*)::int AS cnt
    FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id
    GROUP BY emoji
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'active', v_active,
    'emoji', v_emoji,
    'counts', v_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_reaction_list(
  p_comment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT emoji, user_id AS "userId"
    FROM public.gh_comment_reactions
    WHERE comment_id = p_comment_id
  ) q;
  RETURN jsonb_build_object('ok', true, 'reactions', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_reaction_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_list(text) TO service_role;

-- ============================================================================
-- SOURCE 081: 20261022010081_marketplace_stale_payment_claim_recovery.sql
-- SHA256: 0e9d95bd2c8b46a4e0a6d7468f6fd3c3c00729266e495adcb9a764d4af6d73b2
-- ============================================================================
-- Stage 2.1 — Stale marketplace payment-claim recovery (operator / service_role only).
-- Does NOT complete payments. Does NOT mint GHC.
-- Allows releasing a payment claim that has been held too long so expiry can proceed
-- after human/ops confirmation that payment failed or was never captured.

-- List stuck claims (read-only inspection)
CREATE OR REPLACE FUNCTION public.gh_marketplace_list_stale_payment_claims(
  p_older_than_minutes integer DEFAULT 60,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_minutes integer := LEAST(GREATEST(COALESCE(p_older_than_minutes, 60), 5), 10080);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."claimedAt" ASC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      o.id AS "orderId",
      o.buyer_id AS "buyerId",
      o.listing_id AS "listingId",
      o.status,
      o.payment_status AS "paymentStatus",
      o.currency,
      (extract(epoch from o.payment_claimed_at) * 1000)::bigint AS "claimedAt",
      (extract(epoch from o.reservation_expires_at) * 1000)::bigint AS "reservationExpiresAt",
      o.stock_reserved AS "stockReserved"
    FROM public.gh_marketplace_orders o
    WHERE o.payment_claimed_at IS NOT NULL
      AND o.payment_claimed_at <= now() - make_interval(mins => v_minutes)
      AND o.status IN ('created', 'payment_pending')
      AND COALESCE(o.stock_reserved, 0) > 0
    ORDER BY o.payment_claimed_at ASC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'olderThanMinutes', v_minutes,
    'orders', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_list_stale_payment_claims(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_list_stale_payment_claims(integer, integer) TO service_role;

-- Force-release a single stale claim after ops confirmed payment is not in flight.
-- Requires claim age >= p_min_age_minutes (default 60).
CREATE OR REPLACE FUNCTION public.gh_marketplace_force_release_stale_payment_claim(
  p_order_id text,
  p_operator_note text DEFAULT 'ops_stale_claim_release',
  p_min_age_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.gh_marketplace_orders%ROWTYPE;
  v_min integer := LEAST(GREATEST(COALESCE(p_min_age_minutes, 60), 5), 10080);
  v_note text := left(trim(COALESCE(p_operator_note, 'ops_stale_claim_release')), 160);
BEGIN
  IF trim(COALESCE(p_order_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ORDER');
  END IF;

  SELECT * INTO r FROM public.gh_marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF r.payment_claimed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_CLAIM');
  END IF;
  IF r.payment_claimed_at > now() - make_interval(mins => v_min) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CLAIM_TOO_RECENT',
      'minAgeMinutes', v_min
    );
  END IF;
  -- Do not touch paid / fulfilled orders
  IF r.payment_status IN ('paid', 'completed') OR r.status IN ('paid', 'fulfilled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ORDER_ALREADY_SETTLED');
  END IF;

  UPDATE public.gh_marketplace_orders
     SET payment_claimed_at = NULL,
         updated_at = now(),
         audit = COALESCE(audit, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'at', (extract(epoch from now()) * 1000)::bigint,
             'action', 'STALE_PAYMENT_CLAIM_FORCE_RELEASE',
             'detail', v_note
           )
         )
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'orderId', p_order_id,
    'released', true,
    'note', v_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim(text, text, integer) TO service_role;

COMMENT ON FUNCTION public.gh_marketplace_force_release_stale_payment_claim IS
  'Ops-only: clear stale payment_claimed_at after min age. Does not mark paid or release stock by itself; expiry worker may run after.';

-- ============================================================================
-- SOURCE 082: 20261022010082_membership_orphaned_purchase_recovery.sql
-- SHA256: 84681eefbcefd3d2c63d849f752956ef480104fc15eb0d1ae484f1c8ab54c968
-- ============================================================================
-- Stage 2.2 — Membership orphaned purchase recovery (service_role / ops only).
-- Completes entitlement when a PREMIUM_PURCHASE ledger debit already exists for the
-- reference but entitlement was never written (MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED).
-- Does NOT call ghc_execute_spend. Does NOT mint GHC.

CREATE OR REPLACE FUNCTION public.ghc_membership_complete_orphaned_purchase(
  p_user_id text,
  p_reference_id text,
  p_row jsonb,
  p_operator_note text DEFAULT 'ops_orphan_entitlement_complete'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ghc_membership_entitlements%ROWTYPE;
  v_debit public.ghc_transactions%ROWTYPE;
  v_upsert jsonb;
  v_now timestamptz := now();
  v_row jsonb;
  v_note text := left(trim(COALESCE(p_operator_note, 'ops_orphan_entitlement_complete')), 160);
  v_amount numeric;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = ''
     OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  IF p_row->>'user_id' IS DISTINCT FROM p_user_id
     OR p_row->>'purchase_ref' IS DISTINCT FROM p_reference_id
     OR p_row->>'tier' NOT IN ('vip', 'vvip')
     OR p_row->>'billing_period' NOT IN ('monthly', 'four_months', 'eight_months', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MEMBERSHIP_ENTITLEMENT');
  END IF;

  -- Already reconciled
  SELECT * INTO v_existing
  FROM public.ghc_membership_entitlements
  WHERE user_id = p_user_id
  LIMIT 1;
  IF FOUND AND v_existing.purchase_ref = p_reference_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'entitlement', to_jsonb(v_existing)
    );
  END IF;

  -- Require an existing posted PREMIUM_PURCHASE debit for this reference (no new spend)
  SELECT * INTO v_debit
  FROM public.ghc_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND status = 'posted'
    AND kind = 'spent'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_MATCHING_DEBIT');
  END IF;

  -- Amount in row must match debit when provided
  IF p_row ? 'amount_ghc' THEN
    BEGIN
      v_amount := (p_row->>'amount_ghc')::numeric;
      IF abs(v_amount - v_debit.amount) > 0.0001 THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'AMOUNT_MISMATCH',
          'debitAmount', v_debit.amount
        );
      END IF;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT_IN_ROW');
    END;
  END IF;

  v_row := p_row || jsonb_build_object(
    'updated_at', v_now,
    'audit', coalesce(v_existing.audit, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'at', floor(extract(epoch from v_now) * 1000),
        'action', 'ORPHAN_PURCHASE_COMPLETE',
        'detail', v_note
      )
    )
  );

  v_upsert := public.ghc_membership_upsert(v_row);
  IF coalesce((v_upsert->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'MEMBERSHIP_ENTITLEMENT_WRITE_FAILED',
      'upsert', v_upsert
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reconciled', true,
    'referenceId', p_reference_id,
    'debitId', v_debit.id,
    'entitlement', v_row
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_membership_complete_orphaned_purchase(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_membership_complete_orphaned_purchase(text, text, jsonb, text) TO service_role;

COMMENT ON FUNCTION public.ghc_membership_complete_orphaned_purchase IS
  'Ops-only: grant membership entitlement when ledger debit already posted for reference. Never spends again.';

-- Read-only: find spend posts without matching purchase_ref entitlement (heuristic)
CREATE OR REPLACE FUNCTION public.ghc_membership_list_orphan_purchase_candidates(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      t.user_id AS "userId",
      t.reference_id AS "referenceId",
      t.amount,
      t.id AS "debitId",
      (extract(epoch from t.created_at) * 1000)::bigint AS "createdAt"
    FROM public.ghc_transactions t
    WHERE t.kind = 'spent'
      AND t.status = 'posted'
      AND t.reference_id IS NOT NULL
      AND (
        t.source_event ILIKE '%PREMIUM%'
        OR t.reason ILIKE '%membership%'
        OR t.reason ILIKE '%premium%'
        OR t.reason ILIKE '%vip%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ghc_membership_entitlements e
        WHERE e.user_id = t.user_id
          AND e.purchase_ref = t.reference_id
      )
    ORDER BY t.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'candidates', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_membership_list_orphan_purchase_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_membership_list_orphan_purchase_candidates(integer) TO service_role;

-- ============================================================================
-- SOURCE 083: 20261022010083_transfer_pair_orphan_recovery.sql
-- SHA256: e9c6202b5587b15acb3c59482cc1ced82bdda846148145e53ecee5afc302bd14
-- ============================================================================
-- Stage 2.3 — Transfer pair integrity (ops / service_role only).
-- ghc_execute_transfer writes debit+credit in one transaction; orphans should be rare.
-- These RPCs support inspection and safe completion of a missing transfer_in only.
-- Does NOT mint net-new GHC beyond completing an already-debited transfer_out.

CREATE OR REPLACE FUNCTION public.ghc_list_orphan_transfer_outs(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      t.id AS "debitId",
      t.user_id AS "senderId",
      t.counterparty_id AS "recipientId",
      abs(t.amount) AS amount,
      t.reference_id AS "referenceId",
      (extract(epoch from t.created_at) * 1000)::bigint AS "createdAt"
    FROM public.ghc_transactions t
    WHERE t.kind = 'transfer_out'
      AND t.status = 'posted'
      AND t.reference_id IS NOT NULL
      AND t.counterparty_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ghc_transactions i
        WHERE i.kind = 'transfer_in'
          AND i.status = 'posted'
          AND i.reference_id = t.reference_id
          AND i.user_id = t.counterparty_id
      )
    ORDER BY t.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'orphans', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_list_orphan_transfer_outs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_list_orphan_transfer_outs(integer) TO service_role;

-- Complete missing transfer_in for an existing posted transfer_out (no second debit).
CREATE OR REPLACE FUNCTION public.ghc_complete_orphan_transfer_in(
  p_reference_id text,
  p_operator_note text DEFAULT 'ops_complete_orphan_transfer_in'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out public.ghc_transactions%ROWTYPE;
  v_in public.ghc_transactions%ROWTYPE;
  v_credit_id uuid;
  v_now timestamptz := now();
  v_note text := left(trim(COALESCE(p_operator_note, 'ops_complete_orphan_transfer_in')), 160);
  v_amount numeric;
BEGIN
  IF p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;

  SELECT * INTO v_out
  FROM public.ghc_transactions
  WHERE kind = 'transfer_out'
    AND status = 'posted'
    AND reference_id = p_reference_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_TRANSFER_OUT');
  END IF;

  IF v_out.counterparty_id IS NULL OR btrim(v_out.counterparty_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MISSING_COUNTERPARTY');
  END IF;

  v_amount := abs(v_out.amount);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DEBIT_AMOUNT');
  END IF;

  SELECT * INTO v_in
  FROM public.ghc_transactions
  WHERE kind = 'transfer_in'
    AND status = 'posted'
    AND reference_id = p_reference_id
    AND user_id = v_out.counterparty_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'referenceId', p_reference_id,
      'creditTx', jsonb_build_object(
        'id', v_in.id,
        'userId', v_in.user_id,
        'amount', v_in.amount
      )
    );
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    request_id, counterparty_id, metadata, posted_at
  ) VALUES (
    v_out.counterparty_id,
    'transfer_in',
    v_amount,
    'posted',
    COALESCE(NULLIF(trim(v_out.reason), ''), 'Received GHC'),
    'WALLET_TRANSFER_ORPHAN_COMPLETE',
    p_reference_id,
    v_out.request_id,
    v_out.user_id,
    jsonb_build_object(
      'direction', 'receive',
      'transferStatus', 'completed',
      'opsNote', v_note,
      'completedFromDebitId', v_out.id
    ),
    v_now
  ) RETURNING id INTO v_credit_id;

  INSERT INTO public.ghc_economy_events (user_id, event_type, payload, reference_id)
  VALUES (
    v_out.counterparty_id,
    'GHC_RECEIVED',
    jsonb_build_object(
      'amount', v_amount,
      'fromUserId', v_out.user_id,
      'opsComplete', true,
      'note', v_note
    ),
    p_reference_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reconciled', true,
    'referenceId', p_reference_id,
    'debitId', v_out.id,
    'creditId', v_credit_id,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_complete_orphan_transfer_in(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_complete_orphan_transfer_in(text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_complete_orphan_transfer_in IS
  'Ops-only: insert missing transfer_in for an existing transfer_out. Never creates a second debit.';

-- ============================================================================
-- SOURCE 084: 20261022010084_referral_programme.sql
-- SHA256: 97caacb414f60d7dcb5e31d276aaacb7f088bda796b49df474e4626d72c2f51d
-- ============================================================================
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

-- ============================================================================
-- SOURCE 085: 20261022010085_issuance_guard_referral_and_curation_redistribute.sql
-- SHA256: f5b5453cba25d2983928420e425a94dca77dc01d60fb4258c01efbf25408ae98
-- ============================================================================
-- Amend Daily-Claim-only issuance guard to also allow:
-- 1) REFERRAL_REWARD_V1 earned posts with required metadata
-- 2) Curation redistribution: transfer_out + transfer_in with source CURATION_REDISTRIBUTE_V1
-- Does not enable settlement by itself; application feature flags still gate callers.

CREATE OR REPLACE FUNCTION public.ghc_enforce_daily_claim_only_issuance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event text := upper(trim(coalesce(NEW.source_event, '')));
  v_kind text := lower(trim(coalesce(NEW.kind, '')));
  v_status text := lower(trim(coalesce(NEW.status, '')));
  v_metadata jsonb := coalesce(NEW.metadata, '{}'::jsonb);
BEGIN
  IF TG_OP = 'UPDATE' AND v_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Wallet transfers (including orphan-complete receive legs)
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event IN ('WALLET_TRANSFER', 'WALLET_TRANSFER_ORPHAN_COMPLETE')
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.ghc_transactions AS debit
       WHERE debit.kind = 'transfer_out'
         AND debit.status = 'posted'
         AND debit.reference_id = NEW.reference_id
         AND debit.user_id = NEW.counterparty_id
         AND debit.counterparty_id = NEW.user_id
         AND abs(debit.amount) = NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Curation redistribution credit (must match debit)
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event = 'CURATION_REDISTRIBUTE_V1'
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.ghc_transactions d
       WHERE d.kind = 'transfer_out'
         AND d.status = 'posted'
         AND d.source_event = 'CURATION_REDISTRIBUTE_V1'
         AND d.reference_id = NEW.reference_id
         AND d.user_id = NEW.counterparty_id
         AND d.counterparty_id = NEW.user_id
         AND abs(d.amount) = NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Daily Claim
  IF v_kind = 'earned'
     AND v_event = 'DAILY_CLAIM_V12'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND (
       (v_status = 'pending' AND v_metadata->>'rewardLifecycle' = 'daily_claim_48h')
       OR (v_status = 'posted' AND v_metadata->>'claimKind' = 'DAILY_CLAIM_V12')
     ) THEN
    RETURN NEW;
  END IF;

  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'PROTOCOL_RESERVE_V12'
     AND NEW.user_id = '__PROTOCOL_RESERVE__' THEN
    RETURN NEW;
  END IF;

  -- Qualifying referral reward (5% of VIP GHC charge) — dedicated path only
  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'REFERRAL_REWARD_V1'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND v_metadata->>'rewardKind' = 'REFERRAL_REWARD_V1'
     AND NEW.reference_id IS NOT NULL
     AND NEW.reference_id LIKE 'referral_reward_%' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'GHC_ISSUANCE_BLOCKED: kind=% event=% status=% (only Daily Claim + gated referral + verified redistribution allowed)',
    v_kind, v_event, v_status
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() IS
  'Allows Daily Claim lifecycle, REFERRAL_REWARD_V1, and verified transfer/curation redistribution. Blocks other positive earned posts.';

-- ============================================================================
-- SOURCE 086: 20261022010086_curation_redistribute_balance_funded.sql
-- SHA256: 56818d312f4a6338cd97830b1eb5c220768583479eee3649f7fc3e52637f4608
-- ============================================================================
-- Stage 4 foundation: curation creator rewards as redistribution of upvoter GHC.
-- Debit upvoter + credit author for the same amount. No net mint.
-- Application must still gate enablement (GHC_CURATION_REDISTRIBUTE_ENABLED).

CREATE OR REPLACE FUNCTION public.ghc_curation_redistribute(
  p_voter_id text,
  p_author_id text,
  p_post_id text,
  p_amount numeric,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_ref text;
  v_debit_id uuid;
  v_credit_id uuid;
  v_now timestamptz := now();
  v_amount numeric;
BEGIN
  IF p_voter_id IS NULL OR btrim(p_voter_id) = ''
     OR p_author_id IS NULL OR btrim(p_author_id) = ''
     OR p_post_id IS NULL OR btrim(p_post_id) = ''
     OR p_reference_id IS NULL OR btrim(p_reference_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF p_voter_id = p_author_id THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'SELF_VOTE');
  END IF;

  v_amount := round(COALESCE(p_amount, 0), 4);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'ZERO_AMOUNT');
  END IF;
  -- Cap per redistribution call (abuse bound); higher policy can lower further in app
  IF v_amount > 1 THEN
    v_amount := 1;
  END IF;

  v_ref := p_reference_id;

  -- Idempotent replay
  IF EXISTS (
    SELECT 1 FROM public.ghc_transactions
    WHERE reference_id = v_ref AND kind = 'transfer_out' AND status = 'posted'
      AND source_event = 'CURATION_REDISTRIBUTE_V1'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', v_ref);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_voter_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_curation_redist:' || p_post_id || ':' || p_voter_id));

  v_available := public.ghc_available_balance(p_voter_id);
  IF v_available < v_amount THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'INSUFFICIENT_SPENDABLE');
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_voter_id, 'transfer_out', -v_amount, 'posted',
    'Curation contribution', 'CURATION_REDISTRIBUTE_V1', v_ref, p_author_id,
    jsonb_build_object('postId', p_post_id, 'redistribute', true), v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, counterparty_id, metadata, posted_at
  ) VALUES (
    p_author_id, 'transfer_in', v_amount, 'posted',
    'Curation reward', 'CURATION_REDISTRIBUTE_V1', v_ref, p_voter_id,
    jsonb_build_object('postId', p_post_id, 'redistribute', true), v_now
  ) RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', true,
    'amount', v_amount,
    'referenceId', v_ref,
    'debitId', v_debit_id,
    'creditId', v_credit_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) TO service_role;

-- ============================================================================
-- SOURCE 087: 20261022010087_gh_private_media_references_and_viewer_authz.sql
-- SHA256: 94e8c4c681c1cbbe8172e0772d05b3c90b25d2d98668fa60f23263278ecb7d32
-- ============================================================================
-- GH-CONNECT 0.61.7 phase: durable media references and viewer-aware private delivery.
-- Additive and fail-closed. Does NOT flip the Storage bucket; run migration/backfill,
-- validate all consumers and only then switch bucket visibility in the Supabase dashboard.

CREATE TABLE IF NOT EXISTS public.gh_post_media (
  post_id text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  media_id text NOT NULL REFERENCES public.gh_media_assets(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'attachment' CHECK (role IN ('image','video','file','thumbnail','attachment')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_post_media_media ON public.gh_post_media(media_id, post_id);
ALTER TABLE public.gh_post_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_media_no_client ON public.gh_post_media;
CREATE POLICY gh_post_media_no_client ON public.gh_post_media FOR ALL USING (false) WITH CHECK (false);

-- Attach only media owned by the author of the existing post. IDs are durable references;
-- signed URLs are deliberately never stored in post records.
CREATE OR REPLACE FUNCTION public.gh_post_media_attach(p_actor_id text, p_post_id text, p_media_ids text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_post public.gh_posts%ROWTYPE; v_count integer; v_requested integer;
BEGIN
 IF COALESCE(trim(p_actor_id),'')='' OR COALESCE(trim(p_post_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_post FROM public.gh_posts WHERE id=trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR v_post.author_id<>trim(p_actor_id) THEN RETURN jsonb_build_object('ok',false,'error','POST_NOT_FOUND'); END IF;
 v_requested := cardinality(COALESCE(p_media_ids,ARRAY[]::text[]));
 IF v_requested>20 THEN RETURN jsonb_build_object('ok',false,'error','TOO_MANY_MEDIA'); END IF;
 IF EXISTS (
   SELECT 1 FROM unnest(COALESCE(p_media_ids,ARRAY[]::text[])) x(id)
   LEFT JOIN public.gh_media_assets m ON m.id=x.id AND m.owner_id=trim(p_actor_id)
     AND m.status='ready' AND m.deleted_at IS NULL
   WHERE m.id IS NULL
 ) THEN RETURN jsonb_build_object('ok',false,'error','MEDIA_NOT_OWNED_OR_READY'); END IF;
 INSERT INTO public.gh_post_media(post_id,media_id,role,sort_order)
 SELECT trim(p_post_id), x.id,
        CASE WHEN m.media_kind='image' THEN 'image' WHEN m.media_kind='video' THEN 'video' ELSE 'file' END,
        x.ordinality::integer-1
 FROM unnest(COALESCE(p_media_ids,ARRAY[]::text[])) WITH ORDINALITY x(id,ordinality)
 JOIN public.gh_media_assets m ON m.id=x.id
 ON CONFLICT(post_id,media_id) DO UPDATE SET role=EXCLUDED.role,sort_order=EXCLUDED.sort_order;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('ok',true,'postId',trim(p_post_id),'attached',v_count);
END; $$;

-- Viewer authorization is evaluated against the actual session user and the live post state.
-- Unknown/unlinked media is owner-only. Blocked users and community-bound posts fail closed
-- unless the viewer is the author; community membership authorization is not inferred here.
CREATE OR REPLACE FUNCTION public.gh_media_authorize_viewer(p_media_id text,p_viewer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_asset public.gh_media_assets%ROWTYPE; v_allowed boolean := false; v_owner boolean := false;
BEGIN
 IF COALESCE(trim(p_media_id),'')='' OR COALESCE(trim(p_viewer_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 SELECT * INTO v_asset FROM public.gh_media_assets WHERE id=trim(p_media_id)
  AND status='ready' AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 v_owner := v_asset.owner_id=trim(p_viewer_id);
 IF v_owner THEN v_allowed:=true;
 ELSE
  -- Posts: same audience rules as the feed, with current block and community membership checks.
  SELECT EXISTS (
   SELECT 1 FROM public.gh_post_media pm JOIN public.gh_posts p ON p.id=pm.post_id
   WHERE pm.media_id=v_asset.id AND p.deleted_at IS NULL AND p.author_id=v_asset.owner_id
    AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=p.author_id)
         OR (b.blocker_id=p.author_id AND b.blocked_id=trim(p_viewer_id)))
    AND (p.community_id IS NULL OR EXISTS (SELECT 1 FROM public.gh_community_members cm
      WHERE cm.community_id=p.community_id AND cm.gh_user_id=trim(p_viewer_id) AND cm.status='active'))
    AND (p.visibility='public'
      OR (p.visibility='followers' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id))
      OR (p.visibility='mutuals' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id)
        AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=p.author_id AND f.following_id=trim(p_viewer_id))))
  ) INTO v_allowed;

  -- Stories: audience and expiry are evaluated at delivery time, not when a URL was issued.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_stories s
    WHERE s.owner_id=v_asset.owner_id AND s.status IN ('published','highlight') AND s.expires_at>now()
      AND (s.media_url=v_asset.public_url OR position('/api/media/'||v_asset.id||'/content' in COALESCE(s.media_url,''))>0)
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=s.owner_id)
          OR (b.blocker_id=s.owner_id AND b.blocked_id=trim(p_viewer_id)))
      AND (s.audience='everyone'
       OR (s.audience='followers' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=s.owner_id))
       OR (s.audience='friends' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=s.owner_id)
          AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=s.owner_id AND f.following_id=trim(p_viewer_id))))
   ) INTO v_allowed;
  END IF;

  -- Public profile photos are visible only when the profile record exists and neither party blocks the other.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_user_profiles up
    WHERE up.gh_user_id=v_asset.owner_id
      AND (up.photos::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR up.cover_photo=v_asset.public_url
        OR up.photos::text LIKE '%/api/media/'||v_asset.id||'/content%'
        OR position('/api/media/'||v_asset.id||'/content' in COALESCE(up.cover_photo,''))>0)
      AND COALESCE(lower(up.profile_payload->>'visibility'),'public') NOT IN ('private','hidden')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=up.gh_user_id)
          OR (b.blocker_id=up.gh_user_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;

  -- Messages: only current members of the conversation may read attachments sent by the asset owner.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_messages msg
    JOIN public.gh_conversation_members cm ON cm.conversation_id=msg.conversation_id
    WHERE msg.sender_id=v_asset.owner_id AND msg.deleted_at IS NULL
      AND cm.gh_user_id=trim(p_viewer_id) AND cm.left_at IS NULL
      AND (msg.meta::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR msg.meta::text LIKE '%/api/media/'||v_asset.id||'/content%')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=msg.sender_id)
          OR (b.blocker_id=msg.sender_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;

  -- Marketplace media is visible only while the owning listing is active.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_marketplace_listings l
    WHERE l.seller_id=v_asset.owner_id AND l.status='active'
      AND (l.metadata::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR l.metadata::text LIKE '%/api/media/'||v_asset.id||'/content%')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=l.seller_id)
          OR (b.blocker_id=l.seller_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;
 END IF;
 IF NOT v_allowed THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_asset.storage_path NOT LIKE v_asset.owner_id || '/%' OR position('..' in v_asset.storage_path)>0 THEN
  RETURN jsonb_build_object('ok',false,'error','MEDIA_RECORD_INVALID'); END IF;
 RETURN jsonb_build_object('ok',true,'mediaId',v_asset.id,'ownerId',v_asset.owner_id,
   'bucket',v_asset.bucket,'storagePath',v_asset.storage_path,'mime',v_asset.mime_type,'kind',v_asset.media_kind);
END; $$;

REVOKE ALL ON FUNCTION public.gh_post_media_attach(text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_media_attach(text,text,text[]) TO service_role;
REVOKE ALL ON FUNCTION public.gh_media_authorize_viewer(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_authorize_viewer(text,text) TO service_role;

-- Backfill durable references where old posts store a public URL matching the media registry.
-- This is non-destructive: legacy URLs remain in place until consumer rollout and verification.
INSERT INTO public.gh_post_media(post_id,media_id,role,sort_order)
SELECT p.id,m.id,
 CASE WHEN m.media_kind='video' THEN 'video' WHEN m.media_kind='file' THEN 'file' ELSE 'image' END,
 COALESCE(x.ord,1)::integer-1
FROM public.gh_posts p
JOIN LATERAL (
 SELECT value AS url, ordinality AS ord FROM jsonb_array_elements_text(COALESCE(p.images,'[]'::jsonb)) WITH ORDINALITY
 UNION ALL SELECT p.video, 1 WHERE p.video IS NOT NULL AND p.video<>''
 UNION ALL SELECT p.pdf, 1 WHERE p.pdf IS NOT NULL AND p.pdf<>''
) x ON true
JOIN public.gh_media_assets m ON m.public_url=x.url AND m.status='ready' AND m.deleted_at IS NULL
ON CONFLICT(post_id,media_id) DO NOTHING;

-- Rewrite known legacy public URLs to stable application references across major consumers.
-- Exact owner matching prevents one account from attaching another account's registered object.
-- Unknown/unregistered URLs are left untouched; the bucket must not be switched private until
-- the release gate confirms zero unresolved references across all application content domains.
DO $$
DECLARE r record; v_facade text;
BEGIN
 FOR r IN SELECT id,owner_id,public_url FROM public.gh_media_assets
          WHERE public_url IS NOT NULL AND length(trim(public_url))>0 AND status='ready' AND deleted_at IS NULL
 LOOP
  v_facade := '/api/media/'||r.id||'/content';
  UPDATE public.gh_posts SET
    images=replace(images::text,r.public_url,v_facade)::jsonb,
    video=CASE WHEN video=r.public_url THEN v_facade ELSE video END,
    pdf=CASE WHEN pdf=r.public_url THEN v_facade ELSE pdf END,
    author_photo=CASE WHEN author_photo=r.public_url THEN v_facade ELSE author_photo END,
    updated_at=now()
   WHERE author_id=r.owner_id AND (images::text LIKE '%'||r.public_url||'%' OR video=r.public_url OR pdf=r.public_url OR author_photo=r.public_url);

  UPDATE public.gh_stories SET
    media_url=CASE WHEN media_url=r.public_url THEN v_facade ELSE media_url END,
    owner_photo=CASE WHEN owner_photo=r.public_url THEN v_facade ELSE owner_photo END
   WHERE owner_id=r.owner_id AND (media_url=r.public_url OR owner_photo=r.public_url);

  UPDATE public.gh_user_profiles SET
    photos=replace(photos::text,r.public_url,v_facade)::jsonb,
    cover_photo=CASE WHEN cover_photo=r.public_url THEN v_facade ELSE cover_photo END,
    profile_payload=replace(profile_payload::text,r.public_url,v_facade)::jsonb,
    updated_at=now()
   WHERE gh_user_id=r.owner_id AND (photos::text LIKE '%'||r.public_url||'%' OR cover_photo=r.public_url OR profile_payload::text LIKE '%'||r.public_url||'%');

  UPDATE public.ghc_public_identities SET avatar_url=v_facade,updated_at=now()
   WHERE user_id=r.owner_id AND avatar_url=r.public_url;

  UPDATE public.gh_messages SET meta=replace(meta::text,r.public_url,v_facade)::jsonb
   WHERE sender_id=r.owner_id AND meta::text LIKE '%'||r.public_url||'%';

  UPDATE public.gh_marketplace_listings SET metadata=replace(metadata::text,r.public_url,v_facade)::jsonb,updated_at=now()
   WHERE seller_id=r.owner_id AND metadata::text LIKE '%'||r.public_url||'%';
 END LOOP;
END $$;

COMMENT ON TABLE public.gh_post_media IS 'Durable post-to-media IDs; signed URLs are ephemeral and never stored here.';
COMMENT ON FUNCTION public.gh_media_authorize_viewer(text,text) IS 'Viewer-aware private media access check. Owner access plus current post visibility; service_role only.';

-- ============================================================================
-- SOURCE 088: 20261022010088_ghpv_soft_delete_quality_cleanup.sql
-- SHA256: 08eca907e05c1b4f1ada707d046f93e07d0024afc1273ee77be158c479e267e3
-- ============================================================================
-- =============================================================================
-- 20261022010088_ghpv_soft_delete_quality_cleanup.sql
-- GHPV: when a post is soft-deleted, drop active weights and mark quality open/stale.
--
-- Purpose:
--   Prevent deleted content from contributing to future settlement snapshots.
--   Snapshot already rejects deleted_at IS NOT NULL posts; this cleans residual rows.
--
-- Dependencies:
--   20261022010067_ghpv_active_weight_set_semantics.sql
--   20261022010061_ghpv_judgment_infrastructure.sql
--   gh_posts.deleted_at must exist (social schema)
--
-- Objects:
--   gh_ghpv_cleanup_deleted_content(text)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT service_role only
--
-- GHC impact: NONE
--
-- Deployment: Testnet after 20261018. Not applied by this repository change.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_ghpv_cleanup_deleted_content(
  p_content_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted timestamptz;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;

  SELECT deleted_at INTO v_deleted
  FROM public.gh_posts
  WHERE id = trim(p_content_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DELETED');
  END IF;

  DELETE FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id);

  UPDATE public.gh_content_quality_state
  SET
    upvote_weight = 0,
    downvote_weight = 0,
    independent_voters = 0,
    settlement_status = CASE
      WHEN settlement_status IN ('settled', 'unresolved', 'quarantined') THEN settlement_status
      ELSE 'open'
    END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'cleaned', true,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) IS
  'GHPV: clear active weights for soft-deleted posts. No GHC.';

-- ============================================================================
-- SOURCE 089: 20261022010089_gh_comment_media_attachments.sql
-- SHA256: 7cd6d4d4f6287940cb0858dab79be3afb905a05824a9183d57523eed12676509
-- ============================================================================
-- Comment media attachments (additive). Service-role only; client RLS remains deny-all.
-- Media URLs must be durable https storage URLs — never blob:/data:.

ALTER TABLE public.gh_post_comments
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.gh_post_comments.media IS
  'Array of {id,type,url,fileName?} durable media refs. Empty array = text-only comment.';

CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_post text := COALESCE(p_row->>'postId', '');
  v_parent text := NULLIF(p_row->>'parentId', '');
  v_media jsonb := COALESCE(p_row->'media', '[]'::jsonb);
BEGIN
  IF v_id = '' OR v_post = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments WHERE id = v_parent AND post_id = v_post AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PARENT_NOT_FOUND');
  END IF;
  IF jsonb_typeof(v_media) <> 'array' THEN
    v_media := '[]'::jsonb;
  END IF;
  -- Cap at 4 items server-side
  IF jsonb_array_length(v_media) > 4 THEN
    v_media := (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
      FROM (
        SELECT e FROM jsonb_array_elements(v_media) WITH ORDINALITY AS t(e, ord)
        WHERE ord <= 4
      ) s
    );
  END IF;

  INSERT INTO public.gh_post_comments (
    id, post_id, author_id, author_name, author_photo, text, parent_id, created_at, media
  ) VALUES (
    v_id,
    v_post,
    COALESCE(p_row->>'authorId', ''),
    COALESCE(p_row->>'authorName', ''),
    COALESCE(p_row->>'authorPhoto', ''),
    COALESCE(p_row->>'text', ''),
    v_parent,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END,
    v_media
  );
  UPDATE public.gh_posts
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;

-- Ensure list RPCs expose media when present (extend via SELECT * pattern if function uses row_to_json)
-- Operators: after apply, verify: SELECT media FROM gh_post_comments LIMIT 1;

CREATE OR REPLACE FUNCTION public.gh_comment_list_v2(
  p_post_id text,
  p_viewer_id text DEFAULT NULL,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
  INTO v_rows FROM (
    SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
      c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
      (extract(epoch from c.created_at)*1000)::bigint AS "createdAt",
      COALESCE(c.media, '[]'::jsonb) AS "mediaAttachments"
    FROM public.gh_post_comments c
    WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
      AND (p_before_ms IS NULL OR
        (extract(epoch from c.created_at)*1000)::bigint < p_before_ms OR
        ((extract(epoch from c.created_at)*1000)::bigint = p_before_ms AND c.id < COALESCE(p_before_id, chr(255))))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit,40),1),101)
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v2(text,text,integer,bigint,text) TO service_role;

-- ============================================================================
-- SOURCE 090: 20261022010090_ghpv_soft_delete_atomic.sql
-- SHA256: e07041b4ecd526cab0a9d88259c207399405404be231b2baef43a60311ad2919
-- ============================================================================
-- =============================================================================
-- 20261022010090_ghpv_soft_delete_atomic.sql
-- Fold GHPV cleanup into the authoritative post soft-delete RPC.
--
-- Purpose:
--   When the owner soft-deletes a post, clear active GHPV weights in the same
--   transaction. Clients cannot call cleanup for arbitrary content.
--
-- Dependencies:
--   20261022010036_gh_social_core.sql (gh_post_soft_delete)
--   20261022010088_ghpv_soft_delete_quality_cleanup.sql
--
-- Objects:
--   REPLACE public.gh_post_soft_delete(text, text)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   Actor must equal post author. No client deleted flag.
--   REVOKE PUBLIC; GRANT service_role (same as prior lockdown)
--
-- Idempotency:
--   Second delete on already-deleted post returns ALREADY_DELETED and does not
--   re-open quality state.
--
-- GHC impact: NONE
-- Deployment: Testnet after 20261019. Not applied by this change.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_post_soft_delete(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
  v_cleanup jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0
     OR p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts
  WHERE id = trim(p_post_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author <> trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'id', trim(p_post_id), 'alreadyDeleted', true, 'ghcMutated', false);
  END IF;

  UPDATE public.gh_posts
  SET deleted_at = now(), updated_at = now()
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  -- Same transaction: drop active weights so settlement snapshot cannot include them.
  v_cleanup := public.gh_ghpv_cleanup_deleted_content(trim(p_post_id));

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_post_id),
    'ghpvCleaned', coalesce((v_cleanup->>'ok')::boolean, false),
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_soft_delete(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_soft_delete(text, text) IS
  'Owner soft-delete plus GHPV active-weight cleanup. No client deleted flag. No GHC.';

-- ============================================================================
-- SOURCE 091: 20261022010091_company_revenue_event_journal.sql
-- SHA256: 6eb0982b6eca6658270e3859f6a20d9521b1d3d2bf864a7d2de47869af4244ec
-- ============================================================================
-- GreenHaven company-revenue journal foundation.
-- This is separate from GHC utility ledger, marketplace seller balances, and payout obligations.
-- Do not apply to any live database until migration history/schema review and disposable PostgreSQL tests pass.

CREATE TABLE IF NOT EXISTS public.gh_company_revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  source_provider text NOT NULL CHECK (source_provider IN ('pi', 'paystack', 'manual', 'other')),
  source_event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'marketplace_fee', 'membership_revenue', 'promotion_revenue',
    'digital_service_revenue', 'refund', 'chargeback', 'adjustment'
  )),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- All amounts are integer minor units in the provider's currency (e.g. kobo for NGN).
  -- No floating-point accounting amounts are accepted by this journal.
  gross_amount_minor bigint NOT NULL,
  company_revenue_minor bigint NOT NULL,
  provider_fee_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  company_net_minor bigint GENERATED ALWAYS AS (company_revenue_minor - provider_fee_minor - tax_minor) STORED,
  source_reference text NOT NULL,
  verified_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_company_revenue_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT gh_company_revenue_metadata_size CHECK (octet_length(metadata::text) <= 4096),
  CONSTRAINT gh_company_revenue_nonzero_event CHECK (
    gross_amount_minor <> 0 OR company_revenue_minor <> 0 OR provider_fee_minor <> 0 OR tax_minor <> 0
  ),
  CONSTRAINT gh_company_revenue_event_direction CHECK (
    (event_type IN ('refund', 'chargeback') AND gross_amount_minor <= 0 AND company_revenue_minor <= 0)
    OR (event_type NOT IN ('refund', 'chargeback', 'adjustment') AND gross_amount_minor >= 0 AND company_revenue_minor >= 0)
    OR event_type = 'adjustment'
  ),
  CONSTRAINT gh_company_revenue_source_ref_nonempty CHECK (length(trim(source_reference)) > 0),
  CONSTRAINT gh_company_revenue_source_event_nonempty CHECK (length(trim(source_event_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_company_revenue_provider_event
  ON public.gh_company_revenue_events(source_provider, source_event_id);
CREATE INDEX IF NOT EXISTS idx_gh_company_revenue_recorded_at
  ON public.gh_company_revenue_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_company_revenue_type_currency_date
  ON public.gh_company_revenue_events(event_type, currency, recorded_at DESC);

ALTER TABLE public.gh_company_revenue_events ENABLE ROW LEVEL SECURITY;
-- Keep RLS enabled and grant no table access to API roles. The SECURITY DEFINER RPC
-- runs as the migration owner; FORCE RLS would block its insert without an explicit policy.
REVOKE ALL ON TABLE public.gh_company_revenue_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_company_revenue_event_append(
  p_idempotency_key text,
  p_source_provider text,
  p_source_event_id text,
  p_event_type text,
  p_currency text,
  p_gross_amount_minor bigint,
  p_company_revenue_minor bigint,
  p_provider_fee_minor bigint DEFAULT 0,
  p_tax_minor bigint DEFAULT 0,
  p_source_reference text DEFAULT NULL,
  p_verified_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing public.gh_company_revenue_events%ROWTYPE;
  v_key text := trim(COALESCE(p_idempotency_key, ''));
  v_provider text := lower(trim(COALESCE(p_source_provider, '')));
  v_event_id text := trim(COALESCE(p_source_event_id, ''));
  v_type text := lower(trim(COALESCE(p_event_type, '')));
  v_currency text := upper(trim(COALESCE(p_currency, '')));
  v_reference text := trim(COALESCE(p_source_reference, ''));
BEGIN
  IF v_key = '' OR length(v_key) > 200 OR v_event_id = '' OR length(v_event_id) > 240
     OR v_reference = '' OR length(v_reference) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_SOURCE');
  END IF;
  IF v_provider NOT IN ('pi', 'paystack', 'manual', 'other')
     OR v_type NOT IN ('marketplace_fee', 'membership_revenue', 'promotion_revenue',
       'digital_service_revenue', 'refund', 'chargeback', 'adjustment')
     OR v_currency !~ '^[A-Z]{3}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_CLASSIFICATION');
  END IF;
  IF p_verified_at IS NULL OR p_verified_at > now() + interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VERIFIED_SOURCE_REQUIRED');
  END IF;
  IF p_gross_amount_minor IS NULL OR p_company_revenue_minor IS NULL
     OR p_provider_fee_minor IS NULL OR p_tax_minor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REVENUE_AMOUNTS');
  END IF;
  IF NOT (
    (v_type IN ('refund', 'chargeback') AND p_gross_amount_minor <= 0 AND p_company_revenue_minor <= 0)
    OR (v_type NOT IN ('refund', 'chargeback', 'adjustment') AND p_gross_amount_minor >= 0 AND p_company_revenue_minor >= 0)
    OR v_type = 'adjustment'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_DIRECTION_MISMATCH');
  END IF;
  IF p_gross_amount_minor = 0 AND p_company_revenue_minor = 0
     AND p_provider_fee_minor = 0 AND p_tax_minor = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ZERO_VALUE_EVENT');
  END IF;

  -- Idempotency retries are accepted only when all economic/source fields match exactly.
  SELECT * INTO v_existing FROM public.gh_company_revenue_events
    WHERE idempotency_key = v_key OR (source_provider = v_provider AND source_event_id = v_event_id)
    LIMIT 1;
  IF FOUND THEN
    IF v_existing.idempotency_key = v_key
       AND v_existing.source_provider = v_provider
       AND v_existing.source_event_id = v_event_id
       AND v_existing.event_type = v_type
       AND v_existing.currency = v_currency
       AND v_existing.gross_amount_minor = p_gross_amount_minor
       AND v_existing.company_revenue_minor = p_company_revenue_minor
       AND v_existing.provider_fee_minor = p_provider_fee_minor
       AND v_existing.tax_minor = p_tax_minor
       AND v_existing.source_reference = v_reference THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'eventId', v_existing.id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_IDEMPOTENCY_CONFLICT');
  END IF;

  INSERT INTO public.gh_company_revenue_events (
    idempotency_key, source_provider, source_event_id, event_type, currency,
    gross_amount_minor, company_revenue_minor, provider_fee_minor, tax_minor,
    source_reference, verified_at, metadata
  ) VALUES (
    v_key, v_provider, v_event_id, v_type, v_currency,
    p_gross_amount_minor, p_company_revenue_minor, p_provider_fee_minor, p_tax_minor,
    v_reference, p_verified_at, COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'eventId', v_id);
EXCEPTION WHEN unique_violation THEN
  -- A concurrent retry may win the unique key race; caller retries to read the canonical row.
  RETURN jsonb_build_object('ok', false, 'error', 'REVENUE_CONCURRENT_RETRY');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_append(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_company_revenue_event_append(text,text,text,text,text,bigint,bigint,bigint,bigint,text,timestamptz,jsonb) TO service_role;

COMMENT ON TABLE public.gh_company_revenue_events IS
  'Append-only company revenue evidence journal; not the GHC ledger, not seller payable balance, and not proof of provider settlement unless recorded by a trusted verified integration.';
COMMENT ON COLUMN public.gh_company_revenue_events.company_net_minor IS
  'Generated net company amount: company revenue minus provider fees minus tax, in integer minor units.';


-- Enforce append-only behavior even if a future privileged code path is granted
-- table access accidentally. Corrections must be compensating events, never edits.
CREATE OR REPLACE FUNCTION public.gh_company_revenue_event_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'GH_COMPANY_REVENUE_JOURNAL_APPEND_ONLY'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.gh_company_revenue_event_reject_mutation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS gh_company_revenue_events_append_only ON public.gh_company_revenue_events;
CREATE TRIGGER gh_company_revenue_events_append_only
  BEFORE UPDATE OR DELETE ON public.gh_company_revenue_events
  FOR EACH ROW EXECUTE FUNCTION public.gh_company_revenue_event_reject_mutation();

-- ============================================================================
-- SOURCE 092: 20261022010092_gh_post_list_feed_curation_fields.sql
-- SHA256: e30ac3416394bad0d74b74012cec4c0da2a3a88007c0fc1398f0c81c63afbbe1
-- ============================================================================
-- Feed must return upvote/downvote totals and the viewer's active curation choice
-- so votes survive reload. Additive; does not change write path.

CREATE OR REPLACE FUNCTION public.gh_post_list_feed_v2(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEED_CURSOR');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe",
      (
        SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = p_viewer_id
        LIMIT 1
      ) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at)*1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at)*1000)::bigint = p_before_ms
          AND p.id < p_before_id
        )
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed_v2(text, integer, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_post_list_feed(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from p.deleted_at)*1000)::bigint AS "deletedAt",
      EXISTS (
        SELECT 1 FROM public.gh_post_reactions r
        WHERE r.post_id = p.id AND r.user_id = p_viewer_id AND r.reaction = 'like'
      ) AS "likedByMe",
      (
        SELECT c.choice FROM public.gh_post_curations c
        WHERE c.post_id = p.id AND c.user_id = p_viewer_id
        LIMIT 1
      ) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND (
        p.visibility = 'public'
        OR p.author_id = p_viewer_id
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = p.author_id
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id)
           OR (b.blocker_id = p.author_id AND b.blocked_id = p_viewer_id)
      )
      AND (p_before_ms IS NULL OR (extract(epoch from p.created_at)*1000) < p_before_ms)
    ORDER BY p.created_at DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_feed(text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role;

-- ============================================================================
-- SOURCE 093: 20261022010093_ghc_credit_pack_purchase.sql
-- SHA256: 8b0487cebaa5d67c5ddb5e97dc22ff7c009429fb9bd2d9f8e6db8a8714e09ae8
-- ============================================================================
-- Pi-verified GHC pack purchase credit (idempotent by reference_id).
-- Not general minting: only PI_PACK_PURCHASE source with unique reference.

CREATE OR REPLACE FUNCTION public.ghc_credit_pack_purchase(
  p_user_id text,
  p_amount numeric,
  p_reference_id text,
  p_reason text DEFAULT 'Pi pack purchase',
  p_product_id text DEFAULT NULL,
  p_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ghc_transactions%ROWTYPE;
  v_tx_id uuid;
  v_amount numeric := abs(coalesce(p_amount, 0));
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REFERENCE_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_pack:' || trim(p_user_id) || ':' || trim(p_reference_id)));

  SELECT * INTO v_existing
  FROM public.ghc_transactions
  WHERE user_id = trim(p_user_id)
    AND reference_id = trim(p_reference_id)
    AND status = 'posted'
    AND amount > 0
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyCredited', true,
      'idempotent', true,
      'transactionId', v_existing.id::text,
      'amount', v_existing.amount
    );
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id, metadata
  ) VALUES (
    trim(p_user_id),
    'earned',
    v_amount,
    'posted',
    coalesce(nullif(trim(p_reason), ''), 'Pi pack purchase'),
    'PI_PACK_PURCHASE',
    trim(p_reference_id),
    jsonb_build_object(
      'productId', p_product_id,
      'intentId', p_intent_id,
      'settlement', 'pi_verified_pack'
    )
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyCredited', false,
    'transactionId', v_tx_id::text,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.ghc_credit_pack_purchase(text, numeric, text, text, text, text) IS
  'Idempotent credit for Pi-verified GHC packs. Not general issuance.';

-- ============================================================================
-- SOURCE 094: 20261022010094_pi_payment_intent_idempotency_lookup.sql
-- SHA256: aed14b1f61f8ca4909dac1b861936246f64aa4890e179d01d17e87ac0c709cb6
-- ============================================================================
-- Phase 5 hardening: durable idempotency lookup for multi-instance payment creation.
-- Additive only. Does not change existing payment rows or provider state.
CREATE OR REPLACE FUNCTION public.ghc_payment_intent_by_idempotency(
  p_user_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id text;
BEGIN
  IF COALESCE(trim(p_user_id), '') = '' OR COALESCE(trim(p_idempotency_key), '') = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_id
  FROM public.ghc_payment_intents
  WHERE user_id = trim(p_user_id)
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.ghc_payment_intent_get(v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) TO service_role;

-- ============================================================================
-- SOURCE 095: 20261022010095_pi_payment_intent_atomic_transitions.sql
-- SHA256: 948f6b4c5b10ca685a456b8886744da2a78241e2bdda9ee8c45359732516ab36
-- ============================================================================
-- Phase 5 hardening: serialize provider binding and payment status transitions.
-- Source-only until reviewed, reconciled and validated on disposable PostgreSQL/Testnet.

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_bind_provider(
  p_id text,
  p_provider_payment_id text,
  p_actor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_payment_intents%ROWTYPE;
  v_conflict text;
  v_audit jsonb;
BEGIN
  IF COALESCE(trim(p_id), '') = '' OR COALESCE(trim(p_provider_payment_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_BIND_INPUT');
  END IF;

  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_FOUND'); END IF;

  IF v_row.provider_payment_id IS NOT NULL AND v_row.provider_payment_id <> trim(p_provider_payment_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_CONFLICT');
  END IF;

  SELECT id INTO v_conflict
  FROM public.ghc_payment_intents
  WHERE provider_payment_id = trim(p_provider_payment_id) AND id <> trim(p_id)
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_PAYMENT_ALREADY_BOUND');
  END IF;

  IF v_row.status IN ('COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'FULFILLED') AND v_row.provider_payment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_INTENT_CANNOT_BIND');
  END IF;

  IF v_row.provider_payment_id = trim(p_provider_payment_id) AND v_row.status <> 'CREATED' THEN
    RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', true);
  END IF;

  v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
    'at', (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'action', 'BIND_PROVIDER',
    'actor', p_actor,
    'detail', trim(p_provider_payment_id)
  ));
  SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
  FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
  WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);

  UPDATE public.ghc_payment_intents
  SET provider_payment_id = trim(p_provider_payment_id),
      status = CASE WHEN status = 'CREATED' THEN 'APPROVAL_PENDING' ELSE status END,
      audit = v_audit,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_payment_intent_transition(
  p_id text,
  p_next_status text,
  p_actor text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_txid text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_payment_intents%ROWTYPE;
  v_next text := upper(trim(COALESCE(p_next_status, '')));
  v_conflict text;
  v_allowed boolean := false;
  v_audit jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(trim(p_id), '') = '' OR v_next NOT IN (
    'CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING',
    'COMPLETED','FULFILLED','FAILED','CANCELLED','REFUNDED','INCOMPLETE'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION_INPUT');
  END IF;

  SELECT * INTO v_row FROM public.ghc_payment_intents WHERE id = trim(p_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'INTENT_NOT_FOUND'); END IF;

  IF p_provider_payment_id IS NOT NULL AND trim(p_provider_payment_id) <> '' THEN
    IF v_row.provider_payment_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_REQUIRED');
    END IF;
    IF v_row.provider_payment_id <> trim(p_provider_payment_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_BIND_CONFLICT');
    END IF;
    SELECT id INTO v_conflict FROM public.ghc_payment_intents
    WHERE provider_payment_id = trim(p_provider_payment_id) AND id <> v_row.id LIMIT 1;
    IF v_conflict IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'PROVIDER_PAYMENT_ALREADY_BOUND'); END IF;
  END IF;

  IF v_next = v_row.status THEN
    v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
      'at', (extract(epoch FROM v_now) * 1000)::bigint,
      'action', 'STATUS_RETRY_' || v_next,
      'actor', p_actor,
      'detail', p_detail,
      'meta', COALESCE(p_meta, '{}'::jsonb)
    ));
    SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
    FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
    WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);
    UPDATE public.ghc_payment_intents
    SET txid = COALESCE(NULLIF(trim(p_txid), ''), txid),
        last_error = CASE WHEN p_error IS NULL THEN last_error ELSE NULLIF(trim(p_error), '') END,
        audit = v_audit,
        updated_at = now()
    WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', true);
  END IF;

  -- Confirmed success and terminal outcomes cannot be downgraded by a late callback.
  IF v_row.status IN ('FULFILLED', 'REFUNDED', 'FAILED', 'CANCELLED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATUS', 'status', v_row.status);
  END IF;
  IF v_row.status = 'COMPLETED' AND v_next NOT IN ('FULFILLED', 'REFUNDED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'COMPLETED_STATUS_CANNOT_REGRESS');
  END IF;
  IF v_next = 'FULFILLED' AND v_row.status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FULFILLMENT_REQUIRES_COMPLETED');
  END IF;
  IF v_next = 'REFUNDED' AND v_row.status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REFUND_REQUIRES_COMPLETED');
  END IF;

  v_allowed := CASE v_next
    WHEN 'APPROVAL_PENDING' THEN v_row.status IN ('CREATED','APPROVAL_PENDING')
    WHEN 'APPROVED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED')
    WHEN 'USER_SUBMITTED' THEN v_row.status IN ('APPROVED','USER_SUBMITTED')
    WHEN 'COMPLETION_PENDING' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'COMPLETED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'INCOMPLETE' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'FAILED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'CANCELLED' THEN v_row.status IN ('CREATED','APPROVAL_PENDING','APPROVED','USER_SUBMITTED','COMPLETION_PENDING','INCOMPLETE')
    WHEN 'FULFILLED' THEN v_row.status = 'COMPLETED'
    WHEN 'REFUNDED' THEN v_row.status = 'COMPLETED'
    ELSE false
  END;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS_TRANSITION', 'from', v_row.status, 'to', v_next);
  END IF;

  v_audit := (CASE WHEN jsonb_typeof(v_row.audit) = 'array' THEN v_row.audit ELSE '[]'::jsonb END) || jsonb_build_array(jsonb_build_object(
    'at', (extract(epoch FROM v_now) * 1000)::bigint,
    'action', 'STATUS_' || v_next,
    'actor', p_actor,
    'detail', p_detail,
    'meta', COALESCE(p_meta, '{}'::jsonb)
  ));
  SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb) INTO v_audit
  FROM jsonb_array_elements(v_audit) WITH ORDINALITY AS x(value, ordinality)
  WHERE ordinality > GREATEST(jsonb_array_length(v_audit) - 50, 0);

  UPDATE public.ghc_payment_intents
  SET status = v_next,
      provider_payment_id = COALESCE(NULLIF(trim(p_provider_payment_id), ''), provider_payment_id),
      txid = COALESCE(NULLIF(trim(p_txid), ''), txid),
      last_error = CASE WHEN p_error IS NULL THEN last_error ELSE NULLIF(trim(p_error), '') END,
      audit = v_audit,
      approved_at = CASE WHEN v_next = 'APPROVED' THEN COALESCE(approved_at, v_now) ELSE approved_at END,
      submitted_at = CASE WHEN v_next = 'USER_SUBMITTED' THEN COALESCE(submitted_at, v_now) ELSE submitted_at END,
      completed_at = CASE WHEN v_next = 'COMPLETED' THEN COALESCE(completed_at, v_now) ELSE completed_at END,
      fulfilled_at = CASE WHEN v_next = 'FULFILLED' THEN COALESCE(fulfilled_at, v_now) ELSE fulfilled_at END,
      cancelled_at = CASE WHEN v_next = 'CANCELLED' THEN COALESCE(cancelled_at, v_now) ELSE cancelled_at END,
      refunded_at = CASE WHEN v_next = 'REFUNDED' THEN COALESCE(refunded_at, v_now) ELSE refunded_at END,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'intent', public.ghc_payment_intent_get(v_row.id), 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_payment_intent_bind_provider(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_bind_provider(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb) TO service_role;

-- Harden the original SECURITY DEFINER payment-intent RPCs too. Granting service_role
-- without revoking PostgreSQL's default PUBLIC EXECUTE would leave the functions callable
-- by client roles even though the underlying table has RLS enabled.
REVOKE ALL ON FUNCTION public.ghc_payment_intent_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_get(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_provider(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) TO service_role;

-- ============================================================================
-- SOURCE 096: 20261022010096_gh_social_notifications_types_extend.sql
-- SHA256: 9dc795e1450a16a01ad96b0e786817c916e4bb3eb4afde6409b13ce1cf5aa1ae
-- ============================================================================
-- Extend social notification types: reputation_level_up + system.
-- Informational only. No GHC/ledger columns. Service-role RPCs only.

ALTER TABLE public.gh_social_notifications
  DROP CONSTRAINT IF EXISTS gh_social_notifications_notification_type_check;

ALTER TABLE public.gh_social_notifications
  ADD CONSTRAINT gh_social_notifications_notification_type_check
  CHECK (notification_type IN (
    'follow',
    'post_like',
    'post_comment',
    'comment_reply',
    'curation',
    'mention',
    'share',
    'reputation_level_up',
    'system'
  ));

CREATE OR REPLACE FUNCTION public.gh_social_notification_create(
  p_recipient_id text,
  p_actor_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_type text := lower(trim(COALESCE(p_type, '')));
  v_entity text := lower(trim(COALESCE(p_entity_type, 'none')));
  v_recipient text := trim(COALESCE(p_recipient_id, ''));
  v_actor text := NULLIF(trim(COALESCE(p_actor_id, '')), '');
  v_dedupe text := trim(COALESCE(p_dedupe_key, ''));
  v_existing text;
BEGIN
  IF v_recipient = '' OR v_dedupe = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  -- Self-actions skipped except system/reputation_level_up (no actor or system actor)
  IF v_actor IS NOT NULL AND v_actor = v_recipient
     AND v_type NOT IN ('reputation_level_up', 'system') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN (
    'follow', 'post_like', 'post_comment', 'comment_reply',
    'curation', 'mention', 'share', 'reputation_level_up', 'system'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;
  SELECT id INTO v_existing FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;
  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id, v_recipient, v_actor, v_type, v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_dedupe
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_social_notifications IS
  'In-app social/system activity only. No GHC/Pi/ledger. Writes via service_role RPC.';

-- ============================================================================
-- SOURCE 097: 20261022010097_gh_social_canonical_visibility.sql
-- SHA256: c6b3c1fb64f4fa1d751766c294e7db181771612f69e5049274a0978c8e3dc8a1
-- ============================================================================
-- GH-CONNECT social visibility v3.
-- Additive RPCs: canonical viewer-aware visibility, mutual-follow support,
-- community membership enforcement, and stable keyset pagination.
-- Do not apply until Testnet/Mainnet migration history has been reconciled.

CREATE INDEX IF NOT EXISTS idx_gh_follows_follower_following_visibility
  ON public.gh_follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_gh_follows_following_follower_visibility
  ON public.gh_follows (following_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_ghc_user_blocks_blocker_blocked_visibility
  ON public.ghc_user_blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_ghc_user_blocks_blocked_blocker_visibility
  ON public.ghc_user_blocks (blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_gh_community_members_visibility
  ON public.gh_community_members (community_id, gh_user_id, status);
CREATE INDEX IF NOT EXISTS idx_gh_posts_feed_visibility_cursor
  ON public.gh_posts (created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gh_post_comments_visibility_cursor
  ON public.gh_post_comments (post_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.gh_post_viewer_can_read(
  p_viewer_id text,
  p_post_id text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_post public.gh_posts%ROWTYPE;
  v_viewer_follows_author boolean := false;
  v_author_follows_viewer boolean := false;
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL OR NULLIF(trim(p_post_id), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_post
  FROM public.gh_posts p
  WHERE p.id = trim(p_post_id)
    AND p.deleted_at IS NULL
    AND p.archived_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_post.author_id = trim(p_viewer_id) THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_viewer_id) AND b.blocked_id = v_post.author_id)
       OR (b.blocker_id = v_post.author_id AND b.blocked_id = trim(p_viewer_id))
  ) THEN RETURN false; END IF;

  -- Community-bound posts are visible only to active members, even if the
  -- post visibility flag is public/followers/mutuals.
  IF v_post.community_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members cm
    WHERE cm.community_id = v_post.community_id
      AND cm.gh_user_id = trim(p_viewer_id)
      AND lower(coalesce(cm.status, '')) = 'active'
  ) THEN RETURN false; END IF;

  v_viewer_follows_author := EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = trim(p_viewer_id) AND f.following_id = v_post.author_id
  );
  IF lower(coalesce(v_post.visibility, 'public')) = 'public' THEN RETURN true; END IF;
  IF lower(coalesce(v_post.visibility, 'public')) = 'followers' THEN
    RETURN v_viewer_follows_author;
  END IF;
  IF lower(coalesce(v_post.visibility, 'public')) = 'mutuals' THEN
    v_author_follows_viewer := EXISTS (
      SELECT 1 FROM public.gh_follows f
      WHERE f.follower_id = v_post.author_id AND f.following_id = trim(p_viewer_id)
    );
    RETURN v_viewer_follows_author AND v_author_follows_viewer;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_post_viewer_can_read(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_viewer_can_read(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_post_list_feed_v3(
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_rows jsonb;
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'VIEWER_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_FEED_CURSOR');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content, p.images, p.video, p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.community_id AS "communityId",
      p.community_name AS "communityName",
      p.content_type AS "contentType",
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      COALESCE(p.upvote_count, 0) AS "upvoteCount",
      COALESCE(p.downvote_count, 0) AS "downvoteCount",
      p.is_edited AS "isEdited",
      (extract(epoch FROM p.created_at) * 1000)::bigint AS "createdAt",
      (extract(epoch FROM p.deleted_at) * 1000)::bigint AS "deletedAt",
      EXISTS (SELECT 1 FROM public.gh_post_reactions r
              WHERE r.post_id = p.id AND r.user_id = trim(p_viewer_id) AND r.reaction = 'like') AS "likedByMe",
      (SELECT c.choice FROM public.gh_post_curations c
       WHERE c.post_id = p.id AND c.user_id = trim(p_viewer_id) LIMIT 1) AS "viewerCurationChoice"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL
      AND p.archived_at IS NULL
      AND public.gh_post_viewer_can_read(trim(p_viewer_id), p.id)
      AND (p_before_ms IS NULL
        OR (extract(epoch FROM p.created_at) * 1000)::bigint < p_before_ms
        OR ((extract(epoch FROM p.created_at) * 1000)::bigint = p_before_ms AND p.id < p_before_id))
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'posts', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_post_list_feed_v3(text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_list_feed_v3(text, integer, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_list_v3(
  p_post_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_rows jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 101);
BEGIN
  IF NULLIF(trim(p_viewer_id), '') IS NULL OR NULLIF(trim(p_post_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMENT_CURSOR');
  END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_viewer_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
      c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
      (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt"
    FROM public.gh_post_comments c
    WHERE c.post_id = trim(p_post_id) AND c.deleted_at IS NULL
      AND (p_before_ms IS NULL
        OR (extract(epoch FROM c.created_at) * 1000)::bigint < p_before_ms
        OR ((extract(epoch FROM c.created_at) * 1000)::bigint = p_before_ms AND c.id < p_before_id))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) TO service_role;

-- ============================================================================
-- SOURCE 098: 20261022010098_gh_social_engagement_write_integrity.sql
-- SHA256: 4aff495e88a6782731953686fc007dc4d1fa5475d9b542d6020437ee6008c572
-- ============================================================================
-- GH-CONNECT social engagement write integrity hardening.
-- Review and apply to disposable PostgreSQL/Testnet only after reconciling remote
-- migration history. It does not delete/fabricate source rows; it reconciles cached counters.
-- Fixes: concurrent reaction toggles/counters, curation counter drift, duplicate
-- comment IDs being incorrectly reported as success, and non-atomic comment delete.

-- Serialize curation changes per post and derive vote counters from the durable
-- canonical vote rows. gh_post_curation_set_with_reward continues to wrap this
-- function and the GHPV/reward writes in one PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer := 0;
  v_down integer := 0;
BEGIN
  IF v_post_id = '' OR length(v_post_id) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF v_user_id = '' OR length(v_user_id) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  -- A per-post lock prevents two different voters from racing stale counters.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate_post:' || v_post_id));
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author = v_user_id AND v_choice IN ('upvote', 'downvote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_CURATION_FORBIDDEN');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev FROM public.gh_post_curations
  WHERE post_id = v_post_id AND user_id = v_user_id;
  IF v_prev IS NOT NULL AND v_prev = v_choice THEN
    v_choice := 'neutral';
  END IF;

  IF v_choice = 'neutral' THEN
    DELETE FROM public.gh_post_curations WHERE post_id = v_post_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.gh_post_curations(post_id, user_id, choice, updated_at)
    VALUES (v_post_id, v_user_id, v_choice, now())
    ON CONFLICT (post_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now();
  END IF;

  SELECT count(*) FILTER (WHERE choice = 'upvote')::integer,
         count(*) FILTER (WHERE choice = 'downvote')::integer
    INTO v_up, v_down
  FROM public.gh_post_curations WHERE post_id = v_post_id;
  UPDATE public.gh_posts SET upvote_count = coalesce(v_up, 0),
    downvote_count = coalesce(v_down, 0), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'choice', v_choice,
    'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;

-- Serialize toggles per post so a concurrent request cannot increment like_count
-- when ON CONFLICT did not insert a row. The table remains the source of truth.
CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text, p_user_id text, p_reaction text DEFAULT 'like'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_reaction text := lower(trim(coalesce(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_active boolean := false;
  v_liked boolean := false;
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  IF v_post_id = '' OR v_user_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_reaction NOT IN ('like','love','laugh','wow','sad','angry','support','inspire','insight','celebrate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  DELETE FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = v_reaction;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_post_reactions(post_id, user_id, reaction)
    VALUES (v_post_id, v_user_id, v_reaction) ON CONFLICT (post_id, user_id, reaction) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND reaction = 'like';
  SELECT EXISTS (SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = 'like') INTO v_liked;
  UPDATE public.gh_posts SET like_count = greatest(0, coalesce(v_count, 0)), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'reaction', v_reaction, 'active', v_active,
    'liked', v_liked, 'likeCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;

-- Comment creation is idempotent only when a duplicate ID identifies the same
-- author/post/content. A conflicting ID must never be reported as saved.
CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_id text := trim(coalesce(p_row->>'id', ''));
  v_post text := trim(coalesce(p_row->>'postId', ''));
  v_author text := trim(coalesce(p_row->>'authorId', ''));
  v_name text := left(coalesce(p_row->>'authorName', ''), 120);
  v_photo text := left(coalesce(p_row->>'authorPhoto', ''), 2000);
  v_text text := coalesce(p_row->>'text', '');
  v_parent text := nullif(trim(coalesce(p_row->>'parentId', p_row->>'replyTo', '')), '');
  v_media jsonb := coalesce(p_row->'media', '[]'::jsonb);
  v_created timestamptz := now();
  v_inserted_id text;
  v_comment_count integer := 0;
  v_existing record;
BEGIN
  IF v_id = '' OR length(v_id) > 160 OR v_post = '' OR length(v_post) > 128
     OR v_author = '' OR length(v_author) > 256 OR length(v_text) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_author, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments WHERE id = v_parent AND post_id = v_post AND deleted_at IS NULL
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'PARENT_NOT_FOUND'); END IF;
  IF jsonb_typeof(v_media) <> 'array' THEN v_media := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_media) > 4 THEN
    SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_media
    FROM jsonb_array_elements(v_media) WITH ORDINALITY AS x(e, ord) WHERE ord <= 4;
  END IF;
  IF p_row ? 'createdAt' AND coalesce(p_row->>'createdAt','') ~ '^\d{1,16}$' THEN
    v_created := to_timestamp((p_row->>'createdAt')::numeric / 1000.0);
  END IF;

  INSERT INTO public.gh_post_comments(id, post_id, author_id, author_name, author_photo, text, parent_id, created_at, media)
  VALUES (v_id, v_post, v_author, v_name, v_photo, v_text, v_parent, v_created, v_media)
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT id, post_id, author_id, text, parent_id, media, deleted_at INTO v_existing
    FROM public.gh_post_comments WHERE id = v_id;
    IF FOUND AND v_existing.deleted_at IS NULL AND v_existing.post_id = v_post AND v_existing.author_id = v_author
      AND v_existing.text = v_text AND v_existing.parent_id IS NOT DISTINCT FROM v_parent
      AND coalesce(v_existing.media, '[]'::jsonb) = v_media THEN
      SELECT comment_count INTO v_comment_count FROM public.gh_posts WHERE id = v_post;
      RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', true,
        'commentCount', greatest(0, coalesce(v_comment_count, 0)));
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_ID_CONFLICT');
  END IF;

  UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0)) + 1, updated_at = now()
  WHERE id = v_post RETURNING comment_count INTO v_comment_count;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;

-- Atomic author-only soft delete and counter update. The route no longer does a
-- non-transactional PATCH followed by a no-op comment-list RPC.
CREATE OR REPLACE FUNCTION public.gh_comment_delete(
  p_post_id text, p_comment_id text, p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_author text;
  v_post_author text;
  v_deleted timestamptz;
  v_comment_count integer := 0;
BEGIN
  IF coalesce(trim(p_post_id), '') = '' OR coalesce(trim(p_comment_id), '') = ''
     OR coalesce(trim(p_actor_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id, comment_count INTO v_post_author, v_comment_count FROM public.gh_posts WHERE id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) AND v_post_author <> trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'idempotent', true,
    'commentCount', greatest(0, coalesce(v_comment_count, 0))); END IF;
  UPDATE public.gh_post_comments SET deleted_at = now()
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) AND deleted_at IS NULL;
  IF FOUND THEN
    UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0) - 1), updated_at = now()
    WHERE id = trim(p_post_id) RETURNING comment_count INTO v_comment_count;
  END IF;
  RETURN jsonb_build_object('ok', true, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_delete(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_delete(text, text, text) TO service_role;

-- Serialize comment emoji reactions on the comment row; only durable rows drive
-- returned counts. A repeated request cannot double-toggle due to racing reads.
CREATE OR REPLACE FUNCTION public.gh_comment_reaction_toggle(
  p_post_id text, p_comment_id text, p_user_id text, p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_comment_id text := trim(coalesce(p_comment_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_emoji text := left(trim(coalesce(p_emoji, '')), 16);
  v_active boolean := false;
  v_rows integer := 0;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF v_post_id = '' OR v_comment_id = '' OR v_user_id = '' OR v_emoji = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  PERFORM 1 FROM public.gh_post_comments
  WHERE id = v_comment_id AND post_id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_NOT_FOUND'); END IF;

  DELETE FROM public.gh_comment_reactions
  WHERE comment_id = v_comment_id AND post_id = v_post_id AND user_id = v_user_id AND emoji = v_emoji;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_comment_reactions(comment_id, post_id, user_id, emoji)
    VALUES (v_comment_id, v_post_id, v_user_id, v_emoji)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;
  SELECT coalesce(jsonb_object_agg(emoji, cnt), '{}'::jsonb) INTO v_counts
  FROM (SELECT emoji, count(*)::integer AS cnt FROM public.gh_comment_reactions
        WHERE comment_id = v_comment_id GROUP BY emoji) q;
  RETURN jsonb_build_object('ok', true, 'active', v_active, 'emoji', v_emoji, 'counts', coalesce(v_counts, '{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) TO service_role;

-- Reconcile existing denormalized counters from canonical durable rows once.
-- This changes only cached aggregate columns; it does not create or delete votes.
UPDATE public.gh_posts p SET
  upvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'upvote'),
  downvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'downvote'),
  like_count = (SELECT count(*)::integer FROM public.gh_post_reactions r WHERE r.post_id = p.id AND r.reaction = 'like'),
  comment_count = (SELECT count(*)::integer FROM public.gh_post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
  share_count = (SELECT count(*)::integer FROM public.gh_post_shares s WHERE s.post_id = p.id)
WHERE p.deleted_at IS NULL;

COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Atomic, serialized durable curation mutation; counters derived from gh_post_curations; service-role only.';
COMMENT ON FUNCTION public.gh_reaction_toggle(text, text, text) IS
  'Serialized durable post reaction toggle; like_count reconciled from gh_post_reactions; service-role only.';
COMMENT ON FUNCTION public.gh_comment_create(jsonb) IS
  'Durable idempotent comment creation; duplicate ID succeeds only for the same author/post/content; service-role only.';
COMMENT ON FUNCTION public.gh_comment_delete(text, text, text) IS
  'Atomic author-only comment soft-delete and post comment_count update; service-role only.';
COMMENT ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) IS
  'Serialized durable comment emoji reaction toggle; service-role only.';


-- Save toggles are serialized by the post row and cannot claim a save succeeded
-- if a conflicting request left a different final state. The route separately
-- verifies visibility; this RPC repeats essential visibility/block checks.
CREATE OR REPLACE FUNCTION public.gh_save_toggle(p_user_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_saved boolean;
BEGIN
  IF v_user = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_author <> v_user THEN
    IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = v_author)
         OR (b.blocker_id = v_author AND b.blocked_id = v_user)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_user)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_user AND status = 'active'
  ) AND v_author <> v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) THEN
    DELETE FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post;
    v_saved := false;
  ELSE
    INSERT INTO public.gh_saves(user_id, post_id) VALUES (v_user, v_post)
    ON CONFLICT (user_id, post_id) DO NOTHING;
    SELECT EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) INTO v_saved;
  END IF;
  RETURN jsonb_build_object('ok', true, 'saved', coalesce(v_saved, false));
END; $$;
REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role;

-- Share creation is idempotent per (sharer, post), serialized per post, and
-- reports the canonical existing share ID on retries.
CREATE OR REPLACE FUNCTION public.gh_post_share(p_sharer_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_sharer text := trim(coalesce(p_sharer_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_id text;
  v_count integer := 0;
BEGIN
  IF v_sharer = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_sharer, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_sharer AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_sharer)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;
  IF v_author <> v_sharer THEN
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_sharer)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_sharer AND status = 'active'
  ) AND v_author <> v_sharer THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  IF v_id IS NULL THEN
    v_id := 'share_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.gh_post_shares(id, post_id, sharer_id)
    VALUES (v_id, v_post, v_sharer)
    ON CONFLICT (sharer_id, post_id) DO NOTHING;
    SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  END IF;
  SELECT count(*)::integer INTO v_count FROM public.gh_post_shares WHERE post_id = v_post;
  UPDATE public.gh_posts SET share_count = greatest(0, coalesce(v_count, 0)), updated_at = now() WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'shareId', v_id, 'postId', v_post, 'authorId', v_author, 'shareCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_share(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_share(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_save_toggle(text, text) IS
  'Serialized durable save toggle with server-side visibility/block checks; service-role only.';
COMMENT ON FUNCTION public.gh_post_share(text, text) IS
  'Idempotent durable share edge with serialized canonical share_count; service-role only.';


-- Durable comment editing and owner-controlled pinning. Older builds updated
-- these fields only in React state, so the change vanished on refresh.
ALTER TABLE public.gh_post_comments
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by text;

CREATE OR REPLACE FUNCTION public.gh_comment_edit(
  p_post_id text, p_comment_id text, p_actor_id text, p_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_author text; v_deleted timestamptz; v_updated timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR coalesce(trim(p_text),'') = '' OR length(trim(p_text)) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.gh_post_comments SET text = trim(p_text), is_edited = true, edited_at = now()
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) RETURNING edited_at INTO v_updated;
  RETURN jsonb_build_object('ok', true, 'text', trim(p_text), 'isEdited', true,
    'editedAt', (extract(epoch FROM v_updated) * 1000)::bigint);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_edit(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_edit(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_pin_set(
  p_post_id text, p_comment_id text, p_actor_id text, p_pinned boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_post_author text; v_deleted timestamptz; v_pinned boolean; v_pinned_at timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR p_pinned IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id INTO v_post_author FROM public.gh_posts
    WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_post_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT deleted_at INTO v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.gh_post_comments SET is_pinned = p_pinned,
    pinned_at = CASE WHEN p_pinned THEN now() ELSE NULL END,
    pinned_by = CASE WHEN p_pinned THEN trim(p_actor_id) ELSE NULL END
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id)
    RETURNING is_pinned, pinned_at INTO v_pinned, v_pinned_at;
  RETURN jsonb_build_object('ok', true, 'isPinned', v_pinned,
    'pinnedAt', CASE WHEN v_pinned_at IS NULL THEN NULL ELSE (extract(epoch FROM v_pinned_at) * 1000)::bigint END);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) TO service_role;

-- Upgrade the canonical comment-list RPC without changing its signature.
CREATE OR REPLACE FUNCTION public.gh_comment_list_v3(
  p_post_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_rows jsonb; v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 101);
BEGIN
  IF nullif(trim(p_viewer_id), '') IS NULL OR nullif(trim(p_post_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMENT_CURSOR');
  END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_viewer_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows FROM (
      SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
        c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
        (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt",
        coalesce(c.media, '[]'::jsonb) AS "mediaAttachments",
        c.is_edited AS "isEdited",
        CASE WHEN c.edited_at IS NULL THEN NULL ELSE (extract(epoch FROM c.edited_at) * 1000)::bigint END AS "editedAt",
        coalesce(c.is_pinned, false) AS "isPinned"
      FROM public.gh_post_comments c
      WHERE c.post_id = trim(p_post_id) AND c.deleted_at IS NULL
        AND (p_before_ms IS NULL
          OR (extract(epoch FROM c.created_at) * 1000)::bigint < p_before_ms
          OR ((extract(epoch FROM c.created_at) * 1000)::bigint = p_before_ms AND c.id < p_before_id))
      ORDER BY c.created_at DESC, c.id DESC LIMIT v_limit
    ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) TO service_role;

COMMENT ON FUNCTION public.gh_comment_edit(text, text, text, text) IS
  'Durable author-only comment edit with edited timestamp; service-role only.';
COMMENT ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) IS
  'Durable post-owner-only comment pin state; service-role only.';

-- ============================================================================
-- SOURCE 099: 20261022010099_ENSURE_social_engagement_rpcs.sql
-- SHA256: f08d9727b91bd40340e2ea788b3d3ca0cc57f593d56bdc5f2d3f04835a3ac52e
-- ============================================================================
-- ENSURE: apply in Supabase SQL Editor if social RPC returns HTTP 404
-- Safe CREATE OR REPLACE for comment/save/curation/reaction RPCs

-- GH-CONNECT social engagement write integrity hardening.
-- Review and apply to disposable PostgreSQL/Testnet only after reconciling remote
-- migration history. It does not delete/fabricate source rows; it reconciles cached counters.
-- Fixes: concurrent reaction toggles/counters, curation counter drift, duplicate
-- comment IDs being incorrectly reported as success, and non-atomic comment delete.

-- Serialize curation changes per post and derive vote counters from the durable
-- canonical vote rows. gh_post_curation_set_with_reward continues to wrap this
-- function and the GHPV/reward writes in one PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.gh_post_curation_set(
  p_post_id text,
  p_user_id text,
  p_choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_choice text := lower(trim(coalesce(p_choice, 'neutral')));
  v_author text;
  v_visibility text;
  v_prev text;
  v_up integer := 0;
  v_down integer := 0;
BEGIN
  IF v_post_id = '' OR length(v_post_id) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;
  IF v_user_id = '' OR length(v_user_id) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF v_choice NOT IN ('upvote', 'downvote', 'neutral') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CHOICE');
  END IF;

  -- A per-post lock prevents two different voters from racing stale counters.
  PERFORM pg_advisory_xact_lock(hashtext('gh_curate_post:' || v_post_id));
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author = v_user_id AND v_choice IN ('upvote', 'downvote') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_CURATION_FORBIDDEN');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT choice INTO v_prev FROM public.gh_post_curations
  WHERE post_id = v_post_id AND user_id = v_user_id;
  IF v_prev IS NOT NULL AND v_prev = v_choice THEN
    v_choice := 'neutral';
  END IF;

  IF v_choice = 'neutral' THEN
    DELETE FROM public.gh_post_curations WHERE post_id = v_post_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.gh_post_curations(post_id, user_id, choice, updated_at)
    VALUES (v_post_id, v_user_id, v_choice, now())
    ON CONFLICT (post_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now();
  END IF;

  SELECT count(*) FILTER (WHERE choice = 'upvote')::integer,
         count(*) FILTER (WHERE choice = 'downvote')::integer
    INTO v_up, v_down
  FROM public.gh_post_curations WHERE post_id = v_post_id;
  UPDATE public.gh_posts SET upvote_count = coalesce(v_up, 0),
    downvote_count = coalesce(v_down, 0), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'choice', v_choice,
    'upvoteCount', coalesce(v_up, 0), 'downvoteCount', coalesce(v_down, 0));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_curation_set(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set(text, text, text) TO service_role;

-- Serialize toggles per post so a concurrent request cannot increment like_count
-- when ON CONFLICT did not insert a row. The table remains the source of truth.
CREATE OR REPLACE FUNCTION public.gh_reaction_toggle(
  p_post_id text, p_user_id text, p_reaction text DEFAULT 'like'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_reaction text := lower(trim(coalesce(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_active boolean := false;
  v_liked boolean := false;
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  IF v_post_id = '' OR v_user_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_reaction NOT IN ('like','love','laugh','wow','sad','angry','support','inspire','insight','celebrate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  DELETE FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = v_reaction;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_post_reactions(post_id, user_id, reaction)
    VALUES (v_post_id, v_user_id, v_reaction) ON CONFLICT (post_id, user_id, reaction) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;

  SELECT count(*)::integer INTO v_count FROM public.gh_post_reactions
  WHERE post_id = v_post_id AND reaction = 'like';
  SELECT EXISTS (SELECT 1 FROM public.gh_post_reactions
    WHERE post_id = v_post_id AND user_id = v_user_id AND reaction = 'like') INTO v_liked;
  UPDATE public.gh_posts SET like_count = greatest(0, coalesce(v_count, 0)), updated_at = now()
  WHERE id = v_post_id;

  RETURN jsonb_build_object('ok', true, 'reaction', v_reaction, 'active', v_active,
    'liked', v_liked, 'likeCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role;

-- Comment creation is idempotent only when a duplicate ID identifies the same
-- author/post/content. A conflicting ID must never be reported as saved.
CREATE OR REPLACE FUNCTION public.gh_comment_create(p_row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_id text := trim(coalesce(p_row->>'id', ''));
  v_post text := trim(coalesce(p_row->>'postId', ''));
  v_author text := trim(coalesce(p_row->>'authorId', ''));
  v_name text := left(coalesce(p_row->>'authorName', ''), 120);
  v_photo text := left(coalesce(p_row->>'authorPhoto', ''), 2000);
  v_text text := coalesce(p_row->>'text', '');
  v_parent text := nullif(trim(coalesce(p_row->>'parentId', p_row->>'replyTo', '')), '');
  v_media jsonb := coalesce(p_row->'media', '[]'::jsonb);
  v_created timestamptz := now();
  v_inserted_id text;
  v_comment_count integer := 0;
  v_existing record;
BEGIN
  IF v_id = '' OR length(v_id) > 160 OR v_post = '' OR length(v_post) > 128
     OR v_author = '' OR length(v_author) > 256 OR length(v_text) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF NOT public.gh_post_viewer_can_read(v_author, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_post_comments WHERE id = v_parent AND post_id = v_post AND deleted_at IS NULL
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'PARENT_NOT_FOUND'); END IF;
  IF jsonb_typeof(v_media) <> 'array' THEN v_media := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_media) > 4 THEN
    SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_media
    FROM jsonb_array_elements(v_media) WITH ORDINALITY AS x(e, ord) WHERE ord <= 4;
  END IF;
  IF p_row ? 'createdAt' AND coalesce(p_row->>'createdAt','') ~ '^\d{1,16}$' THEN
    v_created := to_timestamp((p_row->>'createdAt')::numeric / 1000.0);
  END IF;

  INSERT INTO public.gh_post_comments(id, post_id, author_id, author_name, author_photo, text, parent_id, created_at, media)
  VALUES (v_id, v_post, v_author, v_name, v_photo, v_text, v_parent, v_created, v_media)
  ON CONFLICT (id) DO NOTHING RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT id, post_id, author_id, text, parent_id, media, deleted_at INTO v_existing
    FROM public.gh_post_comments WHERE id = v_id;
    IF FOUND AND v_existing.deleted_at IS NULL AND v_existing.post_id = v_post AND v_existing.author_id = v_author
      AND v_existing.text = v_text AND v_existing.parent_id IS NOT DISTINCT FROM v_parent
      AND coalesce(v_existing.media, '[]'::jsonb) = v_media THEN
      SELECT comment_count INTO v_comment_count FROM public.gh_posts WHERE id = v_post;
      RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', true,
        'commentCount', greatest(0, coalesce(v_comment_count, 0)));
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_ID_CONFLICT');
  END IF;

  UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0)) + 1, updated_at = now()
  WHERE id = v_post RETURNING comment_count INTO v_comment_count;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role;

-- Atomic author-only soft delete and counter update. The route no longer does a
-- non-transactional PATCH followed by a no-op comment-list RPC.
CREATE OR REPLACE FUNCTION public.gh_comment_delete(
  p_post_id text, p_comment_id text, p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_author text;
  v_post_author text;
  v_deleted timestamptz;
  v_comment_count integer := 0;
BEGIN
  IF coalesce(trim(p_post_id), '') = '' OR coalesce(trim(p_comment_id), '') = ''
     OR coalesce(trim(p_actor_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id, comment_count INTO v_post_author, v_comment_count FROM public.gh_posts WHERE id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) AND v_post_author <> trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'idempotent', true,
    'commentCount', greatest(0, coalesce(v_comment_count, 0))); END IF;
  UPDATE public.gh_post_comments SET deleted_at = now()
  WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) AND deleted_at IS NULL;
  IF FOUND THEN
    UPDATE public.gh_posts SET comment_count = greatest(0, coalesce(comment_count, 0) - 1), updated_at = now()
    WHERE id = trim(p_post_id) RETURNING comment_count INTO v_comment_count;
  END IF;
  RETURN jsonb_build_object('ok', true, 'idempotent', false,
    'commentCount', greatest(0, coalesce(v_comment_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_delete(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_delete(text, text, text) TO service_role;

-- Serialize comment emoji reactions on the comment row; only durable rows drive
-- returned counts. A repeated request cannot double-toggle due to racing reads.
CREATE OR REPLACE FUNCTION public.gh_comment_reaction_toggle(
  p_post_id text, p_comment_id text, p_user_id text, p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_post_id text := trim(coalesce(p_post_id, ''));
  v_comment_id text := trim(coalesce(p_comment_id, ''));
  v_user_id text := trim(coalesce(p_user_id, ''));
  v_emoji text := left(trim(coalesce(p_emoji, '')), 16);
  v_active boolean := false;
  v_rows integer := 0;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF v_post_id = '' OR v_comment_id = '' OR v_user_id = '' OR v_emoji = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user_id, v_post_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  PERFORM 1 FROM public.gh_post_comments
  WHERE id = v_comment_id AND post_id = v_post_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'COMMENT_NOT_FOUND'); END IF;

  DELETE FROM public.gh_comment_reactions
  WHERE comment_id = v_comment_id AND post_id = v_post_id AND user_id = v_user_id AND emoji = v_emoji;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    v_active := false;
  ELSE
    INSERT INTO public.gh_comment_reactions(comment_id, post_id, user_id, emoji)
    VALUES (v_comment_id, v_post_id, v_user_id, v_emoji)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_active := v_rows > 0;
  END IF;
  SELECT coalesce(jsonb_object_agg(emoji, cnt), '{}'::jsonb) INTO v_counts
  FROM (SELECT emoji, count(*)::integer AS cnt FROM public.gh_comment_reactions
        WHERE comment_id = v_comment_id GROUP BY emoji) q;
  RETURN jsonb_build_object('ok', true, 'active', v_active, 'emoji', v_emoji, 'counts', coalesce(v_counts, '{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) TO service_role;

-- Reconcile existing denormalized counters from canonical durable rows once.
-- This changes only cached aggregate columns; it does not create or delete votes.
UPDATE public.gh_posts p SET
  upvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'upvote'),
  downvote_count = (SELECT count(*)::integer FROM public.gh_post_curations c WHERE c.post_id = p.id AND c.choice = 'downvote'),
  like_count = (SELECT count(*)::integer FROM public.gh_post_reactions r WHERE r.post_id = p.id AND r.reaction = 'like'),
  comment_count = (SELECT count(*)::integer FROM public.gh_post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
  share_count = (SELECT count(*)::integer FROM public.gh_post_shares s WHERE s.post_id = p.id)
WHERE p.deleted_at IS NULL;

COMMENT ON FUNCTION public.gh_post_curation_set(text, text, text) IS
  'Atomic, serialized durable curation mutation; counters derived from gh_post_curations; service-role only.';
COMMENT ON FUNCTION public.gh_reaction_toggle(text, text, text) IS
  'Serialized durable post reaction toggle; like_count reconciled from gh_post_reactions; service-role only.';
COMMENT ON FUNCTION public.gh_comment_create(jsonb) IS
  'Durable idempotent comment creation; duplicate ID succeeds only for the same author/post/content; service-role only.';
COMMENT ON FUNCTION public.gh_comment_delete(text, text, text) IS
  'Atomic author-only comment soft-delete and post comment_count update; service-role only.';
COMMENT ON FUNCTION public.gh_comment_reaction_toggle(text, text, text, text) IS
  'Serialized durable comment emoji reaction toggle; service-role only.';


-- Save toggles are serialized by the post row and cannot claim a save succeeded
-- if a conflicting request left a different final state. The route separately
-- verifies visibility; this RPC repeats essential visibility/block checks.
CREATE OR REPLACE FUNCTION public.gh_save_toggle(p_user_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_saved boolean;
BEGIN
  IF v_user = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_user, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_author <> v_user THEN
    IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = v_user AND b.blocked_id = v_author)
         OR (b.blocker_id = v_author AND b.blocked_id = v_user)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_user AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_user)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_user AND status = 'active'
  ) AND v_author <> v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) THEN
    DELETE FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post;
    v_saved := false;
  ELSE
    INSERT INTO public.gh_saves(user_id, post_id) VALUES (v_user, v_post)
    ON CONFLICT (user_id, post_id) DO NOTHING;
    SELECT EXISTS (SELECT 1 FROM public.gh_saves WHERE user_id = v_user AND post_id = v_post) INTO v_saved;
  END IF;
  RETURN jsonb_build_object('ok', true, 'saved', coalesce(v_saved, false));
END; $$;
REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role;

-- Share creation is idempotent per (sharer, post), serialized per post, and
-- reports the canonical existing share ID on retries.
CREATE OR REPLACE FUNCTION public.gh_post_share(p_sharer_id text, p_post_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_sharer text := trim(coalesce(p_sharer_id, ''));
  v_post text := trim(coalesce(p_post_id, ''));
  v_author text;
  v_visibility text;
  v_community text;
  v_id text;
  v_count integer := 0;
BEGIN
  IF v_sharer = '' OR v_post = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED'); END IF;
  SELECT author_id, visibility, community_id INTO v_author, v_visibility, v_community
  FROM public.gh_posts WHERE id = v_post AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(v_sharer, v_post) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_sharer AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_sharer)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;
  IF v_author <> v_sharer THEN
    IF v_visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility = 'mutuals' AND NOT (
      EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_sharer AND following_id = v_author)
      AND EXISTS (SELECT 1 FROM public.gh_follows WHERE follower_id = v_author AND following_id = v_sharer)
    ) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
    IF v_visibility NOT IN ('public','followers','mutuals') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  END IF;
  IF v_community IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gh_community_members
    WHERE community_id = v_community AND gh_user_id = v_sharer AND status = 'active'
  ) AND v_author <> v_sharer THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  IF v_id IS NULL THEN
    v_id := 'share_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.gh_post_shares(id, post_id, sharer_id)
    VALUES (v_id, v_post, v_sharer)
    ON CONFLICT (sharer_id, post_id) DO NOTHING;
    SELECT id INTO v_id FROM public.gh_post_shares WHERE sharer_id = v_sharer AND post_id = v_post;
  END IF;
  SELECT count(*)::integer INTO v_count FROM public.gh_post_shares WHERE post_id = v_post;
  UPDATE public.gh_posts SET share_count = greatest(0, coalesce(v_count, 0)), updated_at = now() WHERE id = v_post;
  RETURN jsonb_build_object('ok', true, 'shareId', v_id, 'postId', v_post, 'authorId', v_author, 'shareCount', greatest(0, coalesce(v_count, 0)));
END; $$;
REVOKE ALL ON FUNCTION public.gh_post_share(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_share(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_save_toggle(text, text) IS
  'Serialized durable save toggle with server-side visibility/block checks; service-role only.';
COMMENT ON FUNCTION public.gh_post_share(text, text) IS
  'Idempotent durable share edge with serialized canonical share_count; service-role only.';


-- Durable comment editing and owner-controlled pinning. Older builds updated
-- these fields only in React state, so the change vanished on refresh.
ALTER TABLE public.gh_post_comments
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by text;

CREATE OR REPLACE FUNCTION public.gh_comment_edit(
  p_post_id text, p_comment_id text, p_actor_id text, p_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_author text; v_deleted timestamptz; v_updated timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR coalesce(trim(p_text),'') = '' OR length(trim(p_text)) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  PERFORM 1 FROM public.gh_posts WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT author_id, deleted_at INTO v_author, v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  UPDATE public.gh_post_comments SET text = trim(p_text), is_edited = true, edited_at = now()
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) RETURNING edited_at INTO v_updated;
  RETURN jsonb_build_object('ok', true, 'text', trim(p_text), 'isEdited', true,
    'editedAt', (extract(epoch FROM v_updated) * 1000)::bigint);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_edit(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_edit(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_comment_pin_set(
  p_post_id text, p_comment_id text, p_actor_id text, p_pinned boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_post_author text; v_deleted timestamptz; v_pinned boolean; v_pinned_at timestamptz;
BEGIN
  IF coalesce(trim(p_post_id),'') = '' OR coalesce(trim(p_comment_id),'') = ''
     OR coalesce(trim(p_actor_id),'') = '' OR p_pinned IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  SELECT author_id INTO v_post_author FROM public.gh_posts
    WHERE id = trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND'); END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_actor_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_post_author <> trim(p_actor_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;
  SELECT deleted_at INTO v_deleted FROM public.gh_post_comments
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id) FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.gh_post_comments SET is_pinned = p_pinned,
    pinned_at = CASE WHEN p_pinned THEN now() ELSE NULL END,
    pinned_by = CASE WHEN p_pinned THEN trim(p_actor_id) ELSE NULL END
    WHERE id = trim(p_comment_id) AND post_id = trim(p_post_id)
    RETURNING is_pinned, pinned_at INTO v_pinned, v_pinned_at;
  RETURN jsonb_build_object('ok', true, 'isPinned', v_pinned,
    'pinnedAt', CASE WHEN v_pinned_at IS NULL THEN NULL ELSE (extract(epoch FROM v_pinned_at) * 1000)::bigint END);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) TO service_role;

-- Upgrade the canonical comment-list RPC without changing its signature.
CREATE OR REPLACE FUNCTION public.gh_comment_list_v3(
  p_post_id text,
  p_viewer_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_rows jsonb; v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 101);
BEGIN
  IF nullif(trim(p_viewer_id), '') IS NULL OR nullif(trim(p_post_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COMMENT_CURSOR');
  END IF;
  IF NOT public.gh_post_viewer_can_read(trim(p_viewer_id), trim(p_post_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC, q.id DESC), '[]'::jsonb)
    INTO v_rows FROM (
      SELECT c.id, c.author_id AS "authorId", c.author_name AS "authorName",
        c.author_photo AS "authorPhoto", c.text, c.parent_id AS "replyTo",
        (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt",
        coalesce(c.media, '[]'::jsonb) AS "mediaAttachments",
        c.is_edited AS "isEdited",
        CASE WHEN c.edited_at IS NULL THEN NULL ELSE (extract(epoch FROM c.edited_at) * 1000)::bigint END AS "editedAt",
        coalesce(c.is_pinned, false) AS "isPinned"
      FROM public.gh_post_comments c
      WHERE c.post_id = trim(p_post_id) AND c.deleted_at IS NULL
        AND (p_before_ms IS NULL
          OR (extract(epoch FROM c.created_at) * 1000)::bigint < p_before_ms
          OR ((extract(epoch FROM c.created_at) * 1000)::bigint = p_before_ms AND c.id < p_before_id))
      ORDER BY c.created_at DESC, c.id DESC LIMIT v_limit
    ) q;
  RETURN jsonb_build_object('ok', true, 'comments', v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_comment_list_v3(text, text, integer, bigint, text) TO service_role;

COMMENT ON FUNCTION public.gh_comment_edit(text, text, text, text) IS
  'Durable author-only comment edit with edited timestamp; service-role only.';
COMMENT ON FUNCTION public.gh_comment_pin_set(text, text, text, boolean) IS
  'Durable post-owner-only comment pin state; service-role only.';
-- GreenHaven curation pipeline hardening.
-- TESTNET first. Keeps vote, one-time GHC reward decision, and active GHPV weight
-- in one PostgreSQL transaction. No database is modified by adding this file.

DROP FUNCTION IF EXISTS public.gh_post_curation_set_with_reward(text, text, text, numeric);

-- Persist the selected percentage alongside the active vote instead of keeping
-- it only in a card's transient React state.
ALTER TABLE public.gh_post_curations
  ADD COLUMN IF NOT EXISTS reward_percentage numeric(5,2) NOT NULL DEFAULT 100
  CHECK (reward_percentage >= 0 AND reward_percentage <= 100);

CREATE OR REPLACE FUNCTION public.gh_post_curation_set_with_reward(
  p_post_id text,
  p_user_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100,
  p_curation_weight numeric DEFAULT 0,
  p_judgment_mode text DEFAULT 'useful'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote jsonb;
  v_choice text;
  v_reward jsonb := jsonb_build_object(
    'ok', true, 'credited', false, 'amount', 0, 'reason', 'NO_REWARD_FOR_NON_UPVOTE'
  );
  v_weighted jsonb;
  v_weight numeric(18,6) := greatest(0, least(coalesce(p_curation_weight, 0), 1000000));
  v_percentage numeric(5,2) := round(coalesce(p_percentage, 100), 2);
BEGIN
  IF v_percentage < 0 OR v_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERCENTAGE');
  END IF;

  v_vote := public.gh_post_curation_set(p_post_id, p_user_id, p_choice);
  IF coalesce((v_vote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_vote;
  END IF;

  v_choice := coalesce(v_vote->>'choice', 'neutral');
  IF v_choice IN ('upvote', 'downvote') THEN
    UPDATE public.gh_post_curations
      SET reward_percentage = v_percentage, updated_at = now()
      WHERE post_id = trim(p_post_id) AND user_id = trim(p_user_id);
  END IF;
  IF v_choice = 'upvote' THEN
    v_reward := public.ghc_curation_reward_credit(
      p_user_id, p_post_id, v_choice, v_percentage
    );
    IF coalesce((v_reward->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curation reward evaluation failed: %',
        coalesce(v_reward->>'error', 'REWARD_EVALUATION_FAILED');
    END IF;
  END IF;

  -- The GHPV active-weight record is part of the same transaction. The caller
  -- derives p_curation_weight from server-side reputation/calibration, never client input.
  v_weighted := public.gh_ghpv_record_curation_weight(
    p_post_id,
    p_user_id,
    v_choice,
    CASE WHEN v_choice = 'neutral' THEN 0 ELSE v_weight * (v_percentage / 100) END,
    p_judgment_mode
  );
  IF coalesce((v_weighted->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GHPV curation weight update failed: %',
      coalesce(v_weighted->>'error', 'GHPV_WEIGHT_UPDATE_FAILED');
  END IF;

  RETURN v_vote || jsonb_build_object('reward', v_reward, 'ghpv', v_weighted,
    'rewardPercentage', v_percentage);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) TO service_role;
COMMENT ON FUNCTION public.gh_post_curation_set_with_reward(text, text, text, numeric, numeric, text) IS
  'Atomic curation pipeline: authoritative vote, one-time GHC reward decision, and active GHPV weight. Percentage scales reward and active curation weight; does not mutate account reputation directly.';

-- ============================================================================
-- SOURCE 100: 20261022010100_pgrst_reload_social_rpcs.sql
-- SHA256: e290543da008a4d9ee83835ab5510f20830a6f520b0b12dfec9a3f94a0055222
-- ============================================================================
-- Non-destructive: nudge PostgREST schema cache after social RPC installs/overloads.
-- Does not grant EXECUTE to anon/authenticated; service_role remains the only app caller.
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- SOURCE 101: 20261022010101_gh_content_rewards.sql
-- SHA256: 060d40ee22f9f356185ff4665d3c464462c4211b81d6f0ab592dde000f6ad4d1
-- ============================================================================
-- =============================================================================
-- GH-CONNECT — Content reward state (public display + system settlement)
-- Forward-only. Do NOT apply until Testnet operator gate.
--
-- Security:
-- - Client RLS deny-all
-- - Writes only via SECURITY DEFINER RPCs callable by service_role
-- - Votes do NOT auto-insert reward rows (no vote→mint)
-- - Distribution to ledger is a separate economy path (not in this migration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gh_content_rewards (
  post_id           text PRIMARY KEY,
  status            text NOT NULL DEFAULT 'inactive'
                    CHECK (status IN ('inactive', 'accruing', 'finalized', 'distributed', 'voided')),
  enabled           boolean NOT NULL DEFAULT false,
  total_earned      numeric(24, 8) NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  author_reward     numeric(24, 8) NOT NULL DEFAULT 0 CHECK (author_reward >= 0),
  curation_reward   numeric(24, 8) NOT NULL DEFAULT 0 CHECK (curation_reward >= 0),
  upvote_impact     numeric(24, 8) NOT NULL DEFAULT 0,
  downvote_impact   numeric(24, 8) NOT NULL DEFAULT 0,
  net_impact        numeric(24, 8) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'GHC' CHECK (currency = 'GHC'),
  epoch_key         text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  finalized_at      timestamptz,
  distributed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_content_rewards_status
  ON public.gh_content_rewards (status)
  WHERE status <> 'inactive';

ALTER TABLE public.gh_content_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_rewards_no_client ON public.gh_content_rewards;
CREATE POLICY gh_content_rewards_no_client ON public.gh_content_rewards
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_content_rewards IS
  'Public content reward totals. System-written only. Votes do not mint GHC.';

-- Optional public curator previews (no private wallet data)
CREATE TABLE IF NOT EXISTS public.gh_content_reward_contributors (
  post_id     text NOT NULL REFERENCES public.gh_content_rewards(post_id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  username    text NOT NULL,
  amount      numeric(24, 8) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rank        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.gh_content_reward_contributors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_reward_contributors_no_client ON public.gh_content_reward_contributors;
CREATE POLICY gh_content_reward_contributors_no_client ON public.gh_content_reward_contributors
  FOR ALL USING (false) WITH CHECK (false);

/**
 * Public read of content reward for a post.
 * Safe fields only. service_role execute.
 */
CREATE OR REPLACE FUNCTION public.gh_content_reward_get_public(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_row public.gh_content_rewards%ROWTYPE;
  v_contrib jsonb := '[]'::jsonb;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  SELECT * INTO v_row FROM public.gh_content_rewards WHERE post_id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'enabled', false,
      'status', 'inactive',
      'totalEarned', null,
      'authorReward', null,
      'curationReward', null
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'username', c.username,
      'amount', c.amount
    ) ORDER BY c.rank ASC, c.amount DESC
  ), '[]'::jsonb)
  INTO v_contrib
  FROM (
    SELECT username, amount, rank
    FROM public.gh_content_reward_contributors
    WHERE post_id = v_id
    ORDER BY rank ASC, amount DESC
    LIMIT 10
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', v_row.enabled,
    'status', v_row.status,
    'totalEarned', v_row.total_earned,
    'authorReward', v_row.author_reward,
    'curationReward', v_row.curation_reward,
    'upvoteImpact', v_row.upvote_impact,
    'downvoteImpact', v_row.downvote_impact,
    'netImpact', v_row.net_impact,
    'currency', v_row.currency,
    'topContributors', v_contrib,
    'finalizedAt', v_row.finalized_at,
    'distributedAt', v_row.distributed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_reward_get_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_get_public(text) TO service_role;

/**
 * System upsert of content reward totals (service_role only).
 * Does not touch ghc_transactions / ledger — distribution is a separate step.
 */
CREATE OR REPLACE FUNCTION public.gh_content_reward_system_upsert(
  p_post_id text,
  p_status text,
  p_enabled boolean,
  p_total_earned numeric,
  p_author_reward numeric,
  p_curation_reward numeric,
  p_upvote_impact numeric DEFAULT 0,
  p_downvote_impact numeric DEFAULT 0,
  p_net_impact numeric DEFAULT 0,
  p_epoch_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_status text := lower(trim(COALESCE(p_status, 'inactive')));
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;
  IF v_status NOT IN ('inactive', 'accruing', 'finalized', 'distributed', 'voided') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;
  IF COALESCE(p_total_earned, 0) < 0 OR COALESCE(p_author_reward, 0) < 0 OR COALESCE(p_curation_reward, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NEGATIVE_AMOUNT');
  END IF;

  INSERT INTO public.gh_content_rewards AS r (
    post_id, status, enabled, total_earned, author_reward, curation_reward,
    upvote_impact, downvote_impact, net_impact, epoch_key, updated_at,
    finalized_at, distributed_at
  ) VALUES (
    v_id, v_status, COALESCE(p_enabled, false),
    COALESCE(p_total_earned, 0), COALESCE(p_author_reward, 0), COALESCE(p_curation_reward, 0),
    COALESCE(p_upvote_impact, 0), COALESCE(p_downvote_impact, 0), COALESCE(p_net_impact, 0),
    p_epoch_key, now(),
    CASE WHEN v_status IN ('finalized', 'distributed') THEN now() ELSE NULL END,
    CASE WHEN v_status = 'distributed' THEN now() ELSE NULL END
  )
  ON CONFLICT (post_id) DO UPDATE SET
    status = EXCLUDED.status,
    enabled = EXCLUDED.enabled,
    total_earned = EXCLUDED.total_earned,
    author_reward = EXCLUDED.author_reward,
    curation_reward = EXCLUDED.curation_reward,
    upvote_impact = EXCLUDED.upvote_impact,
    downvote_impact = EXCLUDED.downvote_impact,
    net_impact = EXCLUDED.net_impact,
    epoch_key = COALESCE(EXCLUDED.epoch_key, r.epoch_key),
    updated_at = now(),
    finalized_at = CASE
      WHEN EXCLUDED.status IN ('finalized', 'distributed') THEN COALESCE(r.finalized_at, now())
      ELSE r.finalized_at
    END,
    distributed_at = CASE
      WHEN EXCLUDED.status = 'distributed' THEN COALESCE(r.distributed_at, now())
      ELSE r.distributed_at
    END;

  RETURN jsonb_build_object('ok', true, 'postId', v_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_reward_system_upsert(
  text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_system_upsert(
  text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, text
) TO service_role;

-- Optional counts helper used by application (idempotent if already defined elsewhere)
CREATE OR REPLACE FUNCTION public.gh_post_curation_counts(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_up bigint := 0;
  v_down bigint := 0;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;
  IF to_regclass('public.gh_post_curations') IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upvoteCount', 0, 'downvoteCount', 0);
  END IF;
  SELECT
    COUNT(*) FILTER (WHERE choice = 'upvote'),
    COUNT(*) FILTER (WHERE choice = 'downvote')
  INTO v_up, v_down
  FROM public.gh_post_curations
  WHERE post_id = v_id
    AND (deleted_at IS NULL);
  RETURN jsonb_build_object(
    'ok', true,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
EXCEPTION WHEN undefined_column THEN
  SELECT
    COUNT(*) FILTER (WHERE choice = 'upvote'),
    COUNT(*) FILTER (WHERE choice = 'downvote')
  INTO v_up, v_down
  FROM public.gh_post_curations
  WHERE post_id = v_id;
  RETURN jsonb_build_object(
    'ok', true,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_counts(text) TO service_role;

-- ============================================================================
-- SOURCE 102: 20261022010102_gh_profile_content_library.sql
-- SHA256: e26bc6222618ec5b1a943b16d624a1fd9b3caa4bea3cba802740593fc0f96f49
-- ============================================================================
-- GH Profile Content Library: safe, viewer-authorized post search and pagination.
-- Additive only. Does not alter wallet, reward, membership, or post-write paths.
-- Keep the profile timeline cursor aligned with the active-post query.
CREATE INDEX IF NOT EXISTS idx_gh_posts_profile_library_cursor
  ON public.gh_posts (author_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.gh_post_list_profile_content(
  p_viewer_id text,
  p_profile_id text,
  p_limit integer DEFAULT 40,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_media_kind text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 50);
  v_query text := left(trim(COALESCE(p_query, '')), 120);
  v_kind text := lower(trim(COALESCE(p_media_kind, 'all')));
  v_rows jsonb;
  v_count integer := 0;
  v_oldest timestamptz;
  v_oldest_id text;
BEGIN
  IF p_viewer_id IS NULL OR length(trim(p_viewer_id)) = 0
     OR p_profile_id IS NULL OR length(trim(p_profile_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;

  IF v_kind NOT IN ('all', 'posts', 'photos', 'videos', 'documents') THEN
    v_kind := 'all';
  END IF;

  -- Mutuals means mutual follows consistently across feed, comments, and profile.

  -- A block in either direction suppresses the entire profile from the viewer.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_viewer_id) AND b.blocked_id = trim(p_profile_id))
       OR (b.blocker_id = trim(p_profile_id) AND b.blocked_id = trim(p_viewer_id))
  ) THEN
    RETURN jsonb_build_object('ok', true, 'posts', '[]'::jsonb, 'hasMore', false, 'nextBefore', null);
  END IF;

  SELECT count(*)
    INTO v_count
  FROM (
    SELECT p.created_at
    FROM public.gh_posts p
    WHERE p.author_id = trim(p_profile_id)
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      -- Community-bound profile posts require active membership. The author can
      -- always review their own content; other viewers cannot infer private posts.
      AND (
        p.community_id IS NULL
        OR p.author_id = trim(p_viewer_id)
        OR EXISTS (
          SELECT 1 FROM public.gh_community_members cm
          WHERE cm.community_id = p.community_id
            AND cm.gh_user_id = trim(p_viewer_id)
            AND lower(coalesce(cm.status, '')) = 'active'
        )
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at) * 1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at) * 1000)::bigint = p_before_ms
          AND p_before_id IS NOT NULL
          AND p.id < p_before_id
        )
      )
      AND (
        p.author_id = trim(p_viewer_id)
        OR p.visibility = 'public'
        OR (
          p.visibility = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = trim(p_viewer_id)
              AND f.following_id = trim(p_profile_id)
          )
        )
        OR (
          p.visibility = 'mutuals'
          AND (
            (
              EXISTS (
                SELECT 1 FROM public.gh_follows f1
                WHERE f1.follower_id = trim(p_viewer_id)
                  AND f1.following_id = trim(p_profile_id)
              )
              AND EXISTS (
                SELECT 1 FROM public.gh_follows f2
                WHERE f2.follower_id = trim(p_profile_id)
                  AND f2.following_id = trim(p_viewer_id)
              )
            )
          )
        )
      )
      AND (
        v_query = ''
        OR position(lower(v_query) in lower(coalesce(p.content, '') || ' ' || coalesce(p.pdf_name, ''))) > 0
      )
      AND (
        v_kind = 'all'
        OR (v_kind = 'posts' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) = 0 AND p.video IS NULL AND p.pdf IS NULL)
        OR (v_kind = 'photos' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) > 0)
        OR (v_kind = 'videos' AND p.video IS NOT NULL AND length(trim(p.video)) > 0)
        OR (v_kind = 'documents' AND p.pdf IS NOT NULL AND length(trim(p.pdf)) > 0)
      )
    ORDER BY (extract(epoch from p.created_at) * 1000)::bigint DESC, p.id DESC
    LIMIT v_limit + 1
  ) q;

  SELECT COALESCE(jsonb_agg((to_jsonb(page_row) - 'created_at' - 'sort_id') ORDER BY page_row."createdAt" DESC, page_row.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.author_id AS "authorId",
      p.author_name AS "authorName",
      p.author_photo AS "authorPhoto",
      p.content,
      p.images,
      p.video,
      p.pdf,
      p.pdf_name AS "pdfName",
      p.visibility,
      p.like_count AS likes,
      p.comment_count AS "commentCount",
      p.share_count AS shares,
      p.is_edited AS "isEdited",
      (extract(epoch from p.created_at) * 1000)::bigint AS "createdAt",
      p.created_at,
      p.id AS sort_id
    FROM public.gh_posts p
    WHERE p.author_id = trim(p_profile_id)
      AND p.deleted_at IS NULL
      AND p.archived_at IS NULL
      -- Community-bound profile posts require active membership. The author can
      -- always review their own content; other viewers cannot infer private posts.
      AND (
        p.community_id IS NULL
        OR p.author_id = trim(p_viewer_id)
        OR EXISTS (
          SELECT 1 FROM public.gh_community_members cm
          WHERE cm.community_id = p.community_id
            AND cm.gh_user_id = trim(p_viewer_id)
            AND lower(coalesce(cm.status, '')) = 'active'
        )
      )
      AND (
        p_before_ms IS NULL
        OR (extract(epoch from p.created_at) * 1000)::bigint < p_before_ms
        OR (
          (extract(epoch from p.created_at) * 1000)::bigint = p_before_ms
          AND p_before_id IS NOT NULL
          AND p.id < p_before_id
        )
      )
      AND (
        p.author_id = trim(p_viewer_id)
        OR p.visibility = 'public'
        OR (
          p.visibility = 'followers'
          AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id = trim(p_viewer_id) AND f.following_id = trim(p_profile_id))
        )
        OR (
          p.visibility = 'mutuals'
          AND (
            (
              EXISTS (SELECT 1 FROM public.gh_follows f1 WHERE f1.follower_id = trim(p_viewer_id) AND f1.following_id = trim(p_profile_id))
              AND EXISTS (SELECT 1 FROM public.gh_follows f2 WHERE f2.follower_id = trim(p_profile_id) AND f2.following_id = trim(p_viewer_id))
            )
          )
        )
      )
      AND (v_query = '' OR position(lower(v_query) in lower(coalesce(p.content, '') || ' ' || coalesce(p.pdf_name, ''))) > 0)
      AND (
        v_kind = 'all'
        OR (v_kind = 'posts' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) = 0 AND p.video IS NULL AND p.pdf IS NULL)
        OR (v_kind = 'photos' AND (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END) > 0)
        OR (v_kind = 'videos' AND p.video IS NOT NULL AND length(trim(p.video)) > 0)
        OR (v_kind = 'documents' AND p.pdf IS NOT NULL AND length(trim(p.pdf)) > 0)
      )
    ORDER BY (extract(epoch from p.created_at) * 1000)::bigint DESC, p.id DESC
    LIMIT v_limit
  ) page_row;

  -- Recalculate the cursor from the returned page, not the look-ahead row.
  SELECT p.created_at, p.id INTO v_oldest, v_oldest_id
  FROM public.gh_posts p
  WHERE p.id IN (
    SELECT value->>'id' FROM jsonb_array_elements(COALESCE(v_rows, '[]'::jsonb)) value
  )
  ORDER BY (extract(epoch from p.created_at) * 1000)::bigint ASC, p.id ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'posts', COALESCE(v_rows, '[]'::jsonb),
    'hasMore', v_count > v_limit,
    'nextBefore', CASE WHEN v_oldest IS NULL THEN NULL ELSE (extract(epoch from v_oldest) * 1000)::bigint END,
    'nextBeforeId', v_oldest_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_list_profile_content(text, text, integer, bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_list_profile_content(text, text, integer, bigint, text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 103: 20261022010103_gh_post_reaction_roster_visibility_guard.sql
-- SHA256: 14be197027557865cdfe78501a962b5602fba1251fd9a8d56f27172e58e89e88
-- ============================================================================
-- Hardening follow-up: the reaction roster must not disclose engagement on
-- posts the authenticated actor is not allowed to see. Safe to re-run.
CREATE OR REPLACE FUNCTION public.gh_list_post_reactions(
  p_actor_id text,
  p_post_id text,
  p_reaction text DEFAULT 'like',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_reaction text := lower(trim(COALESCE(p_reaction, 'like')));
  v_author text;
  v_visibility text;
  v_actor text := trim(COALESCE(p_actor_id, ''));
  v_rows jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_POST');
  END IF;
  IF v_actor = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ACTOR_REQUIRED');
  END IF;
  SELECT author_id, visibility INTO v_author, v_visibility
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  -- Keep the roster no more visible than the post itself.
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_actor AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = v_actor)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_visibility = 'public' OR v_author = v_actor THEN
    NULL;
  ELSIF v_visibility = 'followers' AND EXISTS (
    SELECT 1 FROM public.gh_follows f
    WHERE f.follower_id = v_actor AND f.following_id = v_author
  ) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.user_id AS "userId",
      COALESCE(pr.display_name, pr.username, 'Member') AS "displayName",
      CASE
        WHEN jsonb_typeof(pr.photos) = 'array' AND jsonb_array_length(pr.photos) > 0
          THEN pr.photos->>0
        ELSE ''
      END AS "avatarUrl",
      r.reaction AS "reaction",
      (extract(epoch from r.created_at)*1000)::bigint AS "createdAt"
    FROM public.gh_post_reactions r
    LEFT JOIN public.gh_user_profiles pr ON pr.gh_user_id = r.user_id
    WHERE r.post_id = p_post_id
      AND (v_reaction = '' OR r.reaction = v_reaction)
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'reaction', v_reaction,
    'users', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_list_post_reactions(text, text, text, integer) TO service_role;

-- ============================================================================
-- SOURCE 104: 20261022010104_gh_story_creator_upgrade.sql
-- SHA256: b911d4590f6c7066e2e5cc626bc984f0408374fdc63243e580ecb2e3d8acf09a
-- ============================================================================
-- GreenHaven Stories creator upgrade: persist text-story themes and enforce audience filtering.
-- Apply to Testnet first, verify with two accounts, then apply to Mainnet.

ALTER TABLE public.gh_stories
  ADD COLUMN IF NOT EXISTS background text;

CREATE OR REPLACE FUNCTION public.gh_story_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_expires timestamptz;
  v_audience text := COALESCE(p_row->>'audience', 'everyone');
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF v_audience NOT IN ('everyone', 'followers', 'friends', 'matches-only', 'private') THEN
    v_audience := 'everyone';
  END IF;
  IF p_row ? 'expiresAt' THEN
    v_expires := LEAST(
      to_timestamp((p_row->>'expiresAt')::bigint / 1000.0),
      now() + interval '24 hours'
    );
  ELSE
    v_expires := now() + interval '24 hours';
  END IF;
  IF v_expires <= now() THEN
    v_expires := now() + interval '24 hours';
  END IF;

  INSERT INTO public.gh_stories (
    id, owner_id, owner_name, owner_photo, text, media_type, media_url,
    audience, status, expires_at, created_at, background
  ) VALUES (
    v_id,
    COALESCE(p_row->>'ownerId', ''),
    COALESCE(p_row->>'ownerName', p_row->>'name', ''),
    COALESCE(p_row->>'ownerPhoto', p_row->>'photo', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'mediaType', ''),
    NULLIF(p_row->>'mediaUrl', ''),
    v_audience,
    'published',
    v_expires,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END,
    CASE WHEN length(COALESCE(p_row->>'background', '')) <= 180
      THEN NULLIF(p_row->>'background', '') ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_list_active(p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  UPDATE public.gh_stories
    SET status = 'expired'
    WHERE status = 'published' AND expires_at <= now();

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.owner_id AS "ownerId",
      s.owner_name AS name,
      s.owner_photo AS photo,
      s.text,
      s.background,
      CASE WHEN s.media_url IS NOT NULL THEN
        jsonb_build_object('type', COALESCE(s.media_type, 'image'), 'url', s.media_url)
      ELSE NULL END AS media,
      s.audience,
      s.status,
      (extract(epoch from s.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from s.expires_at)*1000)::bigint AS "expiresAt"
    FROM public.gh_stories s
    WHERE s.status = 'published'
      AND s.expires_at > now()
      AND (
        s.owner_id = p_viewer_id
        OR s.audience = 'everyone'
        OR (
          s.audience = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = s.owner_id
          )
        )
        OR (
          s.audience = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f1
            JOIN public.gh_follows f2
              ON f2.follower_id = f1.following_id
             AND f2.following_id = f1.follower_id
            WHERE f1.follower_id = p_viewer_id
              AND f1.following_id = s.owner_id
          )
        )
        -- matches-only is intentionally owner-only until the canonical match
        -- relation is available in this schema; fail closed rather than leak.
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = s.owner_id)
           OR (b.blocker_id = s.owner_id AND b.blocked_id = p_viewer_id)
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  ) q;
  RETURN jsonb_build_object('ok', true, 'stories', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;

-- ============================================================================
-- SOURCE 105: 20261022010105_gh_messaging_presence_delivery_receipts.sql
-- SHA256: 1eb0f2417e9c99a1089192320ce1a97f0c46e64fd0e5a7752e22089b681b70b2
-- ============================================================================
-- Durable messaging delivery/read receipts and privacy-scoped presence/typing.
-- Server routes use the service role only after authenticating the session and
-- verifying active conversation membership. Clients receive no direct table access.

CREATE TABLE IF NOT EXISTS public.gh_message_receipts (
  message_id     text NOT NULL REFERENCES public.gh_messages(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  sender_id      text NOT NULL,
  recipient_id   text NOT NULL,
  delivered_at   timestamptz,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_id),
  CONSTRAINT gh_message_receipts_sender_nonempty CHECK (length(trim(sender_id)) > 0),
  CONSTRAINT gh_message_receipts_recipient_nonempty CHECK (length(trim(recipient_id)) > 0),
  CONSTRAINT gh_message_receipts_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT gh_message_receipts_read_implies_delivery CHECK (read_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_recipient_unread
  ON public.gh_message_receipts (recipient_id, conversation_id, delivered_at, read_at);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_sender_status
  ON public.gh_message_receipts (sender_id, conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_conversation_recipient_message
  ON public.gh_message_receipts (conversation_id, recipient_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_message_receipts_conversation_message
  ON public.gh_message_receipts (conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_messages_conversation_sender_created
  ON public.gh_messages (conversation_id, sender_id, created_at DESC)
  WHERE deleted_at IS NULL;


CREATE TABLE IF NOT EXISTS public.gh_messaging_preferences (
  user_id                       text PRIMARY KEY,
  who_can_message               text NOT NULL DEFAULT 'everyone'
                                CHECK (who_can_message IN ('everyone', 'matches-only', 'no-one')),
  who_can_message_configured    boolean NOT NULL DEFAULT false,
  online_status                 text NOT NULL DEFAULT 'everyone'
                                CHECK (online_status IN ('everyone', 'matches-only', 'hidden')),
  online_status_configured      boolean NOT NULL DEFAULT false,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_messaging_preferences_user_nonempty CHECK (length(trim(user_id)) > 0)
);

-- Forward-compatible if a deployment already applied an earlier draft of this migration.
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS who_can_message_configured boolean NOT NULL DEFAULT false;
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS online_status text NOT NULL DEFAULT 'everyone'
  CHECK (online_status IN ('everyone', 'matches-only', 'hidden'));
ALTER TABLE public.gh_messaging_preferences
  ADD COLUMN IF NOT EXISTS online_status_configured boolean NOT NULL DEFAULT false;

ALTER TABLE public.gh_messaging_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_messaging_preferences_no_client ON public.gh_messaging_preferences;
CREATE POLICY gh_messaging_preferences_no_client ON public.gh_messaging_preferences
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.gh_messaging_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_messaging_preferences TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_user_presence (
  user_id                 text PRIMARY KEY,
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  online_until            timestamptz NOT NULL DEFAULT now(),
  typing_conversation_id  text,
  typing_until            timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_presence_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_user_presence_typing_pair CHECK (
    (typing_conversation_id IS NULL AND typing_until IS NULL) OR
    (typing_conversation_id IS NOT NULL AND typing_until IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_gh_user_presence_online_until
  ON public.gh_user_presence (online_until DESC);
CREATE INDEX IF NOT EXISTS idx_gh_user_presence_typing_until
  ON public.gh_user_presence (typing_conversation_id, typing_until)
  WHERE typing_conversation_id IS NOT NULL;

ALTER TABLE public.gh_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_message_receipts_no_client ON public.gh_message_receipts;
CREATE POLICY gh_message_receipts_no_client ON public.gh_message_receipts
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_message_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_message_receipts TO service_role;
DROP POLICY IF EXISTS gh_user_presence_no_client ON public.gh_user_presence;
CREATE POLICY gh_user_presence_no_client ON public.gh_user_presence
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_user_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_user_presence TO service_role;

COMMENT ON TABLE public.gh_message_receipts IS
  'Per-recipient delivery and read receipts. A message is delivered only after a recipient client fetches it, and read only after the conversation is actively marked read.';
COMMENT ON TABLE public.gh_user_presence IS
  'Short-lived server-backed online and typing presence. API returns presence only to active members of the same conversation.';

-- Atomically update read receipts and the member's unread cursor in one transaction.
CREATE OR REPLACE FUNCTION public.gh_messaging_mark_read(
  p_user_id text,
  p_conversation_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.gh_user_id = p_user_id
      AND cm.left_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.gh_message_receipts (
    message_id, conversation_id, sender_id, recipient_id, delivered_at, read_at
  )
  SELECT m.id, m.conversation_id, m.sender_id, p_user_id, v_now, v_now
  FROM public.gh_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC
  LIMIT 1000
  ON CONFLICT (message_id, recipient_id) DO UPDATE
    SET delivered_at = COALESCE(public.gh_message_receipts.delivered_at, EXCLUDED.delivered_at),
        read_at = COALESCE(public.gh_message_receipts.read_at, EXCLUDED.read_at);

  UPDATE public.gh_conversation_members cm
  SET last_read_at = v_now
  WHERE cm.conversation_id = p_conversation_id
    AND cm.gh_user_id = p_user_id
    AND cm.left_at IS NULL;

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_mark_read(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_mark_read(text, text) TO service_role;

-- One bounded RPC keeps inbox unread counts current without an N+1 query per conversation.
CREATE OR REPLACE FUNCTION public.gh_messaging_unread_counts(
  p_user_id text,
  p_conversation_ids text[]
)
RETURNS TABLE(conversation_id text, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.conversation_id, count(m.id)::bigint AS unread_count
  FROM public.gh_conversation_members cm
  LEFT JOIN public.gh_messages m
    ON m.conversation_id = cm.conversation_id
   AND m.sender_id <> p_user_id
   AND m.deleted_at IS NULL
   AND m.created_at > COALESCE(cm.last_read_at, cm.joined_at)
  WHERE cm.gh_user_id = p_user_id
    AND cm.left_at IS NULL
    AND cm.conversation_id = ANY(COALESCE(p_conversation_ids, ARRAY[]::text[]))
  GROUP BY cm.conversation_id;
$$;
REVOKE ALL ON FUNCTION public.gh_messaging_unread_counts(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_messaging_unread_counts(text, text[]) TO service_role;

-- ============================================================================
-- SOURCE 106: 20261022010106_gh_story_reactions.sql
-- SHA256: a380995b0261376d031ba5583adc7885228e47bf7cb76ac2b24f387cc258abf0
-- ============================================================================
-- GreenHaven: durable story reactions so engagement is visible on first load.
-- All writes go through a SECURITY DEFINER RPC called only by the authenticated API.

CREATE TABLE IF NOT EXISTS public.gh_story_reactions (
  story_id   text NOT NULL REFERENCES public.gh_stories(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  reaction   text NOT NULL CHECK (reaction IN ('💚', '🔥', '👏', '😂', '😍')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_gh_story_reactions_story
  ON public.gh_story_reactions (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_story_reactions_user
  ON public.gh_story_reactions (user_id, created_at DESC);

ALTER TABLE public.gh_story_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_story_reactions_no_client ON public.gh_story_reactions;
CREATE POLICY gh_story_reactions_no_client ON public.gh_story_reactions
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_story_reaction_toggle(
  p_story_id text,
  p_user_id text,
  p_reaction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_audience text;
  v_allowed boolean := false;
  v_active boolean;
  v_counts jsonb;
  v_mine jsonb;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' OR p_reaction IS NULL OR p_reaction NOT IN ('💚', '🔥', '👏', '😂', '😍') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;

  SELECT owner_id, audience INTO v_owner, v_audience
  FROM public.gh_stories
  WHERE id = p_story_id AND status = 'published' AND expires_at > now();
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;
  IF v_owner = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SELF_REACTION');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = p_user_id AND b.blocked_id = v_owner)
       OR (b.blocker_id = v_owner AND b.blocked_id = p_user_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  -- A known story ID must not bypass the audience rules enforced by the list RPC.
  -- matches-only remains owner-only until a canonical durable match relation exists.
  IF v_audience = 'everyone' THEN
    v_allowed := true;
  ELSIF v_audience = 'followers' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gh_follows f
      WHERE f.follower_id = trim(p_user_id) AND f.following_id = v_owner
    ) INTO v_allowed;
  ELSIF v_audience = 'friends' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gh_follows f1
      JOIN public.gh_follows f2
        ON f2.follower_id = f1.following_id
       AND f2.following_id = f1.follower_id
      WHERE f1.follower_id = trim(p_user_id)
        AND f1.following_id = v_owner
    ) INTO v_allowed;
  END IF;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AVAILABLE');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gh_story_reactions
    WHERE story_id = p_story_id AND user_id = p_user_id AND reaction = p_reaction
  ) INTO v_active;

  IF v_active THEN
    DELETE FROM public.gh_story_reactions
    WHERE story_id = p_story_id AND user_id = p_user_id AND reaction = p_reaction;
  ELSE
    INSERT INTO public.gh_story_reactions (story_id, user_id, reaction)
    VALUES (p_story_id, p_user_id, p_reaction)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(jsonb_object_agg(reaction, reaction_count), '{}'::jsonb)
    INTO v_counts
  FROM (
    SELECT reaction, count(*)::integer AS reaction_count
    FROM public.gh_story_reactions
    WHERE story_id = p_story_id
    GROUP BY reaction
  ) counts;

  SELECT COALESCE(jsonb_agg(reaction ORDER BY reaction), '[]'::jsonb)
    INTO v_mine
  FROM public.gh_story_reactions
  WHERE story_id = p_story_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'active', NOT v_active,
    'reaction', p_reaction,
    'reactionCounts', v_counts,
    'viewerReactions', v_mine,
    'reactionCount', (SELECT count(*)::integer FROM public.gh_story_reactions WHERE story_id = p_story_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_reaction_toggle(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_reaction_toggle(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 107: 20261022010107_gh_post_created_notifications.sql
-- SHA256: e90277daff795df518a960ae210652c7b7c39e7870a0334175df2f06bded3b2c
-- ============================================================================
-- Durable notifications when people a user follows publish a new post.
-- Informational only: no GHC/Pi/economy state is changed.

ALTER TABLE public.gh_social_notifications
  DROP CONSTRAINT IF EXISTS gh_social_notifications_notification_type_check;

ALTER TABLE public.gh_social_notifications
  ADD CONSTRAINT gh_social_notifications_notification_type_check
  CHECK (notification_type IN (
    'follow', 'post_created', 'post_like', 'post_comment', 'comment_reply',
    'curation', 'mention', 'share', 'reputation_level_up', 'system'
  ));

CREATE OR REPLACE FUNCTION public.gh_social_notification_create(
  p_recipient_id text,
  p_actor_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_type text := lower(trim(COALESCE(p_type, '')));
  v_entity text := lower(trim(COALESCE(p_entity_type, 'none')));
  v_recipient text := trim(COALESCE(p_recipient_id, ''));
  v_actor text := NULLIF(trim(COALESCE(p_actor_id, '')), '');
  v_dedupe text := trim(COALESCE(p_dedupe_key, ''));
  v_existing text;
BEGIN
  IF v_recipient = '' OR v_dedupe = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_actor IS NOT NULL AND v_actor = v_recipient
     AND v_type NOT IN ('reputation_level_up', 'system') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'SELF');
  END IF;
  IF v_type NOT IN (
    'follow', 'post_created', 'post_like', 'post_comment', 'comment_reply',
    'curation', 'mention', 'share', 'reputation_level_up', 'system'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TYPE');
  END IF;
  IF v_entity NOT IN ('none', 'user', 'post', 'comment') THEN
    v_entity := 'none';
  END IF;
  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = v_recipient AND b.blocked_id = v_actor)
       OR (b.blocker_id = v_actor AND b.blocked_id = v_recipient)
  ) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'BLOCKED');
  END IF;
  SELECT id INTO v_existing FROM public.gh_social_notifications
  WHERE recipient_user_id = v_recipient AND dedupe_key = v_dedupe LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing);
  END IF;
  v_id := 'snotif_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  ) VALUES (
    v_id, v_recipient, v_actor, v_type, v_entity,
    NULLIF(trim(COALESCE(p_entity_id, '')), ''),
    COALESCE(left(trim(COALESCE(p_title, '')), 200), ''),
    COALESCE(left(trim(COALESCE(p_body, '')), 500), ''),
    COALESCE(p_metadata, '{}'::jsonb), v_dedupe
  );
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_social_notify_post_followers(
  p_author_id text,
  p_post_id text,
  p_body text,
  p_dedupe_key text,
  p_visibility text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text := trim(COALESCE(p_author_id, ''));
  v_post text := trim(COALESCE(p_post_id, ''));
  v_visibility text := lower(trim(COALESCE(p_visibility, 'public')));
  v_created integer := 0;
BEGIN
  IF v_author = '' OR v_post = '' OR trim(COALESCE(p_dedupe_key, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;
  IF v_visibility NOT IN ('public', 'followers', 'mutuals') THEN
    RETURN jsonb_build_object('ok', true, 'created', 0, 'skipped', true);
  END IF;

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  )
  SELECT
    'snotif_' || replace(gen_random_uuid()::text, '-', ''),
    f.follower_id,
    v_author,
    'post_created',
    'post',
    v_post,
    'New post from someone you follow',
    COALESCE(NULLIF(left(trim(COALESCE(p_body, '')), 500), ''), 'Shared a new post'),
    jsonb_build_object('open', 'home', 'tab', 'home', 'entityId', v_post, 'entityType', 'post'),
    trim(p_dedupe_key) || ':' || f.follower_id
  FROM public.gh_follows f
  WHERE f.following_id = v_author
    AND f.follower_id <> v_author
    AND (
      v_visibility <> 'mutuals'
      OR EXISTS (
        SELECT 1 FROM public.gh_follows mutual
        WHERE mutual.follower_id = v_author AND mutual.following_id = f.follower_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = f.follower_id AND b.blocked_id = v_author)
         OR (b.blocker_id = v_author AND b.blocked_id = f.follower_id)
    )
  ON CONFLICT (recipient_user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_social_notify_post_followers(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notify_post_followers(text, text, text, text, text) TO service_role;


CREATE OR REPLACE FUNCTION public.gh_social_notify_message_members(
  p_sender_id text,
  p_conversation_id text,
  p_message_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender text := trim(COALESCE(p_sender_id, ''));
  v_conversation text := trim(COALESCE(p_conversation_id, ''));
  v_message text := trim(COALESCE(p_message_id, ''));
  v_created integer := 0;
BEGIN
  IF v_sender = '' OR v_conversation = '' OR v_message = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REQUIRED');
  END IF;

  INSERT INTO public.gh_social_notifications (
    id, recipient_user_id, actor_user_id, notification_type,
    entity_type, entity_id, title, body, metadata, dedupe_key
  )
  SELECT
    'snotif_' || replace(gen_random_uuid()::text, '-', ''),
    m.gh_user_id,
    v_sender,
    'system',
    'none',
    v_conversation,
    'New message',
    'You received a new message.',
    jsonb_build_object(
      'category', 'messages', 'open', 'messages', 'tab', 'messages',
      'conversationId', v_conversation, 'messageId', v_message
    ),
    'message:' || v_message || ':' || m.gh_user_id
  FROM public.gh_conversation_members m
  WHERE m.conversation_id = v_conversation
    AND m.left_at IS NULL
    AND m.gh_user_id <> v_sender
    AND NOT EXISTS (
      SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id = m.gh_user_id AND b.blocked_id = v_sender)
         OR (b.blocker_id = v_sender AND b.blocked_id = m.gh_user_id)
    )
  ON CONFLICT (recipient_user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_social_notify_message_members(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_social_notify_message_members(text, text, text) TO service_role;

-- ============================================================================
-- SOURCE 108: 20261022010108_gh_system_announcements.sql
-- SHA256: abf3a891ff7f35608840b92d01bf96ac6db19a371afd2971591e38f882c9bc41
-- ============================================================================
-- Durable, cross-device GreenHaven system announcements.
-- Announcement delivery is query-based (not a fan-out into every user's inbox).
-- No wallet, membership, reward, or ledger writes are performed here.

CREATE TABLE IF NOT EXISTS public.gh_system_announcements (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  target text NOT NULL DEFAULT 'all' CHECK (target = 'all'),
  action_path text,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > published_at),
  CHECK (action_path IS NULL OR (left(action_path, 1) = '/' AND left(action_path, 2) <> '//'))
);

CREATE INDEX IF NOT EXISTS idx_gh_system_announcements_active
  ON public.gh_system_announcements (published_at DESC, expires_at);

CREATE TABLE IF NOT EXISTS public.gh_system_announcement_reads (
  announcement_id text NOT NULL REFERENCES public.gh_system_announcements(id) ON DELETE CASCADE,
  gh_user_id text NOT NULL CHECK (length(trim(gh_user_id)) > 0),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, gh_user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_system_announcement_reads_user
  ON public.gh_system_announcement_reads (gh_user_id, read_at DESC);

ALTER TABLE public.gh_system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_system_announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_system_announcements_no_client_access ON public.gh_system_announcements;
CREATE POLICY gh_system_announcements_no_client_access
  ON public.gh_system_announcements FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_system_announcement_reads_no_client_access ON public.gh_system_announcement_reads;
CREATE POLICY gh_system_announcement_reads_no_client_access
  ON public.gh_system_announcement_reads FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_system_announcements IS
  'Server-published global system notices visible to authenticated GreenHaven users across devices.';
COMMENT ON TABLE public.gh_system_announcement_reads IS
  'Per-user read state for global system notices; service-role API enforces session ownership.';

-- ============================================================================
-- SOURCE 109: 20261022010109_gh_post_restore_owner_window.sql
-- SHA256: 83ef3b230cbfde4a95c1cc0596d032a81a56e45f39014e000cdd8f218f6fd757
-- ============================================================================
-- 20261022010109_gh_post_restore_owner_window.sql
-- Owner-only recovery for soft-deleted posts. Visibility restoration is not
-- economic settlement: GHPV weights, rewards, and GHC balances are untouched.
-- Apply only after verifying migration history on the target Supabase project.

CREATE OR REPLACE FUNCTION public.gh_post_restore(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0
     OR p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT author_id, deleted_at
    INTO v_author, v_deleted
    FROM public.gh_posts
   WHERE id = trim(p_post_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author IS DISTINCT FROM trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DELETED');
  END IF;
  IF v_deleted < now() - interval '30 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESTORE_WINDOW_EXPIRED');
  END IF;

  UPDATE public.gh_posts
     SET deleted_at = NULL, updated_at = now()
   WHERE id = trim(p_post_id) AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_post_id),
    'restored', true,
    'ghcMutated', false,
    'curationWeightsRestored', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_restore(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_restore(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_restore(text, text) IS
  'Owner-only soft-deleted post recovery within 30 days. Does not restore GHPV weights or mutate GHC.';

-- ============================================================================
-- SOURCE 110: 20261022010110_gh_lifecycle_payout_quality_foundation.sql
-- SHA256: 4308efa08c9c8515c6c9d97f49b8dd795a0a8c1facc3cf5754e9c51c4d9715b2
-- ============================================================================
-- Phase 15: account lifecycle, seller payout workflow, creator reward ledger, and quality ranking signals.
-- Additive only. No live account deletion, external payout, or GHC issuance occurs in this migration.
-- All financial actions require separate verified settlement integration.

CREATE TABLE IF NOT EXISTS public.gh_account_lifecycle_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','deletion')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','ready','completed','rejected','failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_account_lifecycle_user_nonempty CHECK (length(trim(user_id)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_gh_lifecycle_user_recent ON public.gh_account_lifecycle_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_lifecycle_queue ON public.gh_account_lifecycle_requests(request_type, status, requested_at);
ALTER TABLE public.gh_account_lifecycle_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_account_lifecycle_no_client ON public.gh_account_lifecycle_requests;
CREATE POLICY gh_account_lifecycle_no_client ON public.gh_account_lifecycle_requests FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_account_lifecycle_request(p_user_id text, p_request_type text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_account_lifecycle_requests%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR length(trim(p_user_id))=0 OR p_request_type IS NULL OR p_request_type NOT IN ('export','deletion') OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
 END IF;
 -- Serialize duplicate requests for the same account/type/key.
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_user_id)), hashtext(p_request_type || ':' || trim(p_idempotency_key)));
 SELECT * INTO v_existing FROM public.gh_account_lifecycle_requests
  WHERE user_id=trim(p_user_id) AND request_type=p_request_type AND metadata->>'idempotencyKey'=trim(p_idempotency_key)
  ORDER BY requested_at DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'requestType',v_existing.request_type); END IF;
 v_id := 'alr_' || replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_account_lifecycle_requests(id,user_id,request_type,metadata)
 VALUES(v_id,trim(p_user_id),p_request_type,jsonb_build_object('idempotencyKey',trim(p_idempotency_key),'destructiveAction',p_request_type='deletion','requiresOperatorWorkflow',true));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','requestType',p_request_type,'deletionExecuted',false);
END; $$;
REVOKE ALL ON FUNCTION public.gh_account_lifecycle_request(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_account_lifecycle_request(text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_seller_payout_requests (
 id text PRIMARY KEY,
 seller_id text NOT NULL,
 currency text NOT NULL CHECK (currency IN ('GHC','PI')),
 amount numeric(18,8) NOT NULL CHECK (amount > 0),
 status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','under_review','approved','processing','paid','rejected','failed','cancelled')),
 idempotency_key text NOT NULL,
 payout_reference text,
 operator_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 UNIQUE(seller_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_gh_seller_payout_queue ON public.gh_seller_payout_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_gh_seller_payout_seller ON public.gh_seller_payout_requests(seller_id,created_at DESC);
ALTER TABLE public.gh_seller_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_no_client ON public.gh_seller_payout_requests;
CREATE POLICY gh_seller_payout_no_client ON public.gh_seller_payout_requests FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_seller_payout_allocations (
 payout_request_id text NOT NULL REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
 order_id text NOT NULL REFERENCES public.gh_marketplace_orders(id) ON DELETE RESTRICT,
 seller_id text NOT NULL,
 currency text NOT NULL CHECK (currency IN ('GHC','PI')),
 amount numeric(18,8) NOT NULL CHECK (amount>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(payout_request_id,order_id),
 UNIQUE(order_id)
);
ALTER TABLE public.gh_seller_payout_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_allocations_no_client ON public.gh_seller_payout_allocations;
CREATE POLICY gh_seller_payout_allocations_no_client ON public.gh_seller_payout_allocations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_request(p_seller_id text,p_currency text,p_amount numeric,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text; v_existing public.gh_seller_payout_requests%ROWTYPE; v_eligible numeric(18,8); v_allocated integer;
BEGIN
 IF p_seller_id IS NULL OR length(trim(p_seller_id))=0 OR p_currency IS NULL OR upper(p_currency) NOT IN ('GHC','PI') OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000 OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(trim(p_seller_id)), hashtext('seller-payout:'||upper(p_currency)));
 SELECT * INTO v_existing FROM public.gh_seller_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,'currency',v_existing.currency); END IF;
 SELECT COALESCE(sum(o.total_amount),0) INTO v_eligible FROM public.gh_marketplace_orders o
 WHERE o.seller_id=trim(p_seller_id) AND upper(o.currency)=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified'
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id);
 IF v_eligible<=0 THEN RETURN jsonb_build_object('ok',false,'error','NO_ELIGIBLE_COMPLETED_ORDERS','eligibleAmount',0); END IF;
 -- Full eligible balance only: no partial-order allocation or double claim. External transfer remains a separate operator action.
 IF p_amount<>v_eligible THEN RETURN jsonb_build_object('ok',false,'error','AMOUNT_MUST_MATCH_ELIGIBLE_BALANCE','eligibleAmount',v_eligible,'currency',upper(p_currency)); END IF;
 v_id := 'spr_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_requests(id,seller_id,currency,amount,status,idempotency_key)
 VALUES(v_id,trim(p_seller_id),upper(p_currency),v_eligible,'requested',trim(p_idempotency_key));
 INSERT INTO public.gh_seller_payout_allocations(payout_request_id,order_id,seller_id,currency,amount)
 SELECT v_id,o.id,trim(p_seller_id),upper(p_currency),o.total_amount FROM public.gh_marketplace_orders o
 WHERE o.seller_id=trim(p_seller_id) AND upper(o.currency)=upper(p_currency)
   AND o.status='completed' AND o.payment_status='verified'
   AND NOT EXISTS (SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.order_id=o.id);
 GET DIAGNOSTICS v_allocated = ROW_COUNT;
 IF v_allocated=0 THEN RAISE EXCEPTION 'PAYOUT_ALLOCATION_RACE'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amount',v_eligible,'currency',upper(p_currency),'allocatedOrders',v_allocated,'paid',false);
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_request(text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gh_seller_payout_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL,p_payout_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.gh_seller_payout_requests%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_next_status IS NULL OR p_next_status NOT IN ('under_review','approved','processing','paid','rejected','failed','cancelled') THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 SELECT * INTO v_request FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_request.status IN ('paid','rejected','failed','cancelled') THEN RETURN jsonb_build_object('ok',false,'error','TERMINAL_STATUS'); END IF;
 IF p_next_status='paid' AND (p_payout_reference IS NULL OR length(trim(p_payout_reference))<6 OR length(trim(p_payout_reference))>200) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_REFERENCE_REQUIRED'); END IF;
 IF p_next_status='under_review' AND v_request.status<>'requested' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='approved' AND v_request.status NOT IN ('requested','under_review') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='processing' AND v_request.status<>'approved' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='paid' AND v_request.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 UPDATE public.gh_seller_payout_requests SET status=p_next_status,operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),payout_reference=CASE WHEN p_next_status='paid' THEN trim(p_payout_reference) ELSE payout_reference END,updated_at=now(),paid_at=CASE WHEN p_next_status='paid' THEN now() ELSE paid_at END WHERE id=v_request.id;
 IF p_next_status IN ('rejected','failed','cancelled') THEN DELETE FROM public.gh_seller_payout_allocations WHERE payout_request_id=v_request.id; END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_request.id,'status',p_next_status,'paid',p_next_status='paid');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_creator_reward_events (
 id text PRIMARY KEY,
 creator_id text NOT NULL,
 content_id text NOT NULL,
 reward_period date NOT NULL,
 quality_score numeric(12,6) NOT NULL CHECK (quality_score>=0),
 proposed_amount numeric(18,8) NOT NULL DEFAULT 0 CHECK (proposed_amount>=0),
 currency text NOT NULL DEFAULT 'GHC' CHECK (currency IN ('GHC','PI')),
 status text NOT NULL DEFAULT 'evaluated' CHECK (status IN ('evaluated','eligible','approved','settled','rejected','held')),
 funding_reference text,
 settlement_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(creator_id,content_id,reward_period)
);
CREATE INDEX IF NOT EXISTS idx_gh_creator_rewards_queue ON public.gh_creator_reward_events(status,reward_period);
ALTER TABLE public.gh_creator_reward_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_creator_reward_events_no_client ON public.gh_creator_reward_events;
CREATE POLICY gh_creator_reward_events_no_client ON public.gh_creator_reward_events FOR ALL USING(false) WITH CHECK(false);
COMMENT ON TABLE public.gh_creator_reward_events IS 'Evaluation ledger only until a funded pool and idempotent economy-ledger settlement are explicitly wired. Never mints GHC by itself.';

CREATE TABLE IF NOT EXISTS public.gh_content_quality_signals (
 content_id text PRIMARY KEY,
 author_id text NOT NULL,
 quality_score numeric(12,6) NOT NULL DEFAULT 0 CHECK (quality_score>=0 AND quality_score<=100),
 confidence numeric(8,6) NOT NULL DEFAULT 0 CHECK (confidence>=0 AND confidence<=1),
 review_status text NOT NULL DEFAULT 'community_review' CHECK (review_status IN ('community_review','trusted_signal','needs_review','restricted')),
 computed_at timestamptz NOT NULL DEFAULT now(),
 model_version text NOT NULL DEFAULT 'rules-v1'
);
CREATE INDEX IF NOT EXISTS idx_gh_quality_feed ON public.gh_content_quality_signals(review_status,quality_score DESC,computed_at DESC);
ALTER TABLE public.gh_content_quality_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_quality_signals_no_client ON public.gh_content_quality_signals;
CREATE POLICY gh_content_quality_signals_no_client ON public.gh_content_quality_signals FOR ALL USING(false) WITH CHECK(false);
COMMENT ON TABLE public.gh_content_quality_signals IS 'Server-computed quality metadata only; not truth labels, not votes, not GHC, and not a sole ranking determinant.';

-- ============================================================================
-- SOURCE 111: 20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql
-- SHA256: a2c142cd0b55557402c971329895c19aa9ff3cc5b5dbacb19434689f2cd24d7b
-- ============================================================================
-- GH-CONNECT 0.61.7: provider-verified PI tip settlement and payout reconciliation.
-- Tip settlement records verified funds received and a creator payable; it does NOT
-- claim the creator has been paid. GHC wallet/issuance paths are unchanged.

ALTER TABLE public.gh_tip_intents ADD COLUMN IF NOT EXISTS payment_intent_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_tip_payment_intent
 ON public.gh_tip_intents(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gh_tip_settlements (
  id text PRIMARY KEY,
  tip_intent_id text NOT NULL UNIQUE REFERENCES public.gh_tip_intents(id) ON DELETE RESTRICT,
  payment_intent_id text NOT NULL UNIQUE,
  tipper_id text NOT NULL,
  creator_id text NOT NULL,
  currency text NOT NULL CHECK(currency='PI'),
  gross_amount numeric(18,8) NOT NULL CHECK(gross_amount>0),
  provider_payment_id text NOT NULL UNIQUE,
  txid text NOT NULL,
  status text NOT NULL DEFAULT 'collected' CHECK(status IN ('collected','payable','paid','refunded','disputed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(tipper_id<>creator_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_tip_settlements_creator_status ON public.gh_tip_settlements(creator_id,status,collected_at DESC);
ALTER TABLE public.gh_tip_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_tip_settlements_no_client ON public.gh_tip_settlements;
CREATE POLICY gh_tip_settlements_no_client ON public.gh_tip_settlements FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_tip_intent_bind_payment_intent(p_tipper_id text,p_tip_intent_id text,p_payment_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_tipper_id),'')='' OR COALESCE(trim(p_tip_intent_id),'')='' OR COALESCE(trim(p_payment_intent_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_tip FROM public.gh_tip_intents WHERE id=trim(p_tip_intent_id) AND tipper_id=trim(p_tipper_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','TIP_NOT_FOUND'); END IF;
 IF v_tip.currency<>'PI' OR v_tip.amount_units IS NULL OR v_tip.amount_units<=0 THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_SETTLEABLE'); END IF;
 IF v_tip.status IN ('cancelled','failed') THEN RETURN jsonb_build_object('ok',false,'error','TIP_TERMINAL'); END IF;
 IF v_tip.payment_intent_id IS NOT NULL AND v_tip.payment_intent_id<>trim(p_payment_intent_id) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYMENT_INTENT_ALREADY_BOUND'); END IF;
 UPDATE public.gh_tip_intents SET payment_intent_id=trim(p_payment_intent_id),status='awaiting_payment',updated_at=now() WHERE id=v_tip.id;
 RETURN jsonb_build_object('ok',true,'tipIntentId',v_tip.id,'paymentIntentId',trim(p_payment_intent_id));
END; $$;

-- Called only after the Pi server API has confirmed payment amount, transaction and completion.
-- Idempotent across retries; this records a creator payable, not a payout/disbursement.
CREATE OR REPLACE FUNCTION public.gh_tip_intent_get_for_tipper(p_tipper_id text,p_tip_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE;
BEGIN
 SELECT * INTO v_tip FROM public.gh_tip_intents
  WHERE id=trim(COALESCE(p_tip_intent_id,'')) AND tipper_id=trim(COALESCE(p_tipper_id,''));
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','TIP_NOT_FOUND'); END IF;
 RETURN jsonb_build_object('ok',true,'intentId',v_tip.id,'status',v_tip.status,
   'currency',v_tip.currency,'amount',v_tip.amount_units,'paymentIntentId',v_tip.payment_intent_id,
   'recipientId',v_tip.recipient_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_tip_settle_verified(
 p_tip_intent_id text,p_tipper_id text,p_payment_intent_id text,
 p_provider_payment_id text,p_txid text,p_verified_amount numeric,p_provider_completed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tip public.gh_tip_intents%ROWTYPE; v_existing public.gh_tip_settlements%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_tip_intent_id),'')='' OR COALESCE(trim(p_tipper_id),'')='' OR
    COALESCE(trim(p_payment_intent_id),'')='' OR COALESCE(trim(p_provider_payment_id),'')='' OR
    COALESCE(trim(p_txid),'')='' OR p_provider_completed IS DISTINCT FROM true OR
    p_verified_amount IS NULL OR p_verified_amount<=0 THEN
  RETURN jsonb_build_object('ok',false,'error','VERIFIED_PAYMENT_REQUIRED'); END IF;
 SELECT * INTO v_tip FROM public.gh_tip_intents WHERE id=trim(p_tip_intent_id) FOR UPDATE;
 IF NOT FOUND OR v_tip.tipper_id<>trim(p_tipper_id) OR v_tip.payment_intent_id<>trim(p_payment_intent_id) THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_BINDING_MISMATCH'); END IF;
 IF v_tip.currency<>'PI' OR v_tip.amount_units IS NULL OR v_tip.amount_units<>p_verified_amount THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_AMOUNT_MISMATCH'); END IF;
 IF v_tip.tipper_id=v_tip.recipient_id OR v_tip.status IN ('cancelled','failed') THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_SETTLEABLE'); END IF;
 SELECT * INTO v_existing FROM public.gh_tip_settlements WHERE tip_intent_id=v_tip.id;
 IF FOUND THEN
  IF v_existing.payment_intent_id<>trim(p_payment_intent_id) OR v_existing.provider_payment_id<>trim(p_provider_payment_id) OR v_existing.txid<>trim(p_txid) THEN
   RETURN jsonb_build_object('ok',false,'error','SETTLEMENT_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'settlementId',v_existing.id,'status',v_existing.status,'creatorPaid',v_existing.status='paid');
 END IF;
 v_id := 'tips_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_tip_settlements(id,tip_intent_id,payment_intent_id,tipper_id,creator_id,currency,gross_amount,provider_payment_id,txid,status,metadata)
 VALUES(v_id,v_tip.id,trim(p_payment_intent_id),v_tip.tipper_id,v_tip.recipient_id,'PI',p_verified_amount,trim(p_provider_payment_id),trim(p_txid),'payable',jsonb_build_object('provider','pi','verified',true));
 UPDATE public.gh_tip_intents SET status='settled',updated_at=now(),metadata=metadata||jsonb_build_object('settlementId',v_id,'settlementStatus','payable') WHERE id=v_tip.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'settlementId',v_id,'status','payable','creatorPaid',false,'amount',p_verified_amount,'currency','PI');
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('ok',false,'error','PROVIDER_PAYMENT_ALREADY_USED');
END; $$;
REVOKE ALL ON FUNCTION public.gh_tip_intent_bind_payment_intent(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_intent_bind_payment_intent(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_tip_intent_get_for_tipper(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_intent_get_for_tipper(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_tip_settle_verified(text,text,text,text,text,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_settle_verified(text,text,text,text,text,numeric,boolean) TO service_role;

-- Provider-confirmed seller payout evidence. Only PI A2U is automated here; GHC and bank rails
-- remain pending until their own verified adapters/reconciliation are implemented.
CREATE TABLE IF NOT EXISTS public.gh_seller_payout_reconciliations (
 id text PRIMARY KEY,
 payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK(provider IN ('pi_a2u')),
 provider_payment_id text NOT NULL UNIQUE,
 txid text NOT NULL,
 currency text NOT NULL CHECK(currency='PI'),
 amount numeric(18,8) NOT NULL CHECK(amount>0),
 provider_status text NOT NULL CHECK(provider_status='developer_completed'),
 transaction_verified boolean NOT NULL CHECK(transaction_verified=true),
 evidence_hash text NOT NULL,
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','reversed','disputed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_seller_payout_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_reconciliations_no_client ON public.gh_seller_payout_reconciliations;
CREATE POLICY gh_seller_payout_reconciliations_no_client ON public.gh_seller_payout_reconciliations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_record_pi_confirmation(
 p_request_id text,p_provider_payment_id text,p_txid text,p_currency text,p_amount numeric,
 p_provider_status text,p_transaction_verified boolean,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_seller_payout_requests%ROWTYPE; v_existing public.gh_seller_payout_reconciliations%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_request_id),'')='' OR COALESCE(trim(p_provider_payment_id),'')='' OR COALESCE(trim(p_txid),'')='' OR
    upper(COALESCE(p_currency,''))<>'PI' OR p_amount IS NULL OR p_amount<=0 OR
    p_provider_status<>'developer_completed' OR p_transaction_verified IS DISTINCT FROM true OR
    COALESCE(trim(p_evidence_hash),'')='' THEN RETURN jsonb_build_object('ok',false,'error','VERIFIED_PI_PAYOUT_REQUIRED'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'PI' OR v_req.amount<>p_amount THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_AMOUNT_CURRENCY_MISMATCH'); END IF;
 IF v_req.status NOT IN ('processing','paid') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_PROCESSING'); END IF;
 SELECT * INTO v_existing FROM public.gh_seller_payout_reconciliations WHERE payout_request_id=v_req.id;
 IF FOUND THEN
  IF v_existing.provider_payment_id=trim(p_provider_payment_id) AND v_existing.txid=trim(p_txid) AND v_existing.amount=p_amount AND v_existing.status='confirmed' THEN
   RETURN jsonb_build_object('ok',true,'idempotent',true,'reconciliationId',v_existing.id,'status',v_existing.status);
  END IF;
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_RECONCILIATION_CONFLICT');
 END IF;
 v_id:='sprc_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_reconciliations(id,payout_request_id,provider,provider_payment_id,txid,currency,amount,provider_status,transaction_verified,evidence_hash,status)
 VALUES(v_id,v_req.id,'pi_a2u',trim(p_provider_payment_id),trim(p_txid),'PI',p_amount,'developer_completed',true,trim(p_evidence_hash),'confirmed');
 RETURN jsonb_build_object('ok',true,'idempotent',false,'reconciliationId',v_id,'status','confirmed');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_REFERENCE_ALREADY_USED');
END; $$;

-- Tighten the existing transition so a free-form payout reference can never mark a payout paid.
CREATE OR REPLACE FUNCTION public.gh_seller_payout_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL,p_payout_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_request public.gh_seller_payout_requests%ROWTYPE; v_recon public.gh_seller_payout_reconciliations%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_next_status IS NULL OR p_next_status NOT IN ('under_review','approved','processing','paid','rejected','failed','cancelled') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 SELECT * INTO v_request FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_request.status IN ('paid','rejected','failed','cancelled') THEN
  IF v_request.status='paid' AND p_next_status='paid' THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_request.id,'status','paid','paid',true); END IF;
  RETURN jsonb_build_object('ok',false,'error','TERMINAL_STATUS'); END IF;
 IF p_next_status='under_review' AND v_request.status<>'requested' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='approved' AND v_request.status NOT IN ('requested','under_review') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='processing' AND v_request.status<>'approved' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 IF p_next_status='paid' THEN
  SELECT * INTO v_recon FROM public.gh_seller_payout_reconciliations WHERE payout_request_id=v_request.id AND status='confirmed' FOR UPDATE;
  IF NOT FOUND OR v_recon.amount<>v_request.amount OR v_recon.currency<>v_request.currency OR v_recon.provider_payment_id<>trim(COALESCE(p_payout_reference,'')) THEN
   RETURN jsonb_build_object('ok',false,'error','VERIFIED_PAYOUT_RECONCILIATION_REQUIRED'); END IF;
  IF v_request.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TRANSITION'); END IF;
 END IF;
 UPDATE public.gh_seller_payout_requests SET status=p_next_status,operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),payout_reference=CASE WHEN p_next_status='paid' THEN trim(p_payout_reference) ELSE payout_reference END,updated_at=now(),paid_at=CASE WHEN p_next_status='paid' THEN now() ELSE paid_at END WHERE id=v_request.id;
 IF p_next_status IN ('rejected','failed','cancelled') THEN DELETE FROM public.gh_seller_payout_allocations WHERE payout_request_id=v_request.id; END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_request.id,'status',p_next_status,'paid',p_next_status='paid');
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_transition(text,text,text,text) TO service_role;

COMMENT ON TABLE public.gh_tip_settlements IS 'Provider-verified Pi tip receipts and creator payable liabilities. A payable row does not imply creator disbursement.';
COMMENT ON TABLE public.gh_seller_payout_reconciliations IS 'Immutable-ish provider evidence required before a seller payout may transition to paid.';

-- ============================================================================
-- SOURCE 112: 20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql
-- SHA256: c8bffb07c5d31210c5ac8f17bd9254646dd1d712261a1de643043b17f9928723
-- ============================================================================
-- GH-CONNECT Phase 19: atomic, balance-funded GHC creator tips and funded creator rewards.
-- Source-only until reviewed against target migration history and verified on Testnet.
-- No issuance/minting: all movement uses ghc_execute_transfer against the posted GHC ledger.

-- Upgrade the shared transfer primitive before enabling any new transfer consumer.
-- Canonical sender+recipient balance locks close receive-limit races and prevent opposite-direction deadlocks.
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
  IF p_amount <> round(p_amount, 4) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_AMOUNT_PRECISION', 'message', 'GHC transfers support at most four decimal places');
  END IF;
  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_FAILED', 'message', 'referenceId required');
  END IF;

  SELECT * INTO v_limits FROM public.ghc_economy_limits WHERE id = 1 FOR SHARE;
  IF NOT FOUND OR v_limits.min_transfer IS NULL OR v_limits.max_transfer IS NULL OR
     v_limits.daily_send_limit IS NULL OR v_limits.daily_receive_limit IS NULL OR
     v_limits.max_transfer < v_limits.min_transfer OR
     v_limits.daily_send_limit < 0 OR v_limits.daily_receive_limit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMITS_UNAVAILABLE', 'message', 'Transfer limits are not configured safely');
  END IF;
  IF p_amount < v_limits.min_transfer OR p_amount > v_limits.max_transfer THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Amount outside transfer limits');
  END IF;

  -- Serialize both sender spendability and recipient daily-receive-limit checks.
  -- Acquire both balance locks in a canonical lexical order to avoid A->B / B->A deadlocks.
  IF p_sender_id < p_to_user_id THEN
    PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_sender_id));
    PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_to_user_id));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_to_user_id));
    PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || p_sender_id));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_account_flags
    WHERE user_id = p_sender_id AND (restricted OR suspended)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_RESTRICTED', 'message', 'Account restricted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks
    WHERE (blocker_id = p_sender_id AND blocked_id = p_to_user_id)
       OR (blocker_id = p_to_user_id AND blocked_id = p_sender_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_USER', 'message', 'Transfers not allowed');
  END IF;

  SELECT * INTO v_existing_out FROM public.ghc_transactions
   WHERE user_id = p_sender_id AND reference_id = p_reference_id
     AND kind = 'transfer_out' AND status = 'posted'
   LIMIT 1;
  IF FOUND THEN
    -- A reused reference must match the original parties and exact amount.
    IF abs(v_existing_out.amount) <> p_amount OR v_existing_out.counterparty_id IS DISTINCT FROM p_to_user_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT', 'message', 'referenceId already used with different transfer parameters');
    END IF;
    SELECT * INTO v_existing_in FROM public.ghc_transactions
     WHERE user_id = p_to_user_id AND reference_id = p_reference_id
       AND kind = 'transfer_in' AND status = 'posted' AND counterparty_id = p_sender_id
     LIMIT 1;
    IF NOT FOUND OR v_existing_in.amount <> p_amount THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_PAIR_INCOMPLETE', 'message', 'Existing transfer reference does not have a matching credit leg');
    END IF;
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
      'creditTx', jsonb_build_object(
        'id', v_existing_in.id, 'userId', v_existing_in.user_id, 'kind', v_existing_in.kind,
        'amount', v_existing_in.amount, 'status', v_existing_in.status,
        'referenceId', v_existing_in.reference_id, 'reason', v_existing_in.reason,
        'createdAt', extract(epoch from v_existing_in.created_at) * 1000
      )
    );
  END IF;

  -- Spendable: do not transfer GHC reserved for pending withdrawals
  v_available := public.ghc_spendable_balance(p_sender_id);
  IF v_available < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient available GHC');
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_sent_today
  FROM public.ghc_transactions
  WHERE user_id = p_sender_id AND kind = 'transfer_out' AND status = 'posted'
    AND created_at >= (date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    AND created_at < ((date_trunc('day', v_now AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC');

  IF v_sent_today + p_amount > v_limits.daily_send_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_LIMIT_EXCEEDED', 'message', 'Daily send limit reached');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_recv_today
  FROM public.ghc_transactions
  WHERE user_id = p_to_user_id AND kind = 'transfer_in' AND status = 'posted'
    AND created_at >= (date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    AND created_at < ((date_trunc('day', v_now AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC');

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
      'amount', -p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Sent GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    ),
    'creditTx', jsonb_build_object(
      'id', v_credit_id, 'userId', p_to_user_id, 'kind', 'transfer_in',
      'amount', p_amount, 'status', 'posted',
      'referenceId', p_reference_id, 'reason', COALESCE(NULLIF(trim(p_note), ''), 'Received GHC'),
      'createdAt', extract(epoch from v_now) * 1000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role;

-- Remove the legacy media-resolution bypass: only the owner may resolve an upload ID,
-- and the RPC returns a stable application facade URL, never a raw public Storage URL.
CREATE OR REPLACE FUNCTION public.gh_media_assets_resolve(p_actor_id text,p_ids text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb;
BEGIN
 IF COALESCE(trim(p_actor_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','ACTOR_REQUIRED'); END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'id',m.id,'ownerId',m.owner_id,'kind',m.media_kind,'mime',m.mime_type,
   'url','/api/media/'||m.id||'/content','thumbUrl','',
   'width',m.width,'height',m.height,'status',m.status,'owned',true
 ) ORDER BY m.created_at),'[]'::jsonb) INTO v_rows
 FROM public.gh_media_assets m
 WHERE m.deleted_at IS NULL AND m.status='ready' AND m.owner_id=trim(p_actor_id)
   AND m.id=ANY(COALESCE(p_ids,ARRAY[]::text[]));
 RETURN jsonb_build_object('ok',true,'assets',COALESCE(v_rows,'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.gh_media_assets_resolve(text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_assets_resolve(text,text[]) TO service_role;

CREATE TABLE IF NOT EXISTS public.gh_tip_ghc_settlements (
  id text PRIMARY KEY,
  tip_intent_id text NOT NULL UNIQUE REFERENCES public.gh_tip_intents(id) ON DELETE RESTRICT,
  transfer_reference text NOT NULL UNIQUE,
  tipper_id text NOT NULL,
  creator_id text NOT NULL,
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  debit_transaction_id text NOT NULL,
  credit_transaction_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tipper_id <> creator_id)
);
ALTER TABLE public.gh_tip_ghc_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_tip_ghc_settlements_no_client ON public.gh_tip_ghc_settlements;
CREATE POLICY gh_tip_ghc_settlements_no_client ON public.gh_tip_ghc_settlements FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_tip_settle_ghc_atomic(
 p_tip_intent_id text, p_tipper_id text, p_amount numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_tip public.gh_tip_intents%ROWTYPE;
 v_existing public.gh_tip_ghc_settlements%ROWTYPE;
 v_transfer jsonb;
 v_debit jsonb;
 v_credit jsonb;
 v_ref text;
 v_id text;
BEGIN
 IF COALESCE(trim(p_tip_intent_id),'')='' OR COALESCE(trim(p_tipper_id),'')='' OR
    p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,4) THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_GHC_TIP');
 END IF;
 SELECT * INTO v_tip FROM public.gh_tip_intents WHERE id=trim(p_tip_intent_id) FOR UPDATE;
 IF NOT FOUND OR v_tip.tipper_id<>trim(p_tipper_id) THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_FOUND');
 END IF;
 IF v_tip.currency<>'GHC' OR v_tip.amount_units IS NULL OR v_tip.amount_units<>p_amount OR
    v_tip.payment_intent_id IS NOT NULL OR v_tip.tipper_id=v_tip.recipient_id OR v_tip.status IN ('cancelled','failed') THEN
  RETURN jsonb_build_object('ok',false,'error','TIP_NOT_SETTLEABLE');
 END IF;
 SELECT * INTO v_existing FROM public.gh_tip_ghc_settlements WHERE tip_intent_id=v_tip.id;
 IF FOUND THEN
  IF v_existing.tipper_id<>v_tip.tipper_id OR v_existing.creator_id<>v_tip.recipient_id OR v_existing.amount<>p_amount THEN
   RETURN jsonb_build_object('ok',false,'error','TIP_SETTLEMENT_CONFLICT');
  END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'intentId',v_tip.id,
    'settlementId',v_existing.id,'transferReference',v_existing.transfer_reference,
    'amount',v_existing.amount,'currency','GHC','creatorPaid',true);
 END IF;
 IF v_tip.status='settled' THEN RETURN jsonb_build_object('ok',false,'error','SETTLEMENT_RECORD_MISSING'); END IF;
 v_ref := 'tip_ghc_' || v_tip.id;
 v_transfer := public.ghc_execute_transfer(v_tip.tipper_id,v_tip.recipient_id,p_amount,v_ref,
   'GreenHaven creator tip',NULL);
 IF COALESCE((v_transfer->>'ok')::boolean,false) IS NOT TRUE THEN
  RETURN jsonb_build_object('ok',false,'error',COALESCE(v_transfer->>'code','GHC_TRANSFER_FAILED'),
    'message',COALESCE(v_transfer->>'message','GHC transfer did not complete'));
 END IF;
 v_debit := v_transfer->'debitTx';
 v_credit := v_transfer->'creditTx';
 IF v_debit IS NULL OR v_credit IS NULL OR
    v_debit->>'userId'<>v_tip.tipper_id OR v_credit->>'userId'<>v_tip.recipient_id OR
    v_debit->>'kind'<>'transfer_out' OR v_credit->>'kind'<>'transfer_in' OR
    COALESCE(v_debit->>'id','')='' OR COALESCE(v_credit->>'id','')='' OR
    v_debit->>'referenceId'<>v_ref OR v_credit->>'referenceId'<>v_ref OR
    abs(COALESCE((v_debit->>'amount')::numeric,0))<>p_amount OR
    COALESCE((v_credit->>'amount')::numeric,0)<>p_amount THEN
  RAISE EXCEPTION 'GHC_TRANSFER_LEDGER_VERIFICATION_FAILED';
 END IF;
 v_id := 'tipghc_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_tip_ghc_settlements(id,tip_intent_id,transfer_reference,tipper_id,creator_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,v_tip.id,v_ref,v_tip.tipper_id,v_tip.recipient_id,p_amount,
   COALESCE(v_debit->>'id',''),COALESCE(v_credit->>'id',''));
 UPDATE public.gh_tip_intents SET status='settled',updated_at=now(),
   metadata=metadata||jsonb_build_object('settlementId',v_id,'settlementStatus','settled','settlementCurrency','GHC')
 WHERE id=v_tip.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'intentId',v_tip.id,'settlementId',v_id,
   'transferReference',v_ref,'amount',p_amount,'currency','GHC','creatorPaid',true);
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('ok',false,'error','GHC_TIP_REFERENCE_CONFLICT');
END; $$;
REVOKE ALL ON FUNCTION public.gh_tip_settle_ghc_atomic(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_settle_ghc_atomic(text,text,numeric) TO service_role;

-- A reward pool is a ledger account, not an issuance switch. Explicit operator registration is
-- required before funding. Operators must be inserted by a trusted postgres-level deployment.
CREATE TABLE IF NOT EXISTS public.gh_creator_reward_pool_operators (
 operator_user_id text PRIMARY KEY CHECK (length(trim(operator_user_id))>0),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_creator_reward_pool_operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_creator_reward_pool_operators_no_client ON public.gh_creator_reward_pool_operators;
CREATE POLICY gh_creator_reward_pool_operators_no_client ON public.gh_creator_reward_pool_operators FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.gh_creator_reward_pool_movements (
 id text PRIMARY KEY,
 movement_kind text NOT NULL CHECK (movement_kind IN ('funding','distribution')),
 reference_id text NOT NULL UNIQUE,
 reward_event_id text UNIQUE REFERENCES public.gh_creator_reward_events(id) ON DELETE RESTRICT,
 actor_id text NOT NULL,
 recipient_id text NOT NULL,
 amount numeric(18,4) NOT NULL CHECK (amount>0),
 debit_transaction_id text NOT NULL,
 credit_transaction_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((movement_kind='funding' AND reward_event_id IS NULL) OR (movement_kind='distribution' AND reward_event_id IS NOT NULL))
);
ALTER TABLE public.gh_creator_reward_pool_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_creator_reward_pool_movements_no_client ON public.gh_creator_reward_pool_movements;
CREATE POLICY gh_creator_reward_pool_movements_no_client ON public.gh_creator_reward_pool_movements FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_creator_reward_pool_fund(p_operator_id text,p_amount numeric,p_reference_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_transfer jsonb; v_debit jsonb; v_credit jsonb; v_old public.gh_creator_reward_pool_movements%ROWTYPE; v_id text;
 v_pool constant text := '__GH_CREATOR_REWARD_POOL__';
BEGIN
 IF COALESCE(trim(p_operator_id),'')='' OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,4) OR
    COALESCE(trim(p_reference_id),'') !~ '^[A-Za-z0-9._:-]{8,160}$' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_POOL_FUNDING'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gh_creator_reward_pool_operators WHERE operator_user_id=trim(p_operator_id) AND enabled=true) THEN
  RETURN jsonb_build_object('ok',false,'error','REWARD_POOL_OPERATOR_REQUIRED'); END IF;
 SELECT * INTO v_old FROM public.gh_creator_reward_pool_movements WHERE reference_id=trim(p_reference_id);
 IF FOUND THEN
  IF v_old.movement_kind<>'funding' OR v_old.actor_id<>trim(p_operator_id) OR v_old.amount<>p_amount THEN
   RETURN jsonb_build_object('ok',false,'error','FUNDING_IDEMPOTENCY_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'movementId',v_old.id,'amount',v_old.amount,'currency','GHC');
 END IF;
 v_transfer:=public.ghc_execute_transfer(trim(p_operator_id),v_pool,p_amount,trim(p_reference_id),'Fund creator reward pool',NULL);
 IF COALESCE((v_transfer->>'ok')::boolean,false) IS NOT TRUE THEN
  RETURN jsonb_build_object('ok',false,'error',COALESCE(v_transfer->>'code','POOL_FUNDING_FAILED'));
 END IF;
 v_debit:=v_transfer->'debitTx'; v_credit:=v_transfer->'creditTx';
 IF v_debit IS NULL OR v_credit IS NULL OR v_debit->>'userId'<>trim(p_operator_id) OR v_credit->>'userId'<>v_pool OR
    v_debit->>'kind'<>'transfer_out' OR v_credit->>'kind'<>'transfer_in' OR
    COALESCE(v_debit->>'id','')='' OR COALESCE(v_credit->>'id','')='' OR
    v_debit->>'referenceId'<>trim(p_reference_id) OR v_credit->>'referenceId'<>trim(p_reference_id) OR
    abs(COALESCE((v_debit->>'amount')::numeric,0))<>p_amount OR COALESCE((v_credit->>'amount')::numeric,0)<>p_amount THEN
  RAISE EXCEPTION 'POOL_FUNDING_LEDGER_VERIFICATION_FAILED'; END IF;
 v_id:='crpm_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_creator_reward_pool_movements(id,movement_kind,reference_id,actor_id,recipient_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,'funding',trim(p_reference_id),trim(p_operator_id),v_pool,p_amount,COALESCE(v_debit->>'id',''),COALESCE(v_credit->>'id',''));
 RETURN jsonb_build_object('ok',true,'idempotent',false,'movementId',v_id,'amount',p_amount,'currency','GHC');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','POOL_FUNDING_REFERENCE_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_creator_reward_settle_funded(p_reward_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_reward public.gh_creator_reward_events%ROWTYPE; v_old public.gh_creator_reward_pool_movements%ROWTYPE;
 v_transfer jsonb; v_debit jsonb; v_credit jsonb; v_ref text; v_id text;
 v_pool constant text := '__GH_CREATOR_REWARD_POOL__';
BEGIN
 IF COALESCE(trim(p_reward_event_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','REWARD_EVENT_REQUIRED'); END IF;
 SELECT * INTO v_reward FROM public.gh_creator_reward_events WHERE id=trim(p_reward_event_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REWARD_EVENT_NOT_FOUND'); END IF;
 SELECT * INTO v_old FROM public.gh_creator_reward_pool_movements WHERE reward_event_id=v_reward.id;
 IF FOUND THEN
  IF v_old.recipient_id<>v_reward.creator_id OR v_old.amount<>v_reward.proposed_amount OR v_old.movement_kind<>'distribution' THEN
   RETURN jsonb_build_object('ok',false,'error','REWARD_SETTLEMENT_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'movementId',v_old.id,'amount',v_old.amount,'currency','GHC','status','settled');
 END IF;
 IF v_reward.status<>'approved' OR v_reward.currency<>'GHC' OR v_reward.proposed_amount IS NULL OR
    v_reward.proposed_amount<=0 OR v_reward.proposed_amount<>round(v_reward.proposed_amount,4) THEN
  RETURN jsonb_build_object('ok',false,'error','APPROVED_FUNDED_GHC_REWARD_REQUIRED'); END IF;
 v_ref:='creator_reward_'||v_reward.id;
 v_transfer:=public.ghc_execute_transfer(v_pool,v_reward.creator_id,v_reward.proposed_amount,v_ref,'Funded creator reward distribution',NULL);
 IF COALESCE((v_transfer->>'ok')::boolean,false) IS NOT TRUE THEN
  RETURN jsonb_build_object('ok',false,'error',COALESCE(v_transfer->>'code','REWARD_POOL_INSUFFICIENT_OR_TRANSFER_FAILED'),
    'message',COALESCE(v_transfer->>'message','Reward distribution did not complete'));
 END IF;
 v_debit:=v_transfer->'debitTx'; v_credit:=v_transfer->'creditTx';
 IF v_debit IS NULL OR v_credit IS NULL OR v_debit->>'userId'<>v_pool OR v_credit->>'userId'<>v_reward.creator_id OR
    v_debit->>'kind'<>'transfer_out' OR v_credit->>'kind'<>'transfer_in' OR
    COALESCE(v_debit->>'id','')='' OR COALESCE(v_credit->>'id','')='' OR
    v_debit->>'referenceId'<>v_ref OR v_credit->>'referenceId'<>v_ref OR
    abs(COALESCE((v_debit->>'amount')::numeric,0))<>v_reward.proposed_amount OR
    COALESCE((v_credit->>'amount')::numeric,0)<>v_reward.proposed_amount THEN
  RAISE EXCEPTION 'REWARD_TRANSFER_LEDGER_VERIFICATION_FAILED'; END IF;
 v_id:='crpm_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_creator_reward_pool_movements(id,movement_kind,reference_id,reward_event_id,actor_id,recipient_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,'distribution',v_ref,v_reward.id,v_pool,v_reward.creator_id,v_reward.proposed_amount,
   COALESCE(v_debit->>'id',''),COALESCE(v_credit->>'id',''));
 UPDATE public.gh_creator_reward_events SET status='settled',settlement_reference=v_ref,updated_at=now() WHERE id=v_reward.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'movementId',v_id,'amount',v_reward.proposed_amount,'currency','GHC','status','settled');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','REWARD_SETTLEMENT_REFERENCE_CONFLICT');
END; $$;

REVOKE ALL ON FUNCTION public.gh_creator_reward_pool_fund(text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_creator_reward_pool_fund(text,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_creator_reward_settle_funded(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_creator_reward_settle_funded(text) TO service_role;

COMMENT ON TABLE public.gh_tip_ghc_settlements IS 'GHC tips settled only through an atomic, balance-funded dual-entry ledger transfer; no minting.';
COMMENT ON TABLE public.gh_creator_reward_pool_movements IS 'Auditable funded creator-reward pool transfers. Every movement must match authoritative dual-entry GHC ledger rows.';
COMMENT ON FUNCTION public.gh_creator_reward_settle_funded(text) IS 'Settles only approved GHC rewards from the funded protocol pool using ghc_execute_transfer in the same database transaction.';

-- ============================================================================
-- SOURCE 113: 20261022010113_pi_a2u_sdk_execution_orchestration.sql
-- SHA256: 1c647cdb46f1438ba1921d11eaa685209c7af954a944a07e58f5649fe0387de8
-- ============================================================================
-- Phase 20: durable, globally serialized Pi A2U execution orchestration.
-- Apply only after comparing the target database migration history. A2U is Testnet-only.
CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_executions (
  id text PRIMARY KEY,
  payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  recipient_uid text NOT NULL,
  amount numeric(18,8) NOT NULL CHECK (amount > 0),
  network text NOT NULL CHECK (network = 'Pi Testnet'),
  state text NOT NULL DEFAULT 'initiating' CHECK (state IN ('initiating','created','submitted','completed','attention')),
  provider_payment_id text UNIQUE,
  txid text UNIQUE,
  last_error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state NOT IN ('created','submitted','completed') OR provider_payment_id IS NOT NULL),
  CHECK (state NOT IN ('submitted','completed') OR txid IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gh_pi_a2u_execution_state ON public.gh_pi_a2u_executions(state, updated_at);
ALTER TABLE public.gh_pi_a2u_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_executions_no_client ON public.gh_pi_a2u_executions;
CREATE POLICY gh_pi_a2u_executions_no_client ON public.gh_pi_a2u_executions FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_pi_a2u_sequence_lease (
  singleton_id smallint PRIMARY KEY CHECK(singleton_id=1),
  lease_token text,
  payout_request_id text,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.gh_pi_a2u_sequence_lease(singleton_id) VALUES(1) ON CONFLICT(singleton_id) DO NOTHING;
ALTER TABLE public.gh_pi_a2u_sequence_lease ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_pi_a2u_sequence_lease_no_client ON public.gh_pi_a2u_sequence_lease;
CREATE POLICY gh_pi_a2u_sequence_lease_no_client ON public.gh_pi_a2u_sequence_lease FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_begin_execution(
 p_request_id text,p_lease_token text,p_recipient_uid text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_seller_payout_requests%ROWTYPE; v_exec public.gh_pi_a2u_executions%ROWTYPE; v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^spr_[a-f0-9]{16,40}$' OR COALESCE(trim(p_lease_token),'')='' OR COALESCE(trim(p_recipient_uid),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'PI' OR v_req.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','PI_PAYOUT_MUST_BE_PROCESSING'); END IF;
 -- First perform a non-locking preflight so known attention/binding failures never acquire a lease.
 -- All locking RPC paths then use lease -> execution lock order to avoid retry deadlocks.
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=v_req.id;
 IF FOUND AND (v_exec.seller_id<>v_req.seller_id OR v_exec.amount<>v_req.amount OR v_exec.recipient_uid<>trim(p_recipient_uid)) THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_EXECUTION_BINDING_CONFLICT'); END IF;
 IF FOUND AND v_exec.state='attention' THEN RETURN jsonb_build_object('ok',false,'error','PI_A2U_REQUIRES_OPERATOR_REVIEW','executionId',v_exec.id); END IF;
 SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
 IF v_lease.lease_expires_at IS NOT NULL AND v_lease.lease_expires_at>now() AND v_lease.lease_token IS DISTINCT FROM trim(p_lease_token) THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_SEQUENCE_BUSY','retryable',true); END IF;
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=v_req.id FOR UPDATE;
 IF FOUND THEN
  IF v_exec.seller_id<>v_req.seller_id OR v_exec.amount<>v_req.amount OR v_exec.recipient_uid<>trim(p_recipient_uid) THEN
   RETURN jsonb_build_object('ok',false,'error','PI_A2U_EXECUTION_BINDING_CONFLICT'); END IF;
  IF v_exec.state='attention' THEN RETURN jsonb_build_object('ok',false,'error','PI_A2U_REQUIRES_OPERATOR_REVIEW','executionId',v_exec.id); END IF;
 END IF;
 UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=trim(p_lease_token),payout_request_id=v_req.id,lease_expires_at=now()+interval '5 minutes',updated_at=now() WHERE singleton_id=1;
 IF v_exec.id IS NOT NULL THEN
  RETURN jsonb_build_object('ok',true,'duplicate',true,'executionId',v_exec.id,'state',v_exec.state,'paymentId',v_exec.provider_payment_id,'txid',v_exec.txid,'sellerId',v_exec.seller_id,'recipientUid',v_exec.recipient_uid,'amount',v_exec.amount,'network',v_exec.network);
 END IF;
 INSERT INTO public.gh_pi_a2u_executions(id,payout_request_id,seller_id,recipient_uid,amount,network,state)
 VALUES('pia2u_'||replace(gen_random_uuid()::text,'-',''),v_req.id,v_req.seller_id,trim(p_recipient_uid),v_req.amount,'Pi Testnet','initiating') RETURNING * INTO v_exec;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'executionId',v_exec.id,'state',v_exec.state,'paymentId',NULL,'txid',NULL,'sellerId',v_exec.seller_id,'recipientUid',v_exec.recipient_uid,'amount',v_exec.amount,'network',v_exec.network);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_update_execution(
 p_request_id text,p_lease_token text,p_state text,p_payment_id text DEFAULT NULL,p_txid text DEFAULT NULL,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exec public.gh_pi_a2u_executions%ROWTYPE; v_lease public.gh_pi_a2u_sequence_lease%ROWTYPE;
BEGIN
 IF p_state NOT IN ('initiating','created','submitted','completed','attention') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATE'); END IF;
 SELECT * INTO v_lease FROM public.gh_pi_a2u_sequence_lease WHERE singleton_id=1 FOR UPDATE;
 IF v_lease.lease_token IS DISTINCT FROM trim(p_lease_token) OR v_lease.payout_request_id IS DISTINCT FROM trim(p_request_id) OR v_lease.lease_expires_at<=now() THEN
  RETURN jsonb_build_object('ok',false,'error','PI_A2U_LEASE_LOST'); END IF;
 SELECT * INTO v_exec FROM public.gh_pi_a2u_executions WHERE payout_request_id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_NOT_FOUND'); END IF;
 IF v_exec.state='completed' AND p_state<>'completed' THEN RETURN jsonb_build_object('ok',false,'error','EXECUTION_ALREADY_COMPLETED'); END IF;
 IF v_exec.provider_payment_id IS NOT NULL AND p_payment_id IS NOT NULL AND v_exec.provider_payment_id<>trim(p_payment_id) THEN RETURN jsonb_build_object('ok',false,'error','PAYMENT_ID_CONFLICT'); END IF;
 IF v_exec.txid IS NOT NULL AND p_txid IS NOT NULL AND v_exec.txid<>trim(p_txid) THEN RETURN jsonb_build_object('ok',false,'error','TXID_CONFLICT'); END IF;
 UPDATE public.gh_pi_a2u_executions SET state=p_state,provider_payment_id=COALESCE(provider_payment_id,NULLIF(trim(COALESCE(p_payment_id,'')),'')),txid=COALESCE(txid,NULLIF(trim(COALESCE(p_txid,'')),'')),last_error_code=NULLIF(left(trim(COALESCE(p_error_code,'')),120),''),updated_at=now() WHERE payout_request_id=trim(p_request_id) RETURNING * INTO v_exec;
 RETURN jsonb_build_object('ok',true,'state',v_exec.state,'paymentId',v_exec.provider_payment_id,'txid',v_exec.txid,'executionId',v_exec.id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_pi_a2u_release_sequence_lease(p_lease_token text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.gh_pi_a2u_sequence_lease SET lease_token=NULL,payout_request_id=NULL,lease_expires_at=NULL,updated_at=now()
 WHERE singleton_id=1 AND lease_token=trim(p_lease_token) AND payout_request_id=trim(p_request_id);
 RETURN jsonb_build_object('ok',true,'released',FOUND);
END; $$;

REVOKE ALL ON FUNCTION public.gh_pi_a2u_begin_execution(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_update_execution(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_pi_a2u_release_sequence_lease(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_begin_execution(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_update_execution(text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_pi_a2u_release_sequence_lease(text,text) TO service_role;
COMMENT ON TABLE public.gh_pi_a2u_executions IS 'Durable idempotent Pi Testnet A2U execution ledger. A payout is not paid until provider evidence is reconciled.';
COMMENT ON TABLE public.gh_pi_a2u_sequence_lease IS 'Global expiring lease serializing A2U submissions because the Pi app wallet sequence number permits one payment at a time.';

-- ============================================================================
-- SOURCE 114: 20261022010114_ghc_atomic_seller_payout_settlement.sql
-- SHA256: dfb6ffc8b49ba96be8e896bf8dcb8bdda3011014acb0d28b03920ee6a71cf921
-- ============================================================================
-- Phase 20B: funded GHC marketplace seller payout. This is independent from Pi A2U.
-- Uses the authoritative GHC ledger; never mints GHC. The treasury ID is supplied only by
-- a privileged server route and must identify a funded GreenHaven reserve wallet.
CREATE TABLE IF NOT EXISTS public.gh_seller_payout_ghc_settlements (
  id text PRIMARY KEY,
  payout_request_id text NOT NULL UNIQUE REFERENCES public.gh_seller_payout_requests(id) ON DELETE RESTRICT,
  transfer_reference text NOT NULL UNIQUE,
  treasury_user_id text NOT NULL,
  seller_id text NOT NULL,
  amount numeric(18,4) NOT NULL CHECK(amount>0),
  debit_transaction_id uuid NOT NULL,
  credit_transaction_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'settled' CHECK(status='settled'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_seller_payout_ghc_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_seller_payout_ghc_settlements_no_client ON public.gh_seller_payout_ghc_settlements;
CREATE POLICY gh_seller_payout_ghc_settlements_no_client ON public.gh_seller_payout_ghc_settlements FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_seller_payout_settle_ghc_atomic(
 p_request_id text, p_treasury_user_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_req public.gh_seller_payout_requests%ROWTYPE;
 v_old public.gh_seller_payout_ghc_settlements%ROWTYPE;
 v_amount numeric(18,4);
 v_available numeric;
 v_reference text;
 v_out public.ghc_transactions%ROWTYPE;
 v_in public.ghc_transactions%ROWTYPE;
 v_out_id uuid;
 v_in_id uuid;
 v_now timestamptz := now();
 v_id text;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^spr_[a-f0-9]{16,40}$' OR COALESCE(trim(p_treasury_user_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_req FROM public.gh_seller_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.currency<>'GHC' THEN RETURN jsonb_build_object('ok',false,'error','UNSUPPORTED_PAYOUT_RAIL'); END IF;
 IF v_req.seller_id=trim(p_treasury_user_id) THEN RETURN jsonb_build_object('ok',false,'error','TREASURY_CANNOT_BE_SELLER'); END IF;
 SELECT * INTO v_old FROM public.gh_seller_payout_ghc_settlements WHERE payout_request_id=v_req.id;
 IF FOUND THEN
  IF v_old.treasury_user_id<>trim(p_treasury_user_id) OR v_old.seller_id<>v_req.seller_id OR v_old.amount<>v_req.amount THEN
   RETURN jsonb_build_object('ok',false,'error','PAYOUT_SETTLEMENT_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_req.id,'status','paid','paid',true,'transferReference',v_old.transfer_reference,'amount',v_old.amount,'currency','GHC');
 END IF;
 IF v_req.status<>'processing' THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_PROCESSING'); END IF;
 IF v_req.amount<>round(v_req.amount,4) THEN RETURN jsonb_build_object('ok',false,'error','INVALID_AMOUNT_PRECISION'); END IF;
 -- Payout must still be fully backed by uniquely allocated, completed and verified orders.
 IF NOT EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_req.id) OR
    (SELECT COALESCE(sum(a.amount),0) FROM public.gh_seller_payout_allocations a WHERE a.payout_request_id=v_req.id)<>v_req.amount OR
    EXISTS(SELECT 1 FROM public.gh_seller_payout_allocations a LEFT JOIN public.gh_marketplace_orders o ON o.id=a.order_id
      WHERE a.payout_request_id=v_req.id AND (o.id IS NULL OR o.seller_id<>v_req.seller_id OR upper(o.currency)<>'GHC' OR o.status<>'completed' OR o.payment_status<>'verified')) THEN
  RETURN jsonb_build_object('ok',false,'error','PAYOUT_ORDER_BACKING_INVALID'); END IF;
 -- Lock both ledger participants in canonical order, sharing the wallet lock namespace.
 IF trim(p_treasury_user_id)<v_req.seller_id THEN
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||trim(p_treasury_user_id)));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||v_req.seller_id));
 ELSE
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||v_req.seller_id));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:'||trim(p_treasury_user_id)));
 END IF;
 IF EXISTS(SELECT 1 FROM public.ghc_account_flags WHERE user_id=trim(p_treasury_user_id) AND (restricted OR suspended)) THEN
  RETURN jsonb_build_object('ok',false,'error','TREASURY_ACCOUNT_RESTRICTED'); END IF;
 IF EXISTS(SELECT 1 FROM public.ghc_account_flags WHERE user_id=v_req.seller_id AND (restricted OR suspended)) THEN
  RETURN jsonb_build_object('ok',false,'error','SELLER_ACCOUNT_RESTRICTED'); END IF;
 v_amount:=v_req.amount::numeric(18,4);
 v_reference:='seller_payout_'||v_req.id;
 SELECT * INTO v_out FROM public.ghc_transactions WHERE user_id=trim(p_treasury_user_id) AND reference_id=v_reference AND kind='transfer_out' AND status='posted' LIMIT 1;
 IF FOUND THEN
  IF abs(v_out.amount)<>v_amount OR v_out.counterparty_id IS DISTINCT FROM v_req.seller_id THEN RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT'); END IF;
  SELECT * INTO v_in FROM public.ghc_transactions WHERE user_id=v_req.seller_id AND reference_id=v_reference AND kind='transfer_in' AND status='posted' AND counterparty_id=trim(p_treasury_user_id) LIMIT 1;
  IF NOT FOUND OR v_in.amount<>v_amount THEN RETURN jsonb_build_object('ok',false,'error','TRANSFER_PAIR_INCOMPLETE'); END IF;
  v_out_id:=v_out.id; v_in_id:=v_in.id;
 ELSE
  v_available:=public.ghc_spendable_balance(trim(p_treasury_user_id));
  IF v_available<v_amount THEN RETURN jsonb_build_object('ok',false,'error','INSUFFICIENT_FUNDED_TREASURY','available',v_available,'required',v_amount); END IF;
  INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,counterparty_id,metadata,posted_at)
  VALUES(trim(p_treasury_user_id),'transfer_out',-v_amount,'posted','Marketplace seller payout','MARKETPLACE_SELLER_PAYOUT',v_reference,v_req.seller_id,
    jsonb_build_object('payoutRequestId',v_req.id,'sellerId',v_req.seller_id,'currency','GHC','funded',true),v_now) RETURNING id INTO v_out_id;
  INSERT INTO public.ghc_transactions(user_id,kind,amount,status,reason,source_event,reference_id,counterparty_id,metadata,posted_at)
  VALUES(v_req.seller_id,'transfer_in',v_amount,'posted','Marketplace seller payout received','MARKETPLACE_SELLER_PAYOUT',v_reference,trim(p_treasury_user_id),
    jsonb_build_object('payoutRequestId',v_req.id,'treasuryUserId',trim(p_treasury_user_id),'currency','GHC','funded',true),v_now) RETURNING id INTO v_in_id;
  INSERT INTO public.ghc_economy_events(user_id,event_type,payload,reference_id) VALUES
   (trim(p_treasury_user_id),'GHC_MARKETPLACE_PAYOUT_SENT',jsonb_build_object('amount',v_amount,'sellerId',v_req.seller_id,'requestId',v_req.id),v_reference),
   (v_req.seller_id,'GHC_MARKETPLACE_PAYOUT_RECEIVED',jsonb_build_object('amount',v_amount,'requestId',v_req.id),v_reference);
 END IF;
 v_id:='ghcsp_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_seller_payout_ghc_settlements(id,payout_request_id,transfer_reference,treasury_user_id,seller_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,v_req.id,v_reference,trim(p_treasury_user_id),v_req.seller_id,v_amount,v_out_id,v_in_id);
 UPDATE public.gh_seller_payout_requests SET status='paid',payout_reference=v_reference,operator_note='Atomic funded GHC ledger settlement',updated_at=now(),paid_at=now() WHERE id=v_req.id;
 RETURN jsonb_build_object('ok',true,'idempotent',false,'requestId',v_req.id,'settlementId',v_id,'transferReference',v_reference,'debitTransactionId',v_out_id,'creditTransactionId',v_in_id,'amount',v_amount,'currency','GHC','status','paid','paid',true);
END; $$;
REVOKE ALL ON FUNCTION public.gh_seller_payout_settle_ghc_atomic(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_seller_payout_settle_ghc_atomic(text,text) TO service_role;
COMMENT ON FUNCTION public.gh_seller_payout_settle_ghc_atomic IS 'Atomic, funded GHC seller payout from configured treasury: verifies eligible orders, locks both balances, posts paired ledger legs, records settlement and marks request paid in one transaction.';

-- ============================================================================
-- SOURCE 115: 20261022010115_paystack_ngn_beneficiaries_and_payouts.sql
-- SHA256: c52919205a50d109303e3bf3d0cf12eaacfaf50206f39eed03b5ae38e9db2956
-- ============================================================================
-- Phase 22: Paystack NGN bank-beneficiary and payout adapter foundation.
-- Additive only. This does NOT convert GHC/PI into NGN or invent NGN proceeds.
-- An NGN obligation must be recorded by a trusted revenue/settlement integration with source evidence.

CREATE TABLE IF NOT EXISTS public.gh_bank_beneficiaries (
  id text PRIMARY KEY CHECK (id ~ '^gbn_[a-f0-9]{32}$'),
  user_id text NOT NULL CHECK (length(trim(user_id)) > 0),
  provider text NOT NULL DEFAULT 'paystack' CHECK (provider='paystack'),
  provider_recipient_code text NOT NULL UNIQUE CHECK (provider_recipient_code ~ '^RCP_[A-Za-z0-9]+$'),
  account_fingerprint text NOT NULL UNIQUE CHECK (account_fingerprint ~ '^[a-f0-9]{64}$'),
  bank_code text NOT NULL CHECK (length(trim(bank_code)) BETWEEN 2 AND 20),
  bank_name text NOT NULL CHECK (length(trim(bank_name)) BETWEEN 2 AND 120),
  account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 2 AND 120),
  account_last4 text NOT NULL CHECK (account_last4 ~ '^\d{4}$'),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_bank_beneficiaries_user ON public.gh_bank_beneficiaries(user_id,created_at DESC);
ALTER TABLE public.gh_bank_beneficiaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_beneficiaries_no_client ON public.gh_bank_beneficiaries;
CREATE POLICY gh_bank_beneficiaries_no_client ON public.gh_bank_beneficiaries FOR ALL USING(false) WITH CHECK(false);

-- Only trusted server-side accounting/revenue code may create this record. A GHC/PI order is not an NGN obligation.
CREATE TABLE IF NOT EXISTS public.gh_bank_payout_obligations (
  id text PRIMARY KEY CHECK (id ~ '^gbo_[a-f0-9]{32}$'),
  seller_id text NOT NULL CHECK (length(trim(seller_id)) > 0),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  source_type text NOT NULL CHECK (source_type IN ('ngn_marketplace_sale','ngn_creator_earning','approved_ngn_adjustment')),
  source_reference text NOT NULL UNIQUE CHECK (length(trim(source_reference)) BETWEEN 8 AND 180),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','paid','reversed','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_bank_obligations_seller ON public.gh_bank_payout_obligations(seller_id,status,created_at DESC);
ALTER TABLE public.gh_bank_payout_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_obligations_no_client ON public.gh_bank_payout_obligations;
CREATE POLICY gh_bank_payout_obligations_no_client ON public.gh_bank_payout_obligations FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_daily_limits (
  payout_date date PRIMARY KEY,
  total_reserved_kobo bigint NOT NULL DEFAULT 0 CHECK (total_reserved_kobo >= 0),
  limit_kobo bigint NOT NULL CHECK (limit_kobo >= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_daily_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_daily_limits_no_client ON public.gh_bank_payout_daily_limits;
CREATE POLICY gh_bank_payout_daily_limits_no_client ON public.gh_bank_payout_daily_limits FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_requests (
  id text PRIMARY KEY CHECK (id ~ '^gbp_[a-f0-9]{32}$'),
  obligation_id text NOT NULL REFERENCES public.gh_bank_payout_obligations(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  beneficiary_id text NOT NULL REFERENCES public.gh_bank_beneficiaries(id) ON DELETE RESTRICT,
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','pending','paid','failed','reversed','cancelled','disputed')),
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 160),
  provider_reference text UNIQUE,
  provider_transfer_id text UNIQUE,
  transfer_code text,
  provider_status text,
  provider_evidence_hash text CHECK (provider_evidence_hash IS NULL OR provider_evidence_hash ~ '^[a-f0-9]{64}$'),
  daily_limit_reserved boolean NOT NULL DEFAULT false,
  operator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE(seller_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_bank_payout_active_obligation ON public.gh_bank_payout_requests(obligation_id) WHERE status IN ('requested','approved','processing','pending','paid');
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_queue ON public.gh_bank_payout_requests(status,created_at);
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_seller ON public.gh_bank_payout_requests(seller_id,created_at DESC);
ALTER TABLE public.gh_bank_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_requests_no_client ON public.gh_bank_payout_requests;
CREATE POLICY gh_bank_payout_requests_no_client ON public.gh_bank_payout_requests FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_operator_actions (
  id text PRIMARY KEY CHECK (id ~ '^gbpa_[a-f0-9]{32}$'),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('release_failed_obligation','release_reversed_obligation')),
  operator_note text NOT NULL CHECK (length(trim(operator_note)) BETWEEN 12 AND 1000),
  prior_request_status text NOT NULL,
  prior_obligation_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_operator_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_operator_actions_no_client ON public.gh_bank_payout_operator_actions;
CREATE POLICY gh_bank_payout_operator_actions_no_client ON public.gh_bank_payout_operator_actions FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_webhook_events (
  event_key text PRIMARY KEY CHECK (length(trim(event_key)) BETWEEN 3 AND 180),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  event_name text NOT NULL CHECK (event_name IN ('transfer.success','transfer.failed','transfer.reversed')),
  provider_reference text NOT NULL,
  provider_transfer_id text NOT NULL,
  amount_kobo bigint NOT NULL,
  currency text NOT NULL CHECK (currency='NGN'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gh_bank_payout_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_webhook_events_no_client ON public.gh_bank_payout_webhook_events;
CREATE POLICY gh_bank_payout_webhook_events_no_client ON public.gh_bank_payout_webhook_events FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_bank_payout_reconciliations (
  id text PRIMARY KEY CHECK (id ~ '^gbpr_[a-f0-9]{32}$'),
  payout_request_id text NOT NULL REFERENCES public.gh_bank_payout_requests(id) ON DELETE RESTRICT,
  provider_reference text NOT NULL,
  provider_transfer_id text NOT NULL,
  provider_status text NOT NULL CHECK (provider_status IN ('success','failed','reversed')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 100),
  currency text NOT NULL CHECK (currency='NGN'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payout_request_id,evidence_hash)
);
ALTER TABLE public.gh_bank_payout_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_bank_payout_reconciliations_no_client ON public.gh_bank_payout_reconciliations;
CREATE POLICY gh_bank_payout_reconciliations_no_client ON public.gh_bank_payout_reconciliations FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_bank_payout_record_obligation(
 p_obligation_id text,p_seller_id text,p_amount_kobo bigint,p_source_type text,p_source_reference text,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.gh_bank_payout_obligations%ROWTYPE;
BEGIN
 IF COALESCE(trim(p_obligation_id),'') !~ '^gbo_[a-f0-9]{32}$' OR COALESCE(trim(p_seller_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR
   COALESCE(p_source_type,'') NOT IN ('ngn_marketplace_sale','ngn_creator_earning','approved_ngn_adjustment') OR
   COALESCE(trim(p_source_reference),'')='' OR COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_NGN_OBLIGATION'); END IF;
 SELECT * INTO v_old FROM public.gh_bank_payout_obligations WHERE source_reference=trim(p_source_reference) FOR UPDATE;
 IF FOUND THEN
  IF v_old.seller_id=trim(p_seller_id) AND v_old.amount_kobo=p_amount_kobo AND v_old.source_type=p_source_type AND v_old.evidence_hash=trim(p_evidence_hash) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'obligationId',v_old.id,'status',v_old.status); END IF;
  RETURN jsonb_build_object('ok',false,'error','NGN_OBLIGATION_SOURCE_CONFLICT');
 END IF;
 INSERT INTO public.gh_bank_payout_obligations(id,seller_id,amount_kobo,source_type,source_reference,evidence_hash)
 VALUES(trim(p_obligation_id),trim(p_seller_id),p_amount_kobo,p_source_type,trim(p_source_reference),trim(p_evidence_hash));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'obligationId',trim(p_obligation_id),'status','available','amountKobo',p_amount_kobo,'currency','NGN');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','NGN_OBLIGATION_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_beneficiary_disable(p_user_id text,p_beneficiary_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_beneficiary public.gh_bank_beneficiaries%ROWTYPE;
BEGIN
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=trim(p_beneficiary_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_FOUND'); END IF;
 IF v_beneficiary.user_id<>trim(p_user_id) THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_OWNER_MISMATCH'); END IF;
 IF EXISTS(SELECT 1 FROM public.gh_bank_payout_requests WHERE beneficiary_id=v_beneficiary.id AND status IN ('requested','approved','processing','pending','disputed')) THEN
  RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_HAS_IN_FLIGHT_PAYOUT'); END IF;
 UPDATE public.gh_bank_beneficiaries SET status='disabled',updated_at=now() WHERE id=v_beneficiary.id;
 RETURN jsonb_build_object('ok',true,'beneficiaryId',v_beneficiary.id,'status','disabled');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_request(p_seller_id text,p_obligation_id text,p_beneficiary_id text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_obligation public.gh_bank_payout_obligations%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_old public.gh_bank_payout_requests%ROWTYPE; v_id text;
BEGIN
 IF COALESCE(trim(p_seller_id),'')='' OR COALESCE(trim(p_obligation_id),'') !~ '^gbo_[a-f0-9]{32}$' OR
  COALESCE(trim(p_beneficiary_id),'') !~ '^gbn_[a-f0-9]{32}$' OR length(trim(COALESCE(p_idempotency_key,''))) NOT BETWEEN 8 AND 160 THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_old FROM public.gh_bank_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN
  IF v_old.obligation_id=trim(p_obligation_id) AND v_old.beneficiary_id=trim(p_beneficiary_id) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_old.id,'status',v_old.status,'amountKobo',v_old.amount_kobo); END IF;
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_KEY_CONFLICT');
 END IF;
 SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=trim(p_obligation_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_FOUND'); END IF;
 -- Recheck after the obligation lock so concurrent retries with the same idempotency key converge.
 SELECT * INTO v_old FROM public.gh_bank_payout_requests WHERE seller_id=trim(p_seller_id) AND idempotency_key=trim(p_idempotency_key);
 IF FOUND THEN
  IF v_old.obligation_id=trim(p_obligation_id) AND v_old.beneficiary_id=trim(p_beneficiary_id) THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_old.id,'status',v_old.status,'amountKobo',v_old.amount_kobo); END IF;
  RETURN jsonb_build_object('ok',false,'error','IDEMPOTENCY_KEY_CONFLICT');
 END IF;
 IF v_obligation.seller_id<>trim(p_seller_id) THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_OWNER_MISMATCH'); END IF;
 IF v_obligation.status<>'available' THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_AVAILABLE'); END IF;
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=trim(p_beneficiary_id) FOR SHARE;
 IF NOT FOUND OR v_beneficiary.user_id<>trim(p_seller_id) OR v_beneficiary.status<>'verified' OR v_beneficiary.currency<>'NGN' OR v_beneficiary.provider<>'paystack' THEN
  RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
 v_id:='gbp_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_bank_payout_requests(id,obligation_id,seller_id,beneficiary_id,amount_kobo,idempotency_key)
 VALUES(v_id,v_obligation.id,v_obligation.seller_id,v_beneficiary.id,v_obligation.amount_kobo,trim(p_idempotency_key));
 UPDATE public.gh_bank_payout_obligations SET status='reserved',updated_at=now() WHERE id=v_obligation.id AND status='available';
 IF NOT FOUND THEN RAISE EXCEPTION 'NGN_OBLIGATION_RESERVATION_RACE'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_id,'status','requested','amountKobo',v_obligation.amount_kobo,'currency','NGN');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_REQUEST_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_operator_transition(p_request_id text,p_next_status text,p_operator_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_obligation public.gh_bank_payout_obligations%ROWTYPE;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF p_next_status='approved' AND v_req.status='requested' THEN
  SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=v_req.beneficiary_id;
  IF NOT FOUND OR v_beneficiary.status<>'verified' THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
  UPDATE public.gh_bank_payout_requests SET status='approved',operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),updated_at=now() WHERE id=v_req.id;
  RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','approved','paid',false);
 ELSIF p_next_status='cancelled' AND v_req.status='requested' THEN
  SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=v_req.obligation_id FOR UPDATE;
  IF NOT FOUND OR v_obligation.status<>'reserved' THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_RESERVATION_CONFLICT'); END IF;
  UPDATE public.gh_bank_payout_requests SET status='cancelled',operator_note=NULLIF(left(trim(COALESCE(p_operator_note,'')),1000),''),updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_obligations SET status='available',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
  RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','cancelled','paid',false);
 END IF;
 RETURN jsonb_build_object('ok',false,'error','INVALID_OPERATOR_TRANSITION');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_begin_transfer(p_request_id text,p_max_transfer_kobo bigint,p_daily_limit_kobo bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_beneficiary public.gh_bank_beneficiaries%ROWTYPE; v_reference text; v_day date := (now() AT TIME ZONE 'UTC')::date; v_daily_reserved bigint;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.status NOT IN ('approved','processing','pending') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_APPROVED'); END IF;
 IF p_max_transfer_kobo IS NULL OR p_max_transfer_kobo<100 OR p_daily_limit_kobo IS NULL OR p_daily_limit_kobo<100 THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_LIMITS_NOT_CONFIGURED'); END IF;
 IF v_req.amount_kobo>p_max_transfer_kobo THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_EXCEEDS_SINGLE_TRANSFER_LIMIT','amountKobo',v_req.amount_kobo,'maxTransferKobo',p_max_transfer_kobo); END IF;
 SELECT * INTO v_beneficiary FROM public.gh_bank_beneficiaries WHERE id=v_req.beneficiary_id FOR SHARE;
 IF NOT FOUND OR v_beneficiary.user_id<>v_req.seller_id OR v_beneficiary.status<>'verified' OR v_beneficiary.provider<>'paystack' THEN RETURN jsonb_build_object('ok',false,'error','BENEFICIARY_NOT_VERIFIED'); END IF;
 IF v_req.status='approved' THEN
  INSERT INTO public.gh_bank_payout_daily_limits(payout_date,total_reserved_kobo,limit_kobo) VALUES(v_day,0,p_daily_limit_kobo) ON CONFLICT(payout_date) DO NOTHING;
  UPDATE public.gh_bank_payout_daily_limits SET total_reserved_kobo=total_reserved_kobo+v_req.amount_kobo,limit_kobo=LEAST(limit_kobo,p_daily_limit_kobo),updated_at=now()
   WHERE payout_date=v_day AND total_reserved_kobo+v_req.amount_kobo<=LEAST(limit_kobo,p_daily_limit_kobo) RETURNING total_reserved_kobo INTO v_daily_reserved;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_DAILY_LIMIT_EXCEEDED'); END IF;
  v_reference:='ghb_'||md5(v_req.id);
  UPDATE public.gh_bank_payout_requests SET status='processing',provider_reference=v_reference,daily_limit_reserved=true,updated_at=now() WHERE id=v_req.id;
 ELSE
  IF COALESCE(v_req.provider_reference,'') !~ '^ghb_[a-f0-9]{32}$' THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_PROVIDER_REFERENCE_MISSING'); END IF;
  v_reference:=v_req.provider_reference;
 END IF;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status',CASE WHEN v_req.status='approved' THEN 'processing' ELSE v_req.status END,
  'providerReference',v_reference,'amountKobo',v_req.amount_kobo,'recipientCode',v_beneficiary.provider_recipient_code,'currency','NGN');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_record_submission(p_request_id text,p_provider_reference text,p_transfer_code text,p_provider_status text,p_provider_transfer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.provider_reference IS NOT DISTINCT FROM trim(p_provider_reference) AND v_req.status IN ('paid','failed','reversed') AND
   (v_req.provider_transfer_id IS NULL OR v_req.provider_transfer_id=trim(COALESCE(p_provider_transfer_id,''))) THEN
  RETURN jsonb_build_object('ok',true,'idempotent',true,'requestId',v_req.id,'status',v_req.status,'paid',v_req.status='paid'); END IF;
 IF v_req.status NOT IN ('processing','pending') OR v_req.provider_reference IS DISTINCT FROM trim(p_provider_reference) OR trim(COALESCE(p_provider_status,'')) NOT IN ('pending','otp','success') THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_SUBMISSION_BINDING_MISMATCH'); END IF;
 IF COALESCE(v_req.provider_transfer_id,'')<>'' AND v_req.provider_transfer_id<>trim(COALESCE(p_provider_transfer_id,'')) THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_TRANSFER_ID_CONFLICT'); END IF;
 UPDATE public.gh_bank_payout_requests SET status='pending',provider_transfer_id=NULLIF(trim(COALESCE(p_provider_transfer_id,'')),''),transfer_code=NULLIF(trim(COALESCE(p_transfer_code,'')),''),provider_status=trim(p_provider_status),updated_at=now() WHERE id=v_req.id;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'status','pending','paid',false);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_TRANSFER_ID_ALREADY_USED');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_resolve_exception(p_request_id text,p_resolution text,p_operator_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_obligation public.gh_bank_payout_obligations%ROWTYPE; v_action text; v_id text;
BEGIN
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 SELECT * INTO v_obligation FROM public.gh_bank_payout_obligations WHERE id=v_req.obligation_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','OBLIGATION_NOT_FOUND'); END IF;
 IF length(trim(COALESCE(p_operator_note,''))) NOT BETWEEN 12 AND 1000 THEN RETURN jsonb_build_object('ok',false,'error','OPERATOR_NOTE_REQUIRED'); END IF;
 IF p_resolution='release_failed_obligation' AND v_req.status='failed' AND v_req.provider_status IN ('transfer.failed','reconciled:failed') AND v_obligation.status='reserved' THEN
  v_action:='release_failed_obligation';
 ELSIF p_resolution='release_reversed_obligation' AND v_req.status='reversed' AND v_req.provider_status IN ('transfer.reversed','reconciled:reversed') AND v_obligation.status IN ('reserved','reversed') THEN
  v_action:='release_reversed_obligation';
 ELSE RETURN jsonb_build_object('ok',false,'error','PAYOUT_EXCEPTION_NOT_RESOLVABLE'); END IF;
 v_id:='gbpa_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_bank_payout_operator_actions(id,payout_request_id,action,operator_note,prior_request_status,prior_obligation_status)
 VALUES(v_id,v_req.id,v_action,left(trim(p_operator_note),1000),v_req.status,v_obligation.status);
 UPDATE public.gh_bank_payout_obligations SET status='available',updated_at=now() WHERE id=v_obligation.id;
 RETURN jsonb_build_object('ok',true,'requestId',v_req.id,'obligationId',v_obligation.id,'status',v_req.status,'obligationStatus','available','actionId',v_id,'paid',false);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_apply_webhook(p_event_key text,p_event_name text,p_provider_reference text,p_provider_transfer_id text,p_transfer_code text,p_amount_kobo bigint,p_currency text,p_evidence_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_existing public.gh_bank_payout_webhook_events%ROWTYPE; v_next text;
BEGIN
 IF COALESCE(trim(p_event_key),'')='' OR COALESCE(p_event_name,'') NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR
  COALESCE(trim(p_provider_reference),'') !~ '^ghb_[a-f0-9]{32}$' OR COALESCE(trim(p_provider_transfer_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR COALESCE(p_currency,'')<>'NGN' OR
  COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_WEBHOOK_EVIDENCE'); END IF;
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE provider_reference=trim(p_provider_reference) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.amount_kobo<>p_amount_kobo OR v_req.currency<>p_currency OR (v_req.provider_transfer_id IS NOT NULL AND v_req.provider_transfer_id<>trim(p_provider_transfer_id)) THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_BINDING_MISMATCH'); END IF;
 SELECT * INTO v_existing FROM public.gh_bank_payout_webhook_events WHERE event_key=trim(p_event_key);
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_req.id,'status',v_req.status,'paid',v_req.status='paid'); END IF;
 INSERT INTO public.gh_bank_payout_webhook_events(event_key,payout_request_id,event_name,provider_reference,provider_transfer_id,amount_kobo,currency,evidence_hash)
 VALUES(trim(p_event_key),v_req.id,p_event_name,trim(p_provider_reference),trim(p_provider_transfer_id),p_amount_kobo,p_currency,trim(p_evidence_hash));
 IF p_event_name='transfer.success' AND EXISTS(SELECT 1 FROM public.gh_bank_payout_requests other WHERE other.obligation_id=v_req.obligation_id AND other.id<>v_req.id AND other.status IN ('requested','approved','processing','pending','paid')) THEN
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='transfer.success_conflict',updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='transfer.success_conflict',updated_at=now() WHERE obligation_id=v_req.obligation_id AND id<>v_req.id AND status IN ('requested','approved','processing','pending','paid');
  UPDATE public.gh_bank_payout_obligations SET status='disputed',updated_at=now() WHERE id=v_req.obligation_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','disputed','paid',false,'manualReviewRequired',true);
 END IF;
 IF v_req.status='paid' AND p_event_name='transfer.failed' THEN RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','paid','paid',true); END IF;
 v_next:=CASE p_event_name WHEN 'transfer.success' THEN 'paid' WHEN 'transfer.failed' THEN 'failed' ELSE 'reversed' END;
 UPDATE public.gh_bank_payout_requests SET status=v_next,provider_transfer_id=COALESCE(provider_transfer_id,trim(p_provider_transfer_id)),transfer_code=COALESCE(transfer_code,NULLIF(trim(COALESCE(p_transfer_code,'')),'')),provider_status=p_event_name,provider_evidence_hash=trim(p_evidence_hash),updated_at=now(),paid_at=CASE WHEN v_next='paid' THEN now() ELSE paid_at END WHERE id=v_req.id;
 IF v_next='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='paid',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
 ELSIF v_next='reversed' AND v_req.status='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='reversed',updated_at=now() WHERE id=v_req.obligation_id AND status='paid'; END IF;
 -- Failed/reversed payouts keep the obligation reserved for explicit operator review; no automatic re-payout.
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status',v_next,'paid',v_next='paid');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','WEBHOOK_EVENT_CONFLICT');
END; $$;

CREATE OR REPLACE FUNCTION public.gh_bank_payout_apply_reconciliation(
 p_request_id text,p_provider_reference text,p_provider_transfer_id text,p_transfer_code text,p_amount_kobo bigint,p_currency text,p_provider_status text,p_evidence_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_req public.gh_bank_payout_requests%ROWTYPE; v_id text; v_next text;
BEGIN
 IF COALESCE(trim(p_request_id),'') !~ '^gbp_[a-f0-9]{32}$' OR COALESCE(trim(p_provider_reference),'') !~ '^ghb_[a-f0-9]{32}$' OR
  COALESCE(trim(p_provider_transfer_id),'')='' OR p_amount_kobo IS NULL OR p_amount_kobo<100 OR COALESCE(p_currency,'')<>'NGN' OR
  COALESCE(p_provider_status,'') NOT IN ('success','failed','reversed') OR COALESCE(trim(p_evidence_hash),'') !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_PROVIDER_RECONCILIATION'); END IF;
 SELECT * INTO v_req FROM public.gh_bank_payout_requests WHERE id=trim(p_request_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_FOUND'); END IF;
 IF v_req.provider_reference IS DISTINCT FROM trim(p_provider_reference) OR v_req.amount_kobo<>p_amount_kobo OR v_req.currency<>p_currency OR
  (v_req.provider_transfer_id IS NOT NULL AND v_req.provider_transfer_id<>trim(p_provider_transfer_id)) THEN
  RETURN jsonb_build_object('ok',false,'error','TRANSFER_BINDING_MISMATCH'); END IF;
 IF v_req.status NOT IN ('processing','pending','paid','failed','reversed') THEN RETURN jsonb_build_object('ok',false,'error','PAYOUT_NOT_IN_FLIGHT'); END IF;
 IF v_req.status='paid' AND p_provider_status='failed' THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'requestId',v_req.id,'status','paid','paid',true); END IF;
 INSERT INTO public.gh_bank_payout_reconciliations(id,payout_request_id,provider_reference,provider_transfer_id,provider_status,amount_kobo,currency,evidence_hash)
 VALUES('gbpr_'||replace(gen_random_uuid()::text,'-',''),v_req.id,trim(p_provider_reference),trim(p_provider_transfer_id),p_provider_status,p_amount_kobo,p_currency,trim(p_evidence_hash))
 ON CONFLICT(payout_request_id,evidence_hash) DO NOTHING;
 IF p_provider_status='success' AND EXISTS(SELECT 1 FROM public.gh_bank_payout_requests other WHERE other.obligation_id=v_req.obligation_id AND other.id<>v_req.id AND other.status IN ('requested','approved','processing','pending','paid')) THEN
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='reconciled:success_conflict',updated_at=now() WHERE id=v_req.id;
  UPDATE public.gh_bank_payout_requests SET status='disputed',provider_status='reconciled:success_conflict',updated_at=now() WHERE obligation_id=v_req.obligation_id AND id<>v_req.id AND status IN ('requested','approved','processing','pending','paid');
  UPDATE public.gh_bank_payout_obligations SET status='disputed',updated_at=now() WHERE id=v_req.obligation_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status','disputed','paid',false,'manualReviewRequired',true);
 END IF;
 v_next:=CASE p_provider_status WHEN 'success' THEN 'paid' WHEN 'failed' THEN 'failed' ELSE 'reversed' END;
 UPDATE public.gh_bank_payout_requests SET status=v_next,provider_transfer_id=COALESCE(provider_transfer_id,trim(p_provider_transfer_id)),transfer_code=COALESCE(transfer_code,NULLIF(trim(COALESCE(p_transfer_code,'')),'')),provider_status='reconciled:'||p_provider_status,provider_evidence_hash=trim(p_evidence_hash),updated_at=now(),paid_at=CASE WHEN v_next='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END WHERE id=v_req.id;
 IF v_next='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='paid',updated_at=now() WHERE id=v_req.obligation_id AND status='reserved';
 ELSIF v_next='reversed' AND v_req.status='paid' THEN UPDATE public.gh_bank_payout_obligations SET status='reversed',updated_at=now() WHERE id=v_req.obligation_id AND status='paid'; END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'requestId',v_req.id,'status',v_next,'paid',v_next='paid');
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','PROVIDER_RECONCILIATION_CONFLICT');
END; $$;

REVOKE ALL ON TABLE public.gh_bank_beneficiaries, public.gh_bank_payout_obligations, public.gh_bank_payout_daily_limits, public.gh_bank_payout_requests, public.gh_bank_payout_operator_actions, public.gh_bank_payout_webhook_events, public.gh_bank_payout_reconciliations FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.gh_bank_beneficiaries, public.gh_bank_payout_obligations, public.gh_bank_payout_daily_limits, public.gh_bank_payout_requests, public.gh_bank_payout_operator_actions, public.gh_bank_payout_webhook_events, public.gh_bank_payout_reconciliations TO service_role;

REVOKE ALL ON FUNCTION public.gh_bank_payout_record_obligation(text,text,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_beneficiary_disable(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_request(text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_operator_transition(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_begin_transfer(text,bigint,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_record_submission(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_resolve_exception(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_webhook(text,text,text,text,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_bank_payout_apply_reconciliation(text,text,text,text,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_record_obligation(text,text,bigint,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_beneficiary_disable(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_request(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_operator_transition(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_begin_transfer(text,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_record_submission(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_resolve_exception(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_apply_webhook(text,text,text,text,text,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_bank_payout_apply_reconciliation(text,text,text,text,bigint,text,text,text) TO service_role;

COMMENT ON TABLE public.gh_bank_payout_daily_limits IS 'UTC daily reserved NGN transfer limits. Failed attempts remain counted for the day to avoid retry-based limit evasion.';
COMMENT ON TABLE public.gh_bank_payout_obligations IS 'Verified NGN liabilities only. GHC/PI balances must never be converted into NGN without a separately funded and approved FX settlement.';
COMMENT ON TABLE public.gh_bank_payout_requests IS 'Paystack NGN transfer requests; only verified signed webhooks may mark a payout paid.';


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

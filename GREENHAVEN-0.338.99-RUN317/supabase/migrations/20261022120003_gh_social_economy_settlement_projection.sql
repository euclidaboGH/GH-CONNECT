-- GreenHaven Phase 14.2 — social/economy settlement projection bridge.
-- Purpose: every REAL, balance-funded creator payment that references content
-- becomes visible on that content and can refresh the wallet UI.
-- No issuance. No client writes. Settlement remains authoritative in ghc_transactions.

CREATE OR REPLACE FUNCTION public.gh_content_reward_record_funded_settlement(
  p_post_id text,
  p_amount numeric,
  p_source text,
  p_reference_id text,
  p_contributor_id text DEFAULT NULL,
  p_author_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id text := trim(COALESCE(p_post_id, ''));
  v_source text := lower(trim(COALESCE(p_source, '')));
  v_ref text := trim(COALESCE(p_reference_id, ''));
  v_amount numeric(24,8) := round(COALESCE(p_amount, 0), 4);
  v_author text;
  v_username text;
  v_existing numeric(24,8) := 0;
BEGIN
  IF v_post_id = '' OR v_ref = '' OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;
  IF v_amount > 100000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AMOUNT_TOO_LARGE');
  END IF;
  IF v_source NOT IN ('curation', 'tip', 'creator_reward') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SOURCE');
  END IF;

  SELECT author_id INTO v_author
  FROM public.gh_posts
  WHERE id = v_post_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF p_author_id IS NOT NULL AND trim(p_author_id) <> v_author THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTHOR_MISMATCH');
  END IF;

  -- Idempotency is anchored to the settlement reference in metadata, not to
  -- client state. This prevents duplicate display totals after a retry.
  SELECT COALESCE((metadata->'fundedSettlements'->>v_ref)::numeric, 0)
  INTO v_existing
  FROM public.gh_content_rewards
  WHERE post_id = v_post_id;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'amount', v_existing, 'postId', v_post_id);
  END IF;

  INSERT INTO public.gh_content_rewards (
    post_id, status, enabled, total_earned, author_reward, curation_reward,
    curation_funded, epoch_key, metadata, updated_at
  ) VALUES (
    v_post_id, 'accruing', true,
    v_amount,
    v_amount,
    0,
    CASE WHEN v_source = 'curation' THEN v_amount ELSE 0 END,
    'SOCIAL_FUNDED_SETTLEMENT_V1',
    jsonb_build_object(
      'fundingSource', v_source,
      'fundedSettlements', jsonb_build_object(v_ref, v_amount)
    ),
    now()
  )
  ON CONFLICT (post_id) DO UPDATE SET
    status = CASE WHEN public.gh_content_rewards.status = 'voided' THEN 'accruing' ELSE public.gh_content_rewards.status END,
    enabled = true,
    total_earned = public.gh_content_rewards.total_earned + EXCLUDED.total_earned,
    author_reward = public.gh_content_rewards.author_reward + EXCLUDED.author_reward,
    curation_funded = public.gh_content_rewards.curation_funded + EXCLUDED.curation_funded,
    metadata = public.gh_content_rewards.metadata || jsonb_build_object(
      'fundedSettlements',
      COALESCE(public.gh_content_rewards.metadata->'fundedSettlements', '{}'::jsonb) ||
      jsonb_build_object(v_ref, v_amount)
    ),
    updated_at = now();

  IF p_contributor_id IS NOT NULL AND trim(p_contributor_id) <> '' THEN
    SELECT COALESCE(NULLIF(trim(username), ''), 'member') INTO v_username
    FROM public.gh_user_profiles
    WHERE gh_user_id = trim(p_contributor_id)
    LIMIT 1;
    v_username := COALESCE(v_username, 'member');

    INSERT INTO public.gh_content_reward_contributors(post_id, user_id, username, amount, rank)
    VALUES(v_post_id, trim(p_contributor_id), v_username, v_amount, 0)
    ON CONFLICT(post_id, user_id) DO UPDATE SET
      username = EXCLUDED.username,
      amount = public.gh_content_reward_contributors.amount + EXCLUDED.amount,
      rank = 0;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'amount', v_amount,
    'postId', v_post_id,
    'source', v_source,
    'authorId', v_author
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_reward_record_funded_settlement(text,numeric,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_record_funded_settlement(text,numeric,text,text,text,text) TO service_role;

COMMENT ON FUNCTION public.gh_content_reward_record_funded_settlement(text,numeric,text,text,text,text) IS
  'Projects an already-settled balance-funded tip, curation contribution, or approved creator reward onto the content reward view. Never mints GHC.';

-- Re-apply GHC tip settlement with content projection. Existing ledger transfer
-- remains the source of truth; the projection is in the same DB transaction.
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
 v_projection jsonb;
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

 IF v_tip.content_id IS NOT NULL AND trim(v_tip.content_id)<>'' THEN
   v_projection := public.gh_content_reward_record_funded_settlement(
     v_tip.content_id, p_amount, 'tip', v_ref, v_tip.tipper_id, v_tip.recipient_id
   );
   IF COALESCE((v_projection->>'ok')::boolean,false) IS NOT TRUE THEN
     RAISE EXCEPTION 'CONTENT_REWARD_PROJECTION_FAILED: %', COALESCE(v_projection->>'error','UNKNOWN');
   END IF;
 END IF;

 RETURN jsonb_build_object('ok',true,'idempotent',false,'intentId',v_tip.id,'settlementId',v_id,
   'transferReference',v_ref,'amount',p_amount,'currency','GHC','creatorPaid',true,
   'contentRewardProjected', v_tip.content_id IS NOT NULL AND trim(v_tip.content_id)<>'' );
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('ok',false,'error','GHC_TIP_REFERENCE_CONFLICT');
END; $$;

REVOKE ALL ON FUNCTION public.gh_tip_settle_ghc_atomic(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_tip_settle_ghc_atomic(text,text,numeric) TO service_role;

-- Re-apply funded creator reward settlement with content projection.
CREATE OR REPLACE FUNCTION public.gh_creator_reward_settle_funded(p_reward_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_reward public.gh_creator_reward_events%ROWTYPE;
 v_old public.gh_creator_reward_pool_movements%ROWTYPE;
 v_transfer jsonb;
 v_debit jsonb;
 v_credit jsonb;
 v_ref text;
 v_id text;
 v_projection jsonb;
 v_pool constant text := '__GH_CREATOR_REWARD_POOL__';
BEGIN
 IF COALESCE(trim(p_reward_event_id),'')='' THEN RETURN jsonb_build_object('ok',false,'error','REWARD_EVENT_REQUIRED'); END IF;
 SELECT * INTO v_reward FROM public.gh_creator_reward_events WHERE id=trim(p_reward_event_id) FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','REWARD_EVENT_NOT_FOUND'); END IF;
 SELECT * INTO v_old FROM public.gh_creator_reward_pool_movements WHERE reward_event_id=v_reward.id;
 IF FOUND THEN
  IF v_old.recipient_id<>v_reward.creator_id OR v_old.amount<>v_reward.proposed_amount OR v_old.movement_kind<>'distribution' THEN
   RETURN jsonb_build_object('ok',false,'error','REWARD_SETTLEMENT_CONFLICT');
  END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',true,'movementId',v_old.id,'amount',v_old.amount,'currency','GHC','status','settled');
 END IF;
 IF v_reward.status<>'approved' OR v_reward.currency<>'GHC' OR v_reward.proposed_amount IS NULL OR
    v_reward.proposed_amount<=0 OR v_reward.proposed_amount<>round(v_reward.proposed_amount,4) THEN
  RETURN jsonb_build_object('ok',false,'error','APPROVED_FUNDED_GHC_REWARD_REQUIRED');
 END IF;
 v_ref:='creator_reward_'||v_reward.id;
 v_transfer:=public.ghc_execute_transfer(v_pool,v_reward.creator_id,v_reward.proposed_amount,v_ref,'Funded creator reward distribution',NULL);
 IF COALESCE((v_transfer->>'ok')::boolean,false) IS NOT TRUE THEN
  RETURN jsonb_build_object('ok',false,'error',COALESCE(v_transfer->>'code','REWARD_POOL_INSUFFICIENT_OR_TRANSFER_FAILED'),
    'message',COALESCE(v_transfer->>'message','Reward distribution did not complete'));
 END IF;
 v_debit:=v_transfer->'debitTx';
 v_credit:=v_transfer->'creditTx';
 IF v_debit IS NULL OR v_credit IS NULL OR v_debit->>'userId'<>v_pool OR v_credit->>'userId'<>v_reward.creator_id OR
    v_debit->>'kind'<>'transfer_out' OR v_credit->>'kind'<>'transfer_in' OR
    COALESCE(v_debit->>'id','')='' OR COALESCE(v_credit->>'id','')='' OR
    v_debit->>'referenceId'<>v_ref OR v_credit->>'referenceId'<>v_ref OR
    abs(COALESCE((v_debit->>'amount')::numeric,0))<>v_reward.proposed_amount OR
    COALESCE((v_credit->>'amount')::numeric,0)<>v_reward.proposed_amount THEN
  RAISE EXCEPTION 'REWARD_TRANSFER_LEDGER_VERIFICATION_FAILED';
 END IF;
 v_id:='crpm_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.gh_creator_reward_pool_movements(id,movement_kind,reference_id,reward_event_id,actor_id,recipient_id,amount,debit_transaction_id,credit_transaction_id)
 VALUES(v_id,'distribution',v_ref,v_reward.id,v_pool,v_reward.creator_id,v_reward.proposed_amount,
   COALESCE(v_debit->>'id',''),COALESCE(v_credit->>'id',''));
 UPDATE public.gh_creator_reward_events SET status='settled',settlement_reference=v_ref,updated_at=now() WHERE id=v_reward.id;

 v_projection := public.gh_content_reward_record_funded_settlement(
   v_reward.content_id, v_reward.proposed_amount, 'creator_reward', v_ref, NULL, v_reward.creator_id
 );
 IF COALESCE((v_projection->>'ok')::boolean,false) IS NOT TRUE THEN
   RAISE EXCEPTION 'CONTENT_REWARD_PROJECTION_FAILED: %', COALESCE(v_projection->>'error','UNKNOWN');
 END IF;

 RETURN jsonb_build_object('ok',true,'idempotent',false,'movementId',v_id,'amount',v_reward.proposed_amount,
   'currency','GHC','status','settled','contentRewardProjected',true);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',false,'error','REWARD_SETTLEMENT_REFERENCE_CONFLICT');
END; $$;

REVOKE ALL ON FUNCTION public.gh_creator_reward_settle_funded(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_creator_reward_settle_funded(text) TO service_role;

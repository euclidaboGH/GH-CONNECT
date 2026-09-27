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

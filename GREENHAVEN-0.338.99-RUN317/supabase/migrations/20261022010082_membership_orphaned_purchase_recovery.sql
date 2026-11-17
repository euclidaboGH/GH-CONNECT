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

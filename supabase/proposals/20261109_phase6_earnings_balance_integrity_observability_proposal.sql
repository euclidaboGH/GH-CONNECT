-- PROPOSAL ONLY — do not apply until Testnet/Mainnet migration histories are reconciled,
-- the complete dependency graph is proven, and this function is rehearsed on disposable PostgreSQL.
-- Backward-compatible: existing clamped fields remain unchanged; raw totals and integrity signals are additive.

CREATE OR REPLACE FUNCTION public.gh_earnings_balances(
  p_user_id text,
  p_asset text DEFAULT 'PI'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_asset text := COALESCE(NULLIF(trim(COALESCE(p_asset, '')), ''), 'PI');
  v_pending numeric(38,0) := 0;
  v_available numeric(38,0) := 0;
  v_reserved numeric(38,0) := 0;
  v_paid numeric(38,0) := 0;
  v_reversed numeric(38,0) := 0;
  v_disputed numeric(38,0) := 0;
  v_available_raw numeric(38,0) := 0;
  v_reserved_raw numeric(38,0) := 0;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 OR v_asset <> 'PI' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'credit' AND status = 'pending' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN entry_type = 'credit' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'release_reserve' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'reverse' AND status = 'available' THEN amount_atomic
      WHEN entry_type = 'debit' AND status = 'available' THEN -amount_atomic
      WHEN entry_type = 'reserve' AND status = 'reserved' THEN -amount_atomic
      ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN entry_type = 'reserve' AND status = 'reserved' THEN amount_atomic
      WHEN entry_type = 'settle' AND status = 'paid' THEN -amount_atomic
      WHEN entry_type = 'release_reserve' AND status = 'available' THEN -amount_atomic
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'settle' AND status = 'paid' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'reverse' THEN amount_atomic ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'dispute' AND status = 'disputed' THEN amount_atomic ELSE 0 END), 0)
  INTO v_pending, v_available, v_reserved, v_paid, v_reversed, v_disputed
  FROM public.gh_earnings_ledger_entries
  WHERE user_id = v_user AND asset = v_asset;

  -- Preserve raw totals before compatibility clamping. Negative raw values are
  -- integrity anomalies, not healthy zero balances.
  v_available_raw := v_available;
  v_reserved_raw := v_reserved;

  -- Keep legacy display values fail-closed and backward-compatible.
  IF v_available < 0 THEN v_available := 0; END IF;
  IF v_reserved < 0 THEN v_reserved := 0; END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'asset', v_asset,
    'pendingAtomic', v_pending,
    'availableAtomic', v_available,
    'reservedAtomic', v_reserved,
    'rawAvailableAtomic', v_available_raw,
    'rawReservedAtomic', v_reserved_raw,
    'integrityOk', (v_available_raw >= 0 AND v_reserved_raw >= 0),
    'integrityAnomalies', to_jsonb(array_remove(ARRAY[
      CASE WHEN v_available_raw < 0 THEN 'NEGATIVE_AVAILABLE_TOTAL'::text END,
      CASE WHEN v_reserved_raw < 0 THEN 'NEGATIVE_RESERVED_TOTAL'::text END
    ], NULL)),
    'paidAtomic', v_paid,
    'reversedAtomic', v_reversed,
    'disputedAtomic', v_disputed,
    -- Display helpers (7 decimal places for PI atomic)
    'pending', (v_pending / 10000000.0),
    'available', (v_available / 10000000.0),
    'reserved', (v_reserved / 10000000.0),
    'paid', (v_paid / 10000000.0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_earnings_balances(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_earnings_balances(text, text) TO service_role;

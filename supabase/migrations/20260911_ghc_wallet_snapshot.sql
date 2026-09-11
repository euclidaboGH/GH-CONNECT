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

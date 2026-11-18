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

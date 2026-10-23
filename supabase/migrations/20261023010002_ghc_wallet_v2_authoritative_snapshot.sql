-- GreenHaven Phase 28 — GHC Wallet V2 authoritative read model.
-- One ledger, one balance authority, explicit available/pending/locked/escrow states.
-- No issuance. No client writes. Escrow is intentionally 0 until a durable escrow
-- reservation rail exists; withdrawal reservations remain classified as locked.

CREATE OR REPLACE FUNCTION public.ghc_wallet_v2_snapshot(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user text := trim(coalesce(p_user_id, ''));
  v_ledger numeric := 0;
  v_available numeric := 0;
  v_pending numeric := 0;
  v_locked numeric := 0;
  v_escrow numeric := 0;
  v_earned numeric := 0;
  v_spent numeric := 0;
  v_purchased numeric := 0;
  v_transfers_in numeric := 0;
  v_transfers_out numeric := 0;
  v_rewards numeric := 0;
  v_creator numeric := 0;
  v_curation numeric := 0;
  v_marketplace numeric := 0;
  v_membership numeric := 0;
  v_withdrawals numeric := 0;
  v_adjustments numeric := 0;
  v_unknown numeric := 0;
  v_pending_count integer := 0;
BEGIN
  IF v_user = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED');
  END IF;

  SELECT
    coalesce(sum(CASE WHEN status = 'posted' AND kind <> 'transfer_request' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'pending' AND amount > 0 AND kind <> 'transfer_request' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND amount > 0 AND kind IN ('earned','transfer_in') THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND amount < 0 AND kind IN ('spent','transfer_out') THEN abs(amount) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND amount > 0 AND kind = 'purchased' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND kind = 'transfer_in' AND amount > 0 THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND kind = 'transfer_out' AND amount < 0 THEN abs(amount) ELSE 0 END), 0),
    count(*) FILTER (WHERE status = 'pending' AND amount > 0 AND kind <> 'transfer_request')
  INTO v_ledger, v_pending, v_earned, v_spent, v_purchased, v_transfers_in, v_transfers_out, v_pending_count
  FROM public.ghc_transactions
  WHERE user_id = v_user;

  v_ledger := greatest(0, v_ledger);
  v_available := greatest(0, public.ghc_spendable_balance(v_user));
  v_locked := greatest(0, v_ledger - v_available);
  v_escrow := 0;

  SELECT
    coalesce(sum(CASE WHEN status = 'posted' AND amount > 0 AND (
      upper(source_event) LIKE '%REWARD%' OR upper(source_event) LIKE '%CLAIM%'
    ) THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND amount > 0 AND (
      upper(source_event) LIKE '%CREATOR%'
    ) THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND amount > 0 AND (
      upper(source_event) LIKE '%CURATION%'
    ) THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND (
      upper(source_event) LIKE '%MARKETPLACE%' OR upper(source_event) LIKE '%ORDER%'
    ) THEN abs(amount) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND (
      upper(source_event) LIKE '%MEMBERSHIP%' OR upper(source_event) LIKE '%PREMIUM%'
    ) THEN abs(amount) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND (
      upper(source_event) LIKE '%WITHDRAW%'
    ) THEN abs(amount) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND kind = 'adjusted' THEN abs(amount) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN status = 'posted' AND kind NOT IN ('earned','spent','purchased','reversed','expired','adjusted','transfer_out','transfer_in','transfer_request') THEN abs(amount) ELSE 0 END), 0)
  INTO v_rewards, v_creator, v_curation, v_marketplace, v_membership, v_withdrawals, v_adjustments, v_unknown
  FROM public.ghc_transactions
  WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user,
    'currency', 'GHC',
    'available', v_available,
    'pending', greatest(0, v_pending),
    'locked', v_locked,
    'escrowLocked', v_escrow,
    'ledgerBalance', v_ledger,
    'lifetimeEarned', greatest(0, v_earned),
    'lifetimeSpent', greatest(0, v_spent),
    'lifetimePurchased', greatest(0, v_purchased),
    'pendingCount', v_pending_count,
    'categories', jsonb_build_object(
      'rewards', greatest(0, v_rewards),
      'creator', greatest(0, v_creator),
      'curation', greatest(0, v_curation),
      'transfersIn', greatest(0, v_transfers_in),
      'transfersOut', greatest(0, v_transfers_out),
      'marketplace', greatest(0, v_marketplace),
      'membership', greatest(0, v_membership),
      'withdrawals', greatest(0, v_withdrawals),
      'adjustments', greatest(0, v_adjustments),
      'unclassified', greatest(0, v_unknown)
    ),
    'holds', jsonb_build_object(
      'withdrawalLocked', greatest(0, v_locked),
      'escrowLocked', v_escrow,
      'escrowRail', 'not_configured'
    ),
    'reconciliation', jsonb_build_object(
      'availablePlusLockedEqualsLedger', abs((v_available + v_locked) - v_ledger) < 0.0001,
      'availableNonNegative', v_available >= 0,
      'pendingNonNegative', v_pending >= 0,
      'ledgerNonNegative', v_ledger >= 0,
      'unclassifiedAmount', greatest(0, v_unknown)
    ),
    'updatedAt', (extract(epoch from now()) * 1000)::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_wallet_v2_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_wallet_v2_snapshot(text) TO service_role;

COMMENT ON FUNCTION public.ghc_wallet_v2_snapshot(text) IS
  'Phase 28 wallet authority. Available/pending/locked/escrow are derived from the canonical GHC ledger. No minting and no client writes.';

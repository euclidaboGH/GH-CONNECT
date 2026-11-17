-- Ensure fee_bps exists for fee-aware gh_earnings_withdrawable / quote_withdrawal (Phase 6 fee).
-- Idempotent. Does not alter ledger entries, RLS, or payout authorization.
-- Safe on databases that already applied 20261029010011.

DO $$
BEGIN
  IF to_regclass('public.gh_earnings_payout_policy') IS NULL THEN
    RAISE NOTICE 'gh_earnings_payout_policy missing — apply 20261029010010 first';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gh_earnings_payout_policy'
      AND column_name = 'fee_bps'
  ) THEN
    ALTER TABLE public.gh_earnings_payout_policy
      ADD COLUMN fee_bps integer NOT NULL DEFAULT 300;
    RAISE NOTICE 'Added gh_earnings_payout_policy.fee_bps';
  END IF;

  UPDATE public.gh_earnings_payout_policy
  SET fee_bps = COALESCE(fee_bps, 300),
      updated_at = now()
  WHERE singleton_id = 1
    AND (fee_bps IS NULL OR fee_bps < 0);
END $$;

COMMENT ON COLUMN public.gh_earnings_payout_policy.fee_bps IS
  'Withdrawal fee in basis points (300 = 3%). Required by gh_earnings_withdrawable and gh_earnings_quote_withdrawal.';

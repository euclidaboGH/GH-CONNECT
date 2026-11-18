-- Testnet feature activation guardrails (RUN352).
-- Runtime feature switches are controlled in Vercel Preview/testnet.
-- This migration makes the database network boundary explicit for Pi A2U
-- payout ledgers. It does not bypass identity, consent, lease, idempotency,
-- balance, provider-receipt or operator-review requirements.

ALTER TABLE public.gh_pi_earnings_payout_requests
  ALTER COLUMN network SET DEFAULT 'Pi Testnet',
  ALTER COLUMN network SET NOT NULL;

ALTER TABLE public.gh_pi_cashback_a2u_payouts
  ALTER COLUMN network SET DEFAULT 'Pi Testnet',
  ALTER COLUMN network SET NOT NULL;

ALTER TABLE public.gh_pi_a2u_executions
  ALTER COLUMN network SET DEFAULT 'Pi Testnet',
  ALTER COLUMN network SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gh_pi_earnings_payout_requests'::regclass
      AND conname='gh_pi_earnings_payout_network_testnet_only'
  ) THEN
    ALTER TABLE public.gh_pi_earnings_payout_requests
      ADD CONSTRAINT gh_pi_earnings_payout_network_testnet_only
      CHECK (network = 'Pi Testnet');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gh_pi_cashback_a2u_payouts'::regclass
      AND conname='gh_pi_cashback_a2u_network_testnet_only'
  ) THEN
    ALTER TABLE public.gh_pi_cashback_a2u_payouts
      ADD CONSTRAINT gh_pi_cashback_a2u_network_testnet_only
      CHECK (network = 'Pi Testnet');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gh_pi_a2u_executions'::regclass
      AND conname='gh_pi_a2u_execution_network_testnet_only'
  ) THEN
    ALTER TABLE public.gh_pi_a2u_executions
      ADD CONSTRAINT gh_pi_a2u_execution_network_testnet_only
      CHECK (network = 'Pi Testnet');
  END IF;
END;
$$;

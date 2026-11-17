-- Phase 29: Membership + Pi Payment Convergence V2
-- Durable payment->entitlement reconciliation contract.
-- No client table access is introduced. Existing entitlement/payment authorities remain canonical.

CREATE INDEX IF NOT EXISTS idx_ghc_membership_entitlements_user_purchase
  ON public.ghc_membership_entitlements (user_id, purchase_ref);

CREATE INDEX IF NOT EXISTS idx_ghc_payment_intents_membership_completed
  ON public.ghc_payment_intents (user_id, status, completed_at DESC)
  WHERE purpose = 'membership' AND status IN ('COMPLETED', 'FULFILLED');

COMMENT ON INDEX public.idx_ghc_payment_intents_membership_completed IS
  'Phase 29: accelerates server-side recovery of completed membership payments whose entitlement write was interrupted.';

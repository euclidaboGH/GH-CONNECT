-- Backfill metadata for legacy pending daily-claim holds only.
-- No amounts, ownership, status, or ledger rows are changed. The existing
-- ghc_claim_pending RPC still enforces ownership, review status and the 48h lock.
UPDATE public.ghc_transactions
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'claimKind', 'DAILY_CLAIM_V12',
  'rewardLifecycle', 'daily_claim_48h',
  'claimedAt', COALESCE(metadata->'claimedAt', to_jsonb(created_at)),
  'redeemableAt', COALESCE(metadata->'redeemableAt', to_jsonb(created_at + interval '48 hours'))
)
WHERE status = 'pending'
  AND amount > 0
  AND source_event = 'DAILY_CLAIM_V12'
  AND COALESCE(metadata->>'claimKind', '') = ''
  AND COALESCE(metadata->>'reviewRequired', 'false') <> 'true';


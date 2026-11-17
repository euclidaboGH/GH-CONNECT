-- Stage 2 disposable PostgreSQL smoke (run ONLY after applying reviewed migrations).
-- Never run against Mainnet without explicit operator approval.
-- Expect: functions exist; no data required for these checks.

-- Ledger / spend
SELECT proname FROM pg_proc WHERE proname IN (
  'ghc_execute_spend',
  'ghc_purchase_membership',
  'gh_marketplace_release_expired_reservations'
) ORDER BY 1;

-- Columns for reservation + payment claim
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gh_marketplace_orders'
  AND column_name IN ('reservation_expires_at', 'payment_claimed_at', 'stock_reserved')
ORDER BY 1;

-- Issuance policy presence (name varies by migration; adjust if renamed)
SELECT proname FROM pg_proc
WHERE proname ILIKE '%issuance%' OR proname ILIKE '%daily_claim%'
ORDER BY 1
LIMIT 40;

-- RLS still fail-closed on ledger tables (sample)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ghc_ledger', 'gh_marketplace_orders', 'ghc_membership_entitlements')
ORDER BY 1;

-- Stale payment claim recovery RPCs (Stage 2.1)
SELECT proname FROM pg_proc WHERE proname IN (
  'gh_marketplace_list_stale_payment_claims',
  'gh_marketplace_force_release_stale_payment_claim',
  'gh_marketplace_order_claim_payment',
  'gh_marketplace_order_release_payment_claim'
) ORDER BY 1;

-- Membership orphan recovery (Stage 2.2)
SELECT proname FROM pg_proc WHERE proname IN (
  'ghc_purchase_membership',
  'ghc_membership_complete_orphaned_purchase',
  'ghc_membership_list_orphan_purchase_candidates'
) ORDER BY 1;

-- Transfer pair recovery (Stage 2.3)
SELECT proname FROM pg_proc WHERE proname IN (
  'ghc_execute_transfer',
  'ghc_list_orphan_transfer_outs',
  'ghc_complete_orphan_transfer_in'
) ORDER BY 1;

-- Stages 3–5 economy foundation
SELECT proname FROM pg_proc WHERE proname IN (
  'ghc_referral_ensure_code',
  'ghc_referral_attribute',
  'ghc_referral_queue_reward',
  'ghc_settle_referral_reward',
  'ghc_curation_redistribute'
) ORDER BY 1;

# Phase 2 — Source-level architecture reconciliation

Date: 2026-10-18
Version: GH-CONNECT 0.61.1
Status: source review completed; live Testnet reconciliation blocked pending operator connection and access.

## Reviewed paths

- `app/api/economy/rewards/daily/route.ts`
- `lib/server/economy/db.ts`
- `supabase/migrations/202609030002_economy_v12_atomic_daily_claim.sql`
- `supabase/migrations/20260822_ghc_account_and_claim.sql`
- `supabase/migrations/202610150003_ghc_wallet_snapshot_spendable.sql`
- `lib/server/economy/store.ts`
- `components/ghc/daily-reward-experience.tsx`
- `lib/server/economy/emission-registry.ts`
- `supabase/migrations/202610180001_ghc_curation_rewards.sql`

## Findings

1. The previous `ghc_execute_daily_claim_v12` inserted the user's earned row with `status='posted'`, making it immediately available under the posted-ledger balance model.
2. A generic `ghc_claim_pending` RPC already existed and converts pending records to posted records. It did not enforce a Daily Claim-specific 48-hour lock.
3. The wallet snapshot sums pending and posted rows separately, and the spendable balance is derived from the posted ledger; this supports representing Daily Claim as a pending entitlement.
4. The Daily Claim UI described the reward as credited/added and hydrated the wallet after claim. It needed to explain the lock and not treat the pending amount as an immediate balance increase.
5. The emission registry and curation migration show other potential issuance paths. A global “Daily Claim is the only issuance source” policy is not yet enforced by this phase and must be addressed in Phase 6 with a complete path inventory and a compatibility plan for existing pending rewards.
6. Repository migration inventory contains 87 SQL files, including 10 dated after 2026-10-18. File presence/order does not prove applied status.

## Phase 3 candidate changes

The accompanying Phase 3 migration and source changes implement a pending Daily Claim entitlement, a 48-hour database-side redemption lock, idempotent redemption handling, API lifecycle metadata, fail-closed behavior when the new RPC contract is not present, and UI copy showing the redeemable time.

## Not verified

- Live Testnet schema, migration ledger, RLS, grants or RPC definitions.
- PostgreSQL execution of the new migration.
- Real multi-user or concurrent redemption against Supabase.
- Full `npm ci`, TypeScript, ESLint and Next.js production build. The dependency installation attempt timed out before tool binaries were available.
- Global sole-issuance enforcement, GreenHaven ID transfers across multiple applications, and production deployment.

## Required operator gate

Before applying the migration, back up Testnet, reconcile the live migration ledger and schema, review future-dated migrations, inspect duplicate pending Daily Claim references, then apply only through the approved Testnet workflow. Do not apply to Mainnet from this archive.

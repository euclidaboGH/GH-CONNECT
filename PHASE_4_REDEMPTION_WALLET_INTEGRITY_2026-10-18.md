# Phase 4 — Redemption and wallet integrity

Date: 2026-10-18  
Project: GH-CONNECT 0.61.1  
Status: **Source-level verification strengthened; live Testnet proof pending**

## Scope reviewed

- `supabase/migrations/202610180008_daily_claim_48h_lock.sql`
- `supabase/migrations/202610150003_ghc_wallet_snapshot_spendable.sql`
- `supabase/migrations/20261009_ghc_balance_lock_and_spendable.sql`
- `app/api/economy/rewards/claim/route.ts`
- `app/api/economy/wallet/[userId]/route.ts`
- `lib/server/economy/db.ts`
- `lib/server/economy/store.ts`
- `scripts/test-daily-claim-wallet-pipeline.mjs`

## Verified in source

1. Daily Claim redemption takes a row lock before examining and changing the pending entitlement.
2. A Daily Claim cannot be redeemed before the database-derived `created_at + interval '48 hours'` boundary.
3. Successful redemption expires the pending entitlement and inserts one posted `earned` credit inside the same PostgreSQL RPC transaction.
4. Retries by the original Daily Claim hold ID resolve the existing posted credit; retries by the claim reference also resolve the existing posted credit.
5. The redemption RPC is revoked from `PUBLIC` and granted to `service_role` only.
6. The wallet snapshot sums posted rows for ledger balance, reports pending rows separately, and derives available balance from `ghc_spendable_balance`.
7. Spend authorization also calls the shared spendable-balance function, which subtracts open withdrawal reservations.
8. The wallet API prefers the full durable snapshot; after a successful database redemption the claim API requests a fresh snapshot.
9. The claim API uses server-returned transaction ID and amount, preserves idempotent status, and returns HTTP 409 for early redemption.
10. Client wallet synchronization remains server-hydrated rather than optimistically increasing the displayed balance.

## Regression checks

- `node scripts/test-daily-claim-redemption-wallet.mjs` — 22/22 passed.
- `node scripts/test-daily-claim-48h-lock.mjs` — 13/13 passed.
- `node scripts/test-daily-claim-wallet-pipeline.mjs` — 35/35 passed.
- `node scripts/test-economy-v12.mjs` — 173/173 passed.

These checks inspect source and contracts. They do **not** execute PostgreSQL, prove the live schema matches the repository, or simulate actual multi-instance concurrent RPC requests.

## Required Testnet acceptance run

Run only after the operator confirms the live migration history and schema. Use a disposable test account and record transaction IDs for each assertion:

1. Take a restorable Testnet database backup and inspect existing migration history; do not bulk-apply future-dated migrations.
2. Apply the reviewed 48-hour migration only through the approved migration workflow, after resolving any duplicate pending daily-claim references without rewriting posted history.
3. Claim at T0. Verify the user entitlement is `pending`, `posted_at` is null, `redeemableAt` is T0 + 48 hours, and available wallet balance is unchanged. The protocol reserve leg is separate and must not appear in the user's spendable balance.
4. Attempt redemption before the boundary. Expect HTTP 409 / `NOT_YET_REDEEMABLE`; verify no ledger rows changed.
5. Attempt redemption at or after the boundary. Verify exactly one posted user credit, original entitlement marked `expired`, pending balance reduced, and available wallet balance increased by the entitlement amount.
6. Retry using the original pending transaction ID and the original claim reference. Both must return the same posted credit without increasing the balance again.
7. Submit concurrent redemption requests from separate app instances. Exactly one posted user credit must exist.
8. Confirm the new balance is visible from a separate application instance and is accepted consistently by spend and transfer authorization; pending entitlements must remain non-spendable.
9. Run typecheck, lint, complete CI, and a clean Vercel Preview build before merging.

## Explicit limitations

- No Testnet database connection or credentials were available for this phase; no SQL was applied.
- Full TypeScript, ESLint, Next.js production build, and Vercel Preview verification remain outstanding because `node_modules/.bin/tsc` and `node_modules/.bin/next` are absent in this working environment.
- No GitHub push, deployment, or Mainnet operation was performed.
- GreenHaven ID cross-system transfers remain Phase 5. Global sole-issuance enforcement (Daily Claim as the only source of new GHC) remains Phase 6 and is not claimed complete.

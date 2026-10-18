# Release gate — GH-CONNECT 0.61.1 Phase 6 candidate

**Status: NOT CLEARED TO PUSH OR DEPLOY.** This is a source candidate implementing the Daily-Claim-only GHC issuance policy. Static source tests pass; PostgreSQL runtime validation, live Testnet reconciliation, clean dependency install, TypeScript, lint, and production build are still outstanding.

## Phase 6 changes

- Generic activity/achievement/referral reward evaluation is disabled at the HTTP and domain layers.
- Manual/admin and purchase credits are disabled.
- Generic local reward evaluation, pending staging, and pending-reward redemption are disabled.
- Curation voting remains available, but the GHC reward side effect is disabled; the UI labels the percentage control as curation vote weight rather than a GHC reward.
- `supabase/migrations/202610180009_ghc_daily_claim_only_issuance.sql` adds a database trigger to allow only the Daily Claim 48-hour entitlement and redemption, the internal protocol reserve leg, and transfer-in entries backed by a matching posted transfer-out.
- The migration preserves historical ledger rows and does not rewrite balances. Historical non-Daily-Claim pending entitlements need operator disposition before the migration is approved.

## Source-level checks

- 83 `scripts/test-*.mjs` regression scripts passed after Phase 6 updates.
- New Daily-Claim-only issuance policy assertions: 31/31 passed.
- Release hygiene: 10/10.
- Production safety scan: 21/21.
- Migration readiness scan is static only and warns about future-dated migrations.

## Mandatory before Testnet rollout

1. Extract the archive so `app/` is at the repository root.
2. Use the supported Node runtime from `.nvmrc`; run `npm ci --legacy-peer-deps`.
3. Run `npm run typecheck`, `npm run lint`, `npm run ci:verify`, and `npm run build`.
4. Reconcile Testnet migration history and schema. Review every `REVIEW_REQUIRED` migration in `VERIFIED_MANIFEST.txt`; do not blindly apply the full directory or both migration sets.
5. Apply the new issuance guard to a disposable Testnet project first. Test Daily Claim pending insertion, early redemption, redemption at/after 48 hours, duplicate/replayed redemption, and concurrent redemption.
6. Prove activity staging, curation reward credit, admin credit, purchase credit, and direct positive ledger writes are blocked. Prove curation votes still succeed without GHC rewards.
7. Prove GreenHaven ID direct transfers and transfer-request acceptance conserve balances, reject self-transfer/insufficient funds, and remain idempotent under replay and concurrency.
8. Capture SQL migration output and two-account Testnet evidence before considering Preview rollout. Mainnet requires separate explicit approval.

## Verification limits

- Dependencies are not installed in this workspace; `tsc` and `next` binaries are unavailable. TypeScript, ESLint, and Next.js production build are not verified.
- PostgreSQL parser/runtime and live Supabase connection were unavailable. The Phase 6 SQL has not been applied or executed.
- No GitHub push, Vercel deployment, Testnet transaction, or Mainnet operation was performed.

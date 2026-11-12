# Upgrade Worklog — 0.323.0

## Phase 8 Rewards source completion

- Implemented a service-role-only PostgreSQL verifier for seven mission types: active community membership, first non-deleted post, first non-deleted comment on a live post, meaningful contribution (a live post or comment), completed canonical profile, sent connection request and accepted incoming connection.
- Mission verification reads durable source records inside one SQL function, serializes per-user/per-mission claims with an advisory transaction lock and relies on the existing unique achievement index as the final idempotency fence.
- Mission route now uses verified server identity, durable fail-closed rate limiting, bounded request parsing, a fixed allowlist and the canonical server RPC. Client metadata is ignored.
- Verified missions unlock non-financial achievements only. The API returns zero GHC; generic activity issuance remains disabled by the existing issuance policy and database guard.
- Existing Rewards Home, daily claims, cross-device claim status, account-scoped economy snapshots, authenticated GHC ledger history/search/status filters and Pi cashback separation remain intact.
- Added the 0.323.0 mission contract and updated release gate, roadmap, project truth, migration inventory and documentation hygiene.
- Added additive migration `20261106170001_phase8_verified_mission_achievements.sql`, classified REVIEW_REQUIRED. It was not applied.

## Verification boundaries

- This is source-level, source-only evidence; it is not live-system acceptance.
- Source contracts are run with the available Node runtime and recorded in the release report.
- Node.js 24.15.0 (or compatible Node 24) TypeScript, ESLint and Next.js production build must still run in the supported environment.
- Disposable PostgreSQL/Testnet validation must cover each positive and negative proof case, duplicate/concurrent requests, service-role ACLs, RLS behavior and migration replay safety.
- Browser/device accessibility, responsive layout, performance and cross-device multi-user tests remain required.
- No live database migration, GHC issuance, Pi cashback payout, Pi Testnet/Mainnet operation or production deployment was performed.

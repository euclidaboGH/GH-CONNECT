# Upgrade Worklog — GreenHaven 0.330.40

## Priority 10.2 — Shared filter state and server parity

- Started from 0.330.39; retained existing product architecture and financial/security authorities.
- Added validated shared filter contract, per-account preference hook, and accessible shared result-state component.
- Added account-scoped filter preferences to Communities, Rewards history, Activity Center and Marketplace browse.
- Added inclusive UTC date bounds to authenticated server-side wallet history while preserving keyset pagination and same-user authorization.
- Added Postgres/PostgREST-side Marketplace query/category/kind/currency-specific price/date filtering before bounded pagination; GHC and PI price ranges are never compared as one numeric scale and the API rejects price ranges without an explicit currency; delivery remains a client refinement on returned rows because the stored delivery field is not normalized.
- Added public Community search RPC and API query contract with bounded pagination and a directory load-more control; Marketplace browse also appends server-filtered pages by offset. Migration is REVIEW_REQUIRED and unapplied; API/client explicitly falls back to a bounded directory when the migration is not deployed.
- Added date/price inputs, active-filter chips and consistent empty/error/no-results messaging where applicable.
- Audited legacy Discovery FilterPanel references: no mounted screen consumer; removed component and both public exports.
- Added 28 runtime assertions and 34 integration source contracts; registered in prebuild and verify:static.
- Updated migration inventory to 196 SQL files (118 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 75 REVIEW_REQUIRED).

## Verification boundary

This is source-only verification; it does not prove production runtime behavior.

The focused Phase 10.2 tests pass. Static/source checks do not establish PostgreSQL function validity, PostgREST query execution, live migration state, Node.js 24.15.0 typecheck/lint/build, browser/device accessibility or production readiness. The Community migration is held for disposable PostgreSQL and independent Testnet/Mainnet reconciliation. Production remains NOT APPROVED.

# Upgrade worklog — 0.190.0

## Phase 7 scope
Financial operations and treasury visibility, deliberately distinct from existing Phase 7 A2U orchestration and social-experience work already present in the repository.

## Audit findings
- Existing code already contains the append-only company revenue journal, PI cashback quarterly reconciliation, marketplace payout routes, general earnings payout lifecycle, and A2U exception queue. Duplicating these ledgers would increase accounting risk.
- The current admin revenue summary is a policy/catalog response rather than a consolidated operational snapshot.
- Existing cashback reconciliation and A2U exception functions provide authoritative read paths that can be composed without inventing a second source of truth.
- Seller payables, general earnings reservations, bank settlement and GHC utility totals do not yet have one verified common aggregate in the reviewed route contract, so they must remain explicitly out of scope in this snapshot.

## Changes
- Added operator-only `GET /api/admin/treasury/summary`.
- Added bounded UTC reporting-window validation and current-quarter defaults.
- Composed authoritative cashback reconciliation with A2U review/stuck-job visibility.
- Added explicit coverage declarations, PI/GHC segregation, no-store headers, 32-byte operator-key minimum and timing-safe comparison.
- Added 11 static source-contract checks and integrated them into the full static verification and prebuild gates.
- Bumped source version to 0.190.0.

## Verification limitations
This is source-only verification. Static checks do not prove database RPC availability, PostgreSQL transaction behavior, operator-secret deployment, Pi Testnet settlement, seller payable reconciliation, GHC reporting, browser UI or production readiness. No migration was added or applied. The current container runtime is Node 22 while the project requires Node.js 24.15.0; therefore supported-runtime typecheck, lint and Next.js production build are not claimed.

## Final source verification results
- `npm run verify:static` — PASS, 57/57 suites.
- Phase 7 treasury contract — PASS, 11/11 checks.
- Release hygiene — PASS, 11/11.
- Project truth — PASS, 10/10.
- JSX safety — PASS, 858 files scanned.
- Migration inventory — synchronized, 160 SQL files; no new migration.
- Node runtime gate — BLOCKED as expected in this container: Node v22.16.0; project requires Node.js ^24.15.0. No dependencies are installed, so TypeScript, ESLint and Next.js production build were not run.

# Upgrade worklog — 0.191.0

## Phase 7 treasury operations completion increment
- Reviewed the existing company revenue journal, seller payout request/allocation model, PI earnings payout request lifecycle, cashback entitlement/A2U tables, creator-tip settlement table, and A2U operator review queue before extending the system.
- Added migration `20261030010008_phase7_treasury_reporting_and_case_history.sql` with a service-role-only, read-only aggregate RPC and durable operator case/event tables.
- Added a source-backed report adapter, operator-protected report/case APIs, and `/admin/treasury` dashboard.
- Integrated financial report and case availability into `/api/admin/treasury/summary`; missing sources degrade the status rather than appearing as zero.
- Reporting keeps revenue currencies and seller PI/GHC obligations separate; PI earnings expose gross/fee/net; cashback distinguishes calculated/review/reserved/paid/outstanding; creator tips remain payable until independently paid.
- Operator cases retain notes and status history without changing any source payment, ledger, entitlement, or reservation state.

## Validation
- Verification performed is source-level and network/database independent.
- Phase 7 source-contract checks: run with `node scripts/check-phase7-treasury-operations.mjs` and `node scripts/check-phase7-treasury-completion.mjs`.
- Full static verification is being rerun after synchronizing migration inventory, release docs, and historical acceptance references.
- Node runtime in the container is Node 22.16.0; project requires Node.js 24.15.0 or later. No dependency installation, TypeScript, ESLint, Next production build, or browser test is claimed.
- No disposable PostgreSQL instance or Testnet database was available. Migration remains REVIEW_REQUIRED and unapplied. No live Pi payment, payout, ledger mutation, or deployment was performed.
- Required before Testnet: clean migration replay, exact aggregate-vs-source-row reconciliation, RPC ACL/RLS tests, concurrent case upserts and payout/report reads, rollback/recovery tests, then authenticated Testnet and browser E2E.
- Final source checks: full `npm run verify:static` passed (57/57 consolidated checks plus all invoked child contracts); Phase 7 treasury completion contract passed 16/16; release hygiene 11/11; project truth 10/10; database source contract 129 tables / 161 migrations; JSX safety 862 files; migration inventory synchronized.
- During the whole-system pass, an existing malformed conditional in `components/ghc/unified-earnings-dashboard.tsx` was corrected. A local global `tsc` invocation then proceeded beyond that syntax error but could not complete because dependencies and React/Node type packages are not installed in this environment; no clean typecheck is claimed.

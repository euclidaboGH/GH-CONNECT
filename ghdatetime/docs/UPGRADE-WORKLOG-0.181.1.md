# GH Connect upgrade worklog — 0.181.1

## Phase 3 completion hardening
- Audited the PI earnings dashboard rendering and quote action.
- Corrected atomic-unit formatting so numeric and string ledger values follow the same atomic scale.
- Replaced invalid-value fallback of `0 π` with `Unavailable`, avoiding a misleading financial display.
- Required server-confirmed payout eligibility and linked Pi identity before quoting, both in the handler and button state.
- Kept PI/GHC ledgers separate and did not add client-side financial authority.

## Verification boundaries
Source-level regression checks are not equivalent to a supported-runtime build or live settlement. Node 24 typecheck/lint/build, browser acceptance, disposable-database migration/ledger tests, and Testnet payout/recovery proof remain required before Phase 4 is treated as release-ready. No live database mutation or deployment was performed.

Runtime limitation: source-level checks were run in the available Node.js 22 environment; the project requires Node.js 24.15.0. A supported-runtime typecheck, lint, and production build are still required.

## Completed checks
- `npm run verify:static`: 56/56 passed after synchronizing current release baseline docs.
- Earnings dashboard contract: 13/13 passed.
- Unified wallet contract: 13/13 passed.
- Payment recovery contract: 10/10 passed.
- Reconciliation efficiency contract: 14/14 passed.
- JSX safety: 855 files scanned, passed.
- Runtime gate correctly refused Node.js v22.16.0 because the repository pins Node.js 24.15.0; no dependency installation, TypeScript, lint, or Next.js build was attempted under the unsupported runtime.

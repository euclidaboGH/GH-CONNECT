# Upgrade worklog — 0.315.8

## Phase 3 — Marketplace premium upgrade

Detailed scope and release boundaries: `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`.

### Source changes
- Added marketplace product/service/opportunity and delivery-mode filters, preserving category and text search.
- Added a single clear-filters action for combined browse filters.
- Added seller-centre inventory metrics for active, paused and sold-out listings, plus open/attention/completed order counts; loading data is shown as unknown rather than a misleading zero.
- Added seller inventory filters for all, active, paused, sold-out and draft listings, with accessible pressed states and a clear empty-filter recovery action.
- Browse empty states now account for every active facet and result counts are announced accessibly.
- Corrected price sorting so GHC and PI remain separate currency groups; nominal amounts from different assets are never compared.
- Improved listing cards with a clearer title/price hierarchy, condition and low-stock cues, correct sold-out presentation for zero-stock products, keyboard focus and reduced-motion behavior.
- Removed the obsolete browser-local listing-report queue and its misleading moderation-success copy.
- Added authenticated, bounded marketplace report intake with fail-closed durable rate limiting, server-derived reporter identity, self-report rejection and idempotent per-user/listing submission.
- Added a protected operator report queue and status-transition API. Terminal reports cannot be reopened; review status is persisted through a service-role-only RPC.
- Added migration `20261106150001_marketplace_listing_report_intake.sql`; it is REVIEW_REQUIRED and has not been applied.
- Preserved listing fees, GHC/Pi payment separation, order lifecycle, inventory reservations, escrow, refunds, seller proceeds and payout authority.

### Verification actually run

All checks below are source-only verification; they do not prove live database or production behavior.

- `check-phase3-marketplace-premium.mjs`: 25/25 PASS.
- `test-phase3-marketplace-sort.mjs`: 3 cases PASS.
- `check-phase-c-marketplace-trust.mjs`: 13/13 PASS.
- `check-phase-b-marketplace-commerce.mjs`: 9/9 PASS.
- `check-marketplace-cart-upgrade.mjs`: 9/9 PASS.
- Pass 41 marketplace resilience: 12/12 PASS.
- Pass 42 marketplace domain boundary: 14/14 PASS.
- Pass 42 runtime record-mapper tests: 16 assertions PASS.
- Migration inventory: 186 files; 117 REQUIRED candidates, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 66 REVIEW_REQUIRED; duplicate version prefixes 0.
- Repository consistency: 6/6 PASS; all 1,273 source files import-scanned with zero unresolved local imports.

`npm run verify:static` was rerun after synchronizing the 0.315.8 release fixtures and passed. `npm run prebuild` was also attempted; it reaches the pinned-runtime gate and stops because this container has Node.js 22.16.0 instead of the required Node.js 24.15.0. It is not a successful production prebuild.

### Outstanding gates

- Node.js 22.16.0 is available; the project requires Node.js 24.15.0. No installed dependencies. TypeScript, ESLint and production build are not claimed.
- Disposable PostgreSQL execution of the report migration, function ACLs, RLS and duplicate/self-report cases is pending.
- Testnet/Mainnet migration histories must be reconciled independently; no migration has been applied.
- Operator report queue acceptance, browser/mobile UX, accessibility and real marketplace listing/report flows remain to be tested.
- Phase 1 and Phase 2 runtime/database acceptance gates remain open.
- No payment, wallet, GHC, Pi, inventory, order settlement or payout state was mutated.

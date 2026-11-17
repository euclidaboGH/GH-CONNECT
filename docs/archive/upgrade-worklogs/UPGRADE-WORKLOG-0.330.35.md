# Upgrade worklog — 0.330.35

## Scope

Priority 9 — Marketplace product transformation, first commerce-integrity increment, based on the user's authoritative 0.330.34 archive.

## Audit findings and changes

- Marketplace already had durable listings/orders, atomic inventory reservation, idempotent order creation, separate GHC/Pi payment authorities, seller centre, saved listings, reports, cart normalization, order lifecycle, proceeds, event journal and payout adjustment controls.
- Corrected checkout routing to use the currency on the server-created order rather than stale listing/cart snapshots. Unsupported or missing order currency prevents payment.
- Replaced minute-bucket single-item checkout idempotency with a fresh per-intent key retained when the create response is uncertain.
- Changed missing listing availability from an invented unit to zero; explicit zero is preserved.
- Added an explicit seller stock quantity control, strict integer bounds (0–9,999), and edit preservation.
- Server listing writes now preserve existing stock when availability is omitted and reject coercion/fraction/out-of-range input.
- Persisted delivery instructions in existing listing JSON metadata and projected them back through the API.
- Added `scripts/check-phase9-marketplace-transformation.mjs` and `scripts/test-phase9-marketplace-contracts.mjs`; registered both in `prebuild` and `verify:static`.

## Verification

- Phase 9 Marketplace static contract: 20/20 PASS.
- Phase 9 Marketplace runtime contract: 16/16 PASS using Node's experimental TypeScript stripping support.
- Existing Phase 3 Marketplace premium contract: 25/25 PASS.
- Existing Phase 4 cart static contract: 10/10 PASS.
- Existing Marketplace cart upgrade contract: 9/9 PASS.
- Existing Phase C trust contract: 13/13 PASS.
- Existing Pass 41 Marketplace resilience: 12/12 PASS.
- Existing Pass 42 Marketplace domain boundary: 14/14 PASS.
- Existing Phase 10 marketplace integrity: 30/30 PASS.
- Existing Phase 18 payment binding: 17/17 PASS.
- Existing Phase 19 RPC transport: 12/12 PASS.
- Existing Phase 20 net proceeds: 11/11 PASS.
- Existing Phase 21 event journal: 9/9 PASS.
- Existing Phase 22 adjustments and atomic transition gates PASS.
- Existing Phase 23 migration integrity PASS (193 canonical migration files).

The first full `npm run verify:static` attempt exposed release-truth fixtures still pinned to 0.330.34 and the requirement for a current worklog; these are being reconciled as part of the release metadata rather than bypassing the checks.

## Verification limitations

The results above are source-only verification and isolated helper-contract evidence; they do not establish production readiness.

The available runtime is Node.js 22.16.0, while this project requires Node.js 24.15.0. `node_modules` is absent. Therefore dependency-backed TypeScript, ESLint, Next.js production build and browser E2E have not been completed. Live Supabase, PostgreSQL concurrency, Pi provider, Testnet, Mainnet and operator acceptance were not performed.

## Database and financial boundaries

No SQL migration was added or applied. No wallet balance, GHC ledger, Pi payment, order settlement, escrow, refund, seller payout or production data was mutated. Existing server/database authorities remain canonical.

**Production status: NOT APPROVED.**

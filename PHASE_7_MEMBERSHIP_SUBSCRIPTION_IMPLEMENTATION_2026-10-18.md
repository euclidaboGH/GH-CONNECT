# Phase 7 — Membership Subscription Lifecycle Candidate

Date: 2026-10-18
Project: GH-CONNECT 0.61.1
Status: Source candidate; live Testnet verification pending.

## Implemented in source

- VIP base price: 150 GHC per paid month.
- VVIP base price: 300 GHC per paid month.
- Supported paid durations: 1, 4, 8 and 12 months.
- GHC discounts: 0%, 5%, 10% and 20% respectively, applied to paid months only.
- Every plan grants one bonus calendar month, so access durations are 2, 5, 9 and 13 calendar months.
- The UI exposes all four durations and shows the discount and total access duration before confirmation.
- The server independently derives the GHC price from the canonical pricing helper; client-provided prices are not trusted.
- The membership activation API accepts only the supported duration values.
- Entitlement expiry uses calendar-month arithmetic with end-of-month clamping rather than a 30-day approximation.
- Added `202610180010_atomic_membership_purchase.sql`: one transaction calls the existing spend RPC and then persists the matching membership entitlement. If entitlement persistence raises an error, the debit is rolled back. Replayed committed purchase references return the existing entitlement without spending again. An orphaned pre-existing debit is rejected for reconciliation rather than being turned into a new entitlement.
- GHC purchase references use unique purchase-attempt IDs so the same fixed tier/period reference is not permanently reused across future purchases.

## Pi pricing and fulfillment

- VIP monthly Pi base: 1.5 π; VVIP monthly Pi base: 3 π.
- Pi uses the same paid-duration discounts as GHC: 0% (1 month), 5% (4 months), 10% (8 months), and 20% (12 months).
- Both tiers have durable GH Pay catalog products for all four durations; every package grants one bonus calendar month.
- Calculated Pi charges: VIP 1.5 / 5.7 / 10.8 / 14.4 π; VVIP 3 / 11.4 / 21.6 / 28.8 π for 1 / 4 / 8 / 12 paid months.
- Pi amounts are a separate product price rail. They do not establish a public exchange rate or a right to redeem GHC for Pi.
- Payment fulfillment and recovery preserve `monthly`, `four_months`, `eight_months`, and `yearly` exactly; do not silently collapse a four- or eight-month payment to monthly or yearly. A source review found and corrected a fulfillment mapping that previously accepted only monthly/yearly periods.
- The GH Pay surface lists all eight VIP/VVIP duration products as well as the other Pi products, and the premium membership confirmation offers both Pi and GHC for each duration.

## Verification performed

- Updated `scripts/test-membership-pricing.mjs` to assert all eight Pi products are active, the four-duration Pi fulfillment mapping is preserved, and the generic GH Pay surface exposes 4- and 8-month plans.

- `scripts/test-membership-pricing.mjs`: passed, including 4-duration prices, discount schedule, bonus months, API duration validation, calendar expiry source checks, and atomic purchase RPC wiring.
- Daily Claim 48-hour lock: 14/14 passed.
- Daily-Claim-only issuance policy: 31/31 passed.
- GreenHaven ID transfers: 12/12 passed.
- Economy v1.2: 174/174 passed.
- Ten-phase baseline: 8/8 passed.
- Release hygiene: 10/10 passed.
- Vercel build-repair regression: 9/9 passed.
- TypeScript transpilation/syntax diagnostics passed for all modified TS/TSX files.
- Migration release-readiness static check passed with warnings for 10 pre-existing future-dated migrations; the new migration file itself is dated 2026-10-18.

## Mandatory before release

- Run the full project typecheck, ESLint and Next.js production build after a clean dependency install.
- Apply and test the migration only in a disposable/authorized Testnet after comparing live migration history.
- Test insufficient funds, transaction rollback on entitlement write failure, concurrent purchase requests, replay, and post-commit response loss.
- Verify bonus expiry against actual database timestamps and client status rendering.
- Review whether membership renewals should extend from the current expiry; the current route intentionally prevents charging an already-active same-tier account to avoid accidental duplicate charges.
- No live database migration, Git push, Vercel deployment or Mainnet operation was performed during this phase.

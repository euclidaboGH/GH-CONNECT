# Phase 4 — GHC Utility Economy Transparency and Safety

**Status:** source-only implementation; not deployed. No database migration is added or applied in this phase.

## Implemented

- Added `GET /api/economy/policy`, a read-only public endpoint that returns the canonical economic version, daily-claim base schedule, utility boundaries, fixed server-owned spend catalog, and current withdrawal feature-gate state.
- Added `listPublicSpendCatalog()` as a projection of the same catalog used by spend authorization. The UI does not become a pricing authority.
- Integrated the policy into the GHC Wallet **About** tab: users can inspect current fixed prices and see explicit disclaimers that GHC is an in-app utility balance, not an investment or guaranteed cash value.
- The disclosure explains that daily claim figures are base gross values before scarcity controls and eligibility checks; it does not promise a payout amount.
- Pi-funded GHC acquisition remains unavailable because the pack catalog and durable credit settlement are not wired. The public policy does not represent a completed Pi-to-GHC conversion feature.
- GHC-to-Pi withdrawal disclosures reflect the existing fail-closed feature flag, without representing an enabled flag as guaranteed approval or settlement.
- Registered a regression gate in `ci:verify` and the policy was included in the `0.63.25` baseline with package, lockfile, and release metadata synchronized.

## Economic invariants preserved

- No change to `ECONOMY_VERSION 1.2`, claim amounts, scarcity curves, caps, membership pricing, boost pricing, transfer behavior, or ledger schema.
- No client minting and no client-authoritative price.
- GHC balances remain ledger-derived. Pending rewards remain non-spendable until validated/claimed.
- Pi payment intents and the GHC ledger remain separate authorities.
- Company revenue remains separate from GHC balances, transfers, rewards, seller proceeds, and pending obligations.
- No migration, external payment flow, Pi-to-GHC purchase, withdrawal settlement, or deployment was performed.

## Validation

Run `node scripts/test-phase4-ghc-utility-policy.mjs` for source-level invariants. This does not replace TypeScript, lint, production build, disposable-Postgres tests, or Testnet E2E validation. The earlier Phase 2/3 environment blocker still applies until dependencies are installed under the supported Node version with working npm registry access.

## Re-review hardening

- Confirmed the policy endpoint is read-only and exposes only the server-owned public policy projection.
- Confirmed the public spend catalog is projected from the same fixed catalog used by server-side spend authorization; the UI is not a pricing authority.
- Kept the feature-gate disclosures explicit: Pi-funded GHC acquisition remains unavailable and withdrawals remain disabled unless the server flag is explicitly enabled.
- Re-ran the phase-specific source invariants after the Phase 3 journal hardening; this does not imply a live database or provider flow has been tested.

## Next gate

1. Install dependencies using Node `24.15.0` and `npm ci --legacy-peer-deps`.
2. Run TypeScript, ESLint, Next.js production build and the complete regression suite.
3. Test policy rendering and the existing wallet actions on mobile/Pi Browser.
4. Proceed to the business monetization pilot only after Phase 3 revenue recording is connected atomically to approved settlement sources and its SQL/RLS/concurrency behavior is verified on disposable PostgreSQL.

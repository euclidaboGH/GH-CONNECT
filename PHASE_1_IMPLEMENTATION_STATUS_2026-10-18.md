# Phase 1 implementation status — 2026-10-18

## Source changes made in this candidate

1. Fixed the `enhanced-post-card.tsx` React handler type mismatch by wrapping mouse/touch starts and explicitly supplying the intended `positive` reaction kind. React's `MouseEvent` is no longer passed into a callback parameter that expects a reaction literal.
2. Reworked the reward-ready notice effect in `enhanced-feed-screen.tsx` to reference the exact status fields it uses and align the dependency array with those fields.
3. Added `scripts/test-10-phase-baseline.mjs` and wired it into `ci:verify` to guard the build repair and key existing server-side GHC route contracts.
4. Added `GH_CONNECT_10_PHASE_GLOBAL_BETA_PROGRAMME.md`, which defines the 10 phases, release gates, and the requested GHC invariants.

## Checks executed in this workspace

- New baseline regression: 8/8 passed.
- Existing Vercel build repair regression: 9/9 passed.
- Daily claim → wallet pipeline regression: 35/35 passed.
- Release-gates policy regression: 9/9 passed.

These are source/static regression checks. They do not prove live database behavior.

## Build verification status

A clean `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund` did not finish within the available execution window; the Next.js and TypeScript binaries were not installed. Therefore `npm run typecheck`, `npm run lint`, and `npm run build` could not be truthfully marked as passed here. CI must run them with a complete dependency install.

## Important GHC implementation gap

The source currently calls `ghc_execute_daily_claim_v12` for the daily claim and `ghc_claim_pending` for redemption. The current daily-claim SQL posts the user amount directly as an earned ledger row. The new 48-hour lock and the single-issuance rule are not yet implemented in SQL by this Phase 1 candidate. Do not deploy this candidate expecting those new rules to be active.

Phase 3–6 of the programme must implement the delayed entitlement, atomic redemption, shared GreenHaven ID transfer contract, and disable all non-Daily-Claim issuance paths with reviewed migrations and tests. This needs an additive migration and Testnet validation; it must not be simulated in the UI.

## No remote actions

No GitHub commit/push, Vercel deployment, Supabase migration, live account change, Pi payment test, or Mainnet action was performed.

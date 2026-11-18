# Phase 8 — Rewards Integrity and Experience (0.321.0)

## Scope of this increment

This is the opening Phase 8 source increment. It hardens the existing Rewards Centre and daily-claim experience without creating a parallel rewards engine, new ledger, new claim endpoint or new financial authority.

### Implemented

- Rewards Centre economy snapshot reads now use an eight-second timeout and `AbortController`; the request is cancelled on unmount or dependency change.
- The displayed snapshot is cleared when the authenticated profile identity changes, preventing one account's confirmed values from carrying into another account's view.
- Snapshot amounts accept only finite, non-negative numeric values. `null`, empty strings, malformed strings, negative values and infinities remain unknown rather than becoming a false zero.
- The Rewards Centre requires explicit server success and checks an optional returned user identity before accepting the response.
- The balance summary communicates whether a server snapshot is confirmed, loading, refreshing or unavailable. Refresh failures retain the last confirmed snapshot only within the same account session.
- Daily claim client parsing accepts a display amount only when the server reports a finite, non-negative value.
- Daily claim success messages no longer substitute locally predicted streak amounts for a missing server amount.
- A failed daily claim no longer flashes a success/claimed state.

## Financial and security invariants

- The daily claim remains a server-authoritative, idempotent POST to `/api/economy/rewards/daily`.
- The browser never supplies the reward amount and never mints, settles, transfers or credits GHC.
- A successful claim with a missing or malformed amount can still be reported as server-confirmed, but the UI does not invent the credited amount; it directs the user to the refreshed Wallet snapshot.
- GHC and Pi remain separate assets and ledgers. Pi cashback and payout authorization remain in their existing server-controlled flows.
- No SQL migration was added, changed or applied.

## Verification

`node scripts/check-phase8-rewards-entry.mjs` is the dedicated source contract (18/18 passed). It is registered once in `prebuild` and `verify:static`. The consolidated static suite passes 57/57; Wallet entry contract 14/14, repository consistency 6/6, project truth 10/10 and documentation hygiene also pass.

Source checks do not establish production readiness. Supported Node 24.15.x typecheck/lint/production build, browser/device accessibility and performance testing, live Supabase/RLS validation, Testnet reconciliation and operator approval remain separate acceptance gates.

## Next Phase 8 work

1. Premium Rewards home and personalized journey.
2. Daily claim/streak reliability and cross-device reconciliation.
3. Verified missions, achievements, referrals and campaigns.
4. Transparent reward history, maturity and cashback lifecycle.
5. Abuse resistance, reconciliation, performance and final release gate.

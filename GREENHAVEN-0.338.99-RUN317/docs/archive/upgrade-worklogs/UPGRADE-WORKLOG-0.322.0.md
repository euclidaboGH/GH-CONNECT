# Upgrade Worklog — 0.322.0

## Phase 8 Rewards increment

- Added authenticated cross-device GHC ledger-history hydration from the same-user wallet endpoint.
- Added bounded request lifecycle, abort on account switch/unmount, account-scoped clearing, strict transaction validation, newest-first ordering, search and status filters.
- Clearly separated authoritative server ledger history from supplemental local reward-domain records.
- Cleared prior-account achievement state immediately before durable achievement rehydration.
- Preserved daily claim cross-device reconciliation via the existing status coordinator (focus, online, visibility and periodic refresh).
- Kept mission rewards fail-closed because server-side durable verification and atomic one-time claim storage are not available in the current source.
- Bumped package, lockfile and app release metadata to 0.322.0.
- Added the Rewards ledger-history contract (20/20) and Rewards source release gate (12/12) to `prebuild` and `verify:static`.

## Safety

No client-side GHC minting, credit, transfer, settlement, cashback payout or Pi authority was added. GHC and Pi remain separate. No migration was added, modified or applied.

## Verification limits

Node.js 24.15.0 (or compatible Node 24) and installed dependencies are required for valid typecheck, lint and production build. Browser/device, accessibility/performance, live Supabase/RLS, Pi Testnet reconciliation and independent operator acceptance were not run in this source-only environment.

# GH-CONNECT Wallet Refresh Stability Hotfix — 2026-11-01

## Source baseline

This hotfix is layered on the Phase 4 Marketplace & Cart archive built from GH-CONNECT `0.274.3`. It preserves the Phase 1–4 changes and does not add or apply a database migration.

## Reported behavior

Two Android/Pi Browser recordings show the wallet repeatedly switching the PI balance card between a loaded amount and `Loading ledger…`, while the portfolio status repeatedly moves through `Syncing…` / `Live`. The PI earnings panel also returns to skeleton placeholders. GHC balance data remains visible and the user can open wallet actions and transaction history.

## Code-level causes addressed

1. `features/wallet/wallet-balance.tsx` set the PI card's initial-loading flag on every refresh event, aborted an existing PI request when another event arrived, and cleared the displayed snapshot on transient read errors. A burst of `ghc:wallet-refresh`, `ghc:earnings-refresh`, and `ghc:wallet-synced` events could therefore make already-known data disappear and reappear.
2. `components/ghc/unified-earnings-dashboard.tsx` always set its loading state on refresh and cleared its snapshot on a failed withdrawable-ledger read. The dashboard could fall back to a skeleton/error panel even when it had a previously verified snapshot.

## Changes

- Coalesce overlapping PI balance reads rather than aborting a healthy in-flight read for each event.
- Separate initial loading from background refreshing. The displayed balance stays in place during background refresh.
- Preserve the last server-verified PI snapshot after a transient failure and clearly label it as last verified; never replace it with a fabricated zero.
- Disable the manual refresh action while the initial or background request is active.
- Coalesce earnings-dashboard refresh bursts and preserve the last verified snapshot and statement entries when a read fails.
- Show an explicit stale-snapshot warning if a background earnings refresh fails, while keeping the previously verified dashboard visible.
- Add `scripts/check-wallet-refresh-stability.mjs` to `prebuild` and `verify:static`.

## Verification

- `npm run verify:static`: **passed** (exit 0).
- `node scripts/check-unified-wallet-card.mjs`: **15/15 passed**.
- `node scripts/check-wallet-refresh-stability.mjs`: **10/10 passed**.
- `node scripts/check-phase8-earnings-dashboard.mjs`: **13/13 passed**.
- Existing marketplace checkout integrity checks: **16/16 passed**.
- Existing Phase 3 story integrity checks: **20/20 passed**.

## Remaining release gates

This source-only hotfix has not been tested in a live Pi Browser session against the deployed API. The environment's Node version is below the project's declared Node 24.15.0 target and dependencies are not installed, so the production Next.js build and TypeScript compiler have not been run here. Validate the archive under Node 24.15.0, then deploy to Preview/Testnet and confirm the PI snapshot remains stable across refresh events, tab changes, transient network failure, and recovery. No database migrations or payments were executed.

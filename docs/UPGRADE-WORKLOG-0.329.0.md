# GH-CONNECT 0.329.0 — Phase 10 resilience and media efficiency

## Scope
This increment follows 0.328.0 and focuses on privacy-safe offline behavior and adaptive media loading.

## Changes
- Replaced broad same-origin service-worker caching with a strict public-static allowlist.
- Kept all `/api/` traffic network-only, including authenticated feed, account, messaging, wallet, payment and private-media endpoints.
- Removed navigation/document caching and the cached `/` fallback, preventing personalized HTML/RSC data from being replayed across sessions.
- Added response checks against private/no-store/no-cache and `Vary: *` caching.
- Feed media-facade prefetch now observes Data Saver, constrained connections, local reduced-data preference, visibility and online state; it rechecks immediately before work and caps at four URLs.
- Story image prefetch now follows the same policy, is idle-scheduled and capped at three URLs.
- Reconnect banner clears its online timer when the component unmounts.
- Discovery candidate cards defer offscreen layout and paint with `content-visibility: auto` and a conservative intrinsic size, reducing initial work without removing content from the accessibility tree.
- Added 17 static resilience assertions and 11 executable service-worker policy tests.

## Verification
This is a source-only verification increment; no dependency-backed production build is claimed. Use Node.js `24.15.0` for supported-runtime typecheck, lint and Next.js production build.
- `node scripts/check-phase10-settings-performance.mjs`: 14/14.
- `node scripts/check-phase10-resilience.mjs`: 17/17.
- `node scripts/test-phase10-service-worker-policy.mjs`: 11/11.
- Full TypeScript, ESLint and Next production build are not certified in the current Node 22.16.0 environment; project requires Node 24.15.0.

## Safety
No SQL migration was applied. No Pi Testnet/Mainnet transaction, GHC debit/credit, refund, payout, paid entitlement grant or production operation was executed. Pi and GHC remain separate assets and all account/payment/entitlement decisions remain server-authoritative. Phase 9 external acceptance gates remain open.

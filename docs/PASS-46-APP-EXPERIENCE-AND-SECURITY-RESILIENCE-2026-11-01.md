# Pass 46 — App experience and security resilience

**Source version:** `0.265.0`  
**Date:** 2026-11-01  
**Status:** Source changes implemented; production acceptance remains pending.

## Scope

This pass continues from Pass 45 and deliberately does not introduce Cloudflare, R2, a new storage provider, a new database, or a redesign. Supabase remains the existing backend and media provider. Existing identity, payment, reward, GHC ledger, Pi payment rail, RLS and private-media boundaries are preserved.

## Security and API reliability

- Durable rate-limit failures now carry an explicit `unavailable: true` marker when the Supabase-backed control plane cannot be reached or returns an invalid response and the caller selected fail-closed behavior.
- A real exhausted quota remains HTTP `429` with `RATE_LIMITED`.
- An unavailable durable protection service is now HTTP `503` with `RATE_LIMIT_UNAVAILABLE`; it is no longer misreported as a user quota violation.
- The distinction is implemented in the pure rate-limit contract and covered by runtime behavior tests.
- The social mute and block write routes now explicitly fail closed rather than falling back to a process-local limiter when durable protection is unavailable.
- The distinction is propagated to the existing 13 durable rate-limit API boundaries covering Pi auth, payment intents, GHC spend/transfers/purchases, reward claims and Pi earnings payout operations.
- No quota values, ledger semantics, Pi settlement rules, or authorization checks were relaxed.

## App experience and accessibility baseline

- Added consistent keyboard-visible focus treatment for interactive controls.
- Added reduced-motion handling for users who request it at operating-system level.
- Added restrained interaction feedback for buttons and touch targets, with hover treatment limited to hover-capable devices.
- Added a reusable `.gh-skeleton` shimmer utility for future loading-state surfaces without changing existing page loading behavior.
- Improved mobile text rendering, touch handling, form sizing, image sizing and selection contrast.
- Existing safe-area and bottom-navigation layout rules remain intact.

## Verification

- `scripts/check-pass46-experience-and-fail-closed.mjs` checks all 13 durable API boundaries, their fail-closed configuration and HTTP status mapping, plus the accessibility interaction baseline.
- `scripts/test-pass45-rate-limit-contract.mjs` now also tests the 429 versus 503 failure contract.
- Both checks are wired into `prebuild` and `verify:static`.

## Explicitly not claimed

- No Cloudflare or R2 integration was performed or configured.
- No Supabase migration was added or applied in this pass.
- No production deployment, Pi Testnet verification, browser E2E, or live multi-user test is claimed.
- The source environment uses Node `22.16.0`, while the project requires Node `24.15.0`; therefore Node 24 typecheck, lint and Next.js production build remain outstanding.

# Pass 47 — App experience cohesion and recovery feedback

**Source version:** `0.265.0`  
**Date:** 2026-11-01  
**Status:** Source changes implemented; production acceptance remains pending.

## Scope

This pass continues from Pass 46 and concentrates on cross-app experience quality. No Cloudflare/R2 integration, storage migration, database migration, or provider change was introduced. Existing Pi, Supabase, identity, authorization, wallet, payment and GHC ledger boundaries remain unchanged.

## User-facing improvements

- Removed a redundant nested `IdentityProvider` from the home route so the session-lock gate and every app domain observe the same app-wide identity context.
- Added a global connection-status surface that appears when the browser loses connectivity and announces the state to assistive technology.
- Added a short connection-restored notice that reminds users to check pending actions before retrying, reducing accidental duplicate submissions after reconnects.
- Connection listeners and the reconnect timer are cleaned up when the app shell unmounts.
- Unified feed and lazy-tab loading placeholders on the existing shared shimmer utility, removing inconsistent pulse animations across these surfaces.
- Removed raw exception-message logging from the root-level fatal error boundary; the safe framework digest remains available for correlation.

## Verification

- `scripts/check-pass47-experience-cohesion.mjs` validates single identity-provider ownership, offline/online feedback, timer cleanup, safe root-error diagnostics and consistent feed/tab loading surfaces.
- Pass 47 checker is wired into `prebuild` and `verify:static`.
- `npm run verify:static` passed: 57/57 consolidated checks, including the Pass 47 regression gate.
- Project truth passed 10/10; release hygiene passed 11/11; dependency lock integrity passed; migration inventory passed with 171/171 canonical files synchronized.

## Not claimed

- No payment is queued or retried automatically while offline.
- No live network quality, provider, database, browser E2E, Pi Testnet or production deployment test is claimed.
- Supported-runtime Node 24 build gates remain required for release approval.

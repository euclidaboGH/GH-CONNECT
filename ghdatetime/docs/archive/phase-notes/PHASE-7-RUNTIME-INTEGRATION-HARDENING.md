> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 7 — Runtime integration hardening (v0.96.0)

## Scope
Phase 7 adds an explicit runtime-hardening contract suite and a safe deployed negative-path smoke runner. The work concentrates on integration boundaries that can fail silently or create security exposure: signed payment-provider webhooks, replay/idempotency keys, multi-user messaging, reward claims, payment fulfillment, referral attribution, wallet ownership, and authoritative curation.

## Implemented
- Added `scripts/check-phase7-runtime-hardening.mjs` with source-level checks for authentication ordering, ownership checks, rate limiting, payload caps, server-side media ownership, HMAC-SHA512/timing-safe Paystack signature verification, webhook event correlation/evidence hashing, no-store behavior, idempotent payment fulfillment, and client-supplied economic-authority rejection.
- Added `scripts/operator-phase7-runtime-hardening.mjs`, a deployed negative-path smoke test. It probes health, verifies that unauthenticated reward/payment/referral/messaging requests are rejected, and verifies that an invalid Paystack webhook signature is rejected. It never submits a valid webhook or attempts a successful economic mutation.
- Added npm scripts for the Phase 7 source gate and operator smoke runner.
- Updated release metadata and project truth to v0.96.0.

## Safety and limitations
- No database migration was added and no financial business logic, Pi authentication, branding, feature flags, or ledger semantics were changed.
- The source contract test is not a substitute for concurrency testing against disposable PostgreSQL, provider sandbox testing, or two-account authorization checks.
- The operator smoke script must be run against the deployed target with `GHC_E2E_BASE_URL`. It intentionally expects the health endpoint to return either 200 or 503, because 503 can represent a reachable but not-ready deployment. A 503 is not release approval.
- A successful run is only evidence for the exact target and time of that run. It does not prove migrations have been applied or that Pi Testnet payments are working.
- Run with Node.js 24.15.0 or the supported Node 24 runtime, install the lockfile with `npm ci`, then run static checks, typecheck, lint, and production build. For full two-user verification use the existing `operator-live-e2e.mjs` with separate test accounts and the required environment credentials.

## Verification commands
```sh
npm ci
npm run check:phase7-runtime-hardening
npm run check:phase6-integration
npm run verify:static
npm run test:safety
npm run typecheck
npm run lint
npm run build
GHC_E2E_BASE_URL=https://your-testnet-deployment.example npm run operator:phase7-runtime-hardening
```

**Release status: NOT APPROVED by source checks alone.** Complete supported-runtime build and authenticated Testnet evidence before release.

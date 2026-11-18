> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Upgrade worklog — v0.157.14 — Phase 1–12 request-boundary expansion

Date: 2026-10-28

## Baseline and scope
- Input baseline: `GREENHAVEN-0.157.13-PHASE1-12-CROSS-SYSTEM-HARDENING-2026-10-28.zip`.
- Output release: `0.157.14`.
- Scope: extend the shared streaming JSON parser to additional high-impact financial, identity, payment-recovery and social write routes.

## Changes made
1. Added 4–8 KiB streaming JSON bounds to seller payout request, bank payout request, membership activation, GHC pack intent, Pi step-up authentication, ad verification, social block/restrict/mute/follow/save, and payment recovery routes.
2. Standardized malformed/non-object request handling to HTTP 400 and over-limit bodies to HTTP 413 in the updated routes, before their business mutations or provider lookup.
3. Tightened seller payout amount parsing so booleans, arrays, objects and malformed numeric strings cannot become a valid amount through JavaScript coercion.
4. Tightened social follow target parsing to require a string identifier.
5. Added `scripts/check-phase1-12-request-boundary-expansion.mjs` and registered it in the static verification runner and npm scripts.
6. Synchronized package/lockfile/app release versions, manifest, current documentation and release notes to `0.157.14`.
7. Preserved the prior v0.157.13 seven-route body-boundary improvements and official brand assets.

## Verification boundaries
- The new request-boundary contract is source-only and does not execute HTTP requests against a live Next.js server.
- The consolidated static suite, existing phase contracts, JSX safety, release hygiene, dependency-lock integrity, project truth, and archive integrity should be run after packaging.
- Available runtime is Node.js 22.16.0, but the project requires Node.js 24.15.0; dependencies are not installed in this environment. TypeScript, lint, and production build are not claimed as passed.
- No live Supabase database, Pi provider, Vercel deployment, migration application, or financial record was changed.

## Operational acceptance still required
1. Install dependencies from lockfile under Node.js 24.15.0.
2. Run TypeScript, lint and production build.
3. Test body-boundary responses using actual HTTP integration tests.
4. Run disposable PostgreSQL authorization, concurrency and recovery tests; reconcile Mainnet/Testnet migration histories separately.
5. Verify Pi Testnet authentication/payment/recovery flows and marketplace buyer/seller journeys.

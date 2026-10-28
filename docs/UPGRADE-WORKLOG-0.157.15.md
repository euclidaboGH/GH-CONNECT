# Upgrade worklog — v0.157.15 — Phase 1–12 request-boundary follow-up

Date: 2026-10-28

## Baseline and scope
- Input baseline: `GREENHAVEN-0.157.14-PHASE1-12-REQUEST-BOUNDARY-HARDENING-2026-10-28.zip`.
- Output release: `0.157.15`.
- Scope: extend bounded parsing and strict input-type validation to additional connection, moderation, matching, creator-tip and payout-beneficiary mutation endpoints.

## Changes made
1. Added an 8 KiB streaming JSON bound to connection request intake, with string-only target IDs and bounded note/source fields.
2. Added an 8 KiB bound to report intake; target IDs and reasons must be strings, and invalid community IDs are rejected.
3. Added a 4 KiB bound to matching signals and requires string target/signal values.
4. Added an 8 KiB bound to creator-tip intents; rejects non-string optional fields, oversized notes, boolean/object amount coercion, exponent notation and invalid decimal syntax.
5. Added an 8 KiB bound to bank-beneficiary creation and a 4 KiB bound to beneficiary disable; sensitive account and beneficiary identifiers must be strings.
6. Added `scripts/check-phase1-12-request-boundary-followup.mjs` and registered it in the consolidated static suite and npm scripts.
7. Added `scripts/test-bounded-json-runtime.mjs` to exercise valid object parsing, declared and streamed byte limits, malformed JSON, arrays/scalars, invalid UTF-8, invalid configured limits, and bodyless requests.
8. Synchronized package/lockfile/app release versions, manifest, current documentation and release notes to `0.157.15`.
9. Preserved existing GreenHaven and GHC brand assets and prior Phase 1–12 hardening.

## Verification boundaries
- The shared bounded JSON reader runtime test is executed separately with Node's TypeScript stripping flag; it is an isolated helper test, not an HTTP integration test against Next.js.
- The consolidated static suite checks source contracts and migration inventory only.
- Available runtime is Node.js 22.16.0, but the project requires Node.js 24.15.0; dependencies are not installed in this environment. TypeScript, lint and production build are not claimed as passed.
- No live Supabase database, Pi provider, Vercel deployment, migration application, or financial record was changed.

## Operational acceptance still required
1. Install dependencies from lockfile under Node.js 24.15.0.
2. Run TypeScript, lint and production build.
3. Test body-boundary responses using actual Next.js HTTP integration tests, including provider-side timeout/failure cases.
4. Run disposable PostgreSQL authorization, concurrency and recovery tests; reconcile Mainnet/Testnet migration histories separately.
5. Verify Pi Testnet authentication/payment/recovery flows and marketplace buyer/seller journeys.

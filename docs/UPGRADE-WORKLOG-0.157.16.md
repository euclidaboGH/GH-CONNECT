# GreenHaven v0.157.16 — production build regression correction

Date: 2026-10-28

## Trigger
The Vercel build for `testnet` at commit `9901366` compiled successfully but failed during TypeScript validation because `app/api/economy/ledger/spend/route.ts` called `readBoundedJson` without an executable import. The attempted import had accidentally been placed inside the route's leading documentation comment.

## Change
- Moved the `readBoundedJson` import outside the documentation comment and into the executable import section.
- Preserved the 8 KiB bounded body parsing, oversize 413 handling, authentication, step-up, rate limiting, and server-authoritative spend/order validation.
- Added `scripts/check-spend-bounded-json-import.mjs` and `check:spend-bounded-json-import` as a targeted regression guard.
- Synchronized package, lockfile, app release, current-version documentation and manifest to `0.157.16`.
- No dependency upgrades, migrations, live financial operations, or production configuration changes were made.

## Verification
This is a source-only correction and records the source correction. Static checks, syntax checks, archive integrity and branding preservation must pass before the archive is handed off. The available local runtime is Node.js 22.16.0; the project requires Node.js 24.15.0. A full Next.js production build and TypeScript check must still be run in CI/Vercel under the supported Node.js 24.15.0 runtime with installed dependencies. Dependency audit findings from the supplied Vercel log remain a separate follow-up and are not represented as resolved.

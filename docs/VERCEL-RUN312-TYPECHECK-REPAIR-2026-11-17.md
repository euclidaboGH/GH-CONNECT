# Vercel Run #312 — TypeScript and transport repair

Date: 2026-11-17  
Working release identity: `gh-connect@0.338.93`  
Failing CI run: `44087716682` / job `134055444046`  
Target commit reported by the run: `f5f3cc4a5fdfc1a753883783b26442c91365e074`

## Scope

This source-only repair addresses the TypeScript diagnostics reported by Run #312 and related defects discovered while following the affected code paths. It does not claim that all project weaknesses have been eliminated or that production acceptance has been achieved.

## Repairs

- Imported `createHash` in the operator revenue summary route.
- Added explicit field/research evidence row contracts for queue sorting and scanner storage access.
- Removed duplicate `ok` object properties from evidence upload success responses.
- Narrowed failed REST results before accessing `.data` in public research idempotency and evidence fallback paths.
- Narrowed challenge participation errors before accessing successful RPC payloads.
- Moved challenge durable-ID derivation before the effect that consumes it.
- Replaced incompatible `TouchList` iteration with the DOM `TouchList.item()` API.
- Completed the local daily-claim response adapter with both JSON and text readers.
- Extended the shared Supabase REST result with response headers, preserving the actual upstream `Content-Range` metadata used for exact counts.
- Added bounded streaming JSON reads to the shared REST client, including a 1 MiB cap for public profile hydration, content-length preflight, invalid JSON handling, and explicit oversized/empty-response errors.
- Reworked Pioneer count handling to use the shared REST client and its real response headers.
- Narrowed evidence fallback results and fixed the achievement-store stale variable reference.
- Replaced notification/referral payload access on inferred `{}`/`unknown` values with explicit runtime object checks and typed result paths.
- Replaced a relative server-side `fetch()` in Pi listing readiness with the canonical Supabase REST transport, preserving timeout, no-store, count, and range behavior.
- Typed notification push RPC payloads as validated records and fail closed on malformed/non-object RPC responses; validate subscription identifiers before serialization.
- Modeled unified-notification RPC outcomes as discriminated results and validated the distinct database return contracts: JSON object for list/create and integer scalars for unread count/mark-read. This preserves the SQL functions' actual return types instead of incorrectly treating every RPC as a JSON object.
- Made all notification-center and push-subscription API responses explicitly `private, no-store`, including successful responses, errors, and rate-limit responses.
- Rejected null, array, and primitive request JSON before property access; only string notification IDs are accepted for mark-read requests.
- Removed the duplicate `supabaseRest` import in Pi listing readiness.
- Expanded the Run #312 source-contract checker to 28 assertions; it remains registered in `pretypecheck` and `verify:static`.

## Verification

- Run #312 source contract: 28/28 passed.
- Phase 6 performance/accessibility gate: 23/23 passed.
- Scoped Evidence Engine gate: 25/25 passed.
- Vercel build-hygiene gate: 17/17 passed.
- Changed TypeScript modules passed syntax transpilation; a focused strict TypeScript compile of the notification routes and notification RPC modules passed using temporary declarations for unavailable external dependencies.
- `npm run verify:static` was attempted but exceeded the available five-minute execution window; it is not reported as a complete pass for this candidate.

## Verification limitations and release boundary

The environment provides Node `v22.16.0`, while this project requires Node `^24.15.0`; the runtime gate rejects the available version. The supplied `node_modules` directory is incomplete (the TypeScript compiler and required type packages are absent locally), and no clean Node 24.15.0 dependency installation was available. Consequently, a trustworthy full-project `tsc --noEmit`, lint, Next.js production build, browser acceptance run, and full Node 24.15.0 prebuild have **not** been completed for this repair. The focused strict TypeScript check is useful evidence for the changed notification paths, but it is not a substitute for the complete project compiler run.

No npm audit remediation or dependency force-upgrade is claimed. No GitHub push, Vercel deployment, Supabase migration, production database mutation, Mainnet action, financial mutation, scanner activation, or Coming Soon service activation was performed. All 30 Coming Soon services remain disabled and production remains **NOT APPROVED** pending the required Node 24.15.0 install and complete CI/build evidence.

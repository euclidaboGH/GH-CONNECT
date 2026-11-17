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
- Added a Run #312 source-contract checker to `pretypecheck` and `verify:static`.

## Verification

- Run #312 source contract: 20/20 passed.
- Phase 3 public profile identity contract: 16/16 passed.
- Phase 6 cross-feature integration reliability: 28/28 passed.
- Phase 1–12 hardening audit: 19/19 passed.
- The full static verification log recorded `Static verification PASSED (63/63)` before the new 20-assertion Run #312 contract was registered. The new contract was run separately and passed 20/20.
- Additional operator-readiness boundary check: 9/9 passed.

## Verification limitations and release boundary

The environment provides Node `v22.16.0`, while this project requires Node `^24.15.0`. A clean dependency installation could not complete because npm registry requests failed with DNS `EAI_AGAIN`; the local `node_modules` directory is therefore incomplete. Consequently, a trustworthy full `tsc --noEmit`, lint, Next.js production build, browser acceptance run, and full Node 24.15.0 prebuild have **not** been completed for this repair.

No npm audit remediation or dependency force-upgrade is claimed. No GitHub push, Vercel deployment, Supabase migration, production database mutation, Mainnet action, financial mutation, scanner activation, or Coming Soon service activation was performed. All 30 Coming Soon services remain disabled and production remains **NOT APPROVED** pending the required Node 24.15.0 install and complete CI/build evidence.

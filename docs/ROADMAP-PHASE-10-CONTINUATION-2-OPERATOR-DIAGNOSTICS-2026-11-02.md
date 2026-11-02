> Engineering note — 2026-11-02

# Phase 10 Continuation 2 — Operator diagnostics fail-closed behavior

## Scope

This continuation hardens the existing operator-only `GET /api/system/status` endpoint. It does not add a new public diagnostics surface and does not alter authentication, authorization, payment execution, wallet ledgers, or database migrations.

## Defect addressed

The status endpoint previously classified table probes as present, missing, unreachable, or a generic HTTP status. HTTP 401/403 responses and provider 5xx responses did not necessarily create a readiness blocker. That could make a status response look healthier than the underlying Supabase access actually was. The probes also ran serially, so two independent 5-second requests could consume approximately 10 seconds before returning.

## Changes

- Execute independent read-only table probes concurrently, with a 5-second timeout per request.
- Distinguish missing tables (`404`), rejected credentials (`401`/`403`), upstream failures (`5xx`), other unexpected HTTP statuses, and unreachable providers.
- Fail readiness closed when probes show rejected credentials, unreachable Supabase, or upstream/unexpected HTTP failures.
- Keep the endpoint operator-only, timing-safe for its dedicated key, non-cacheable, read-only, and free of reflected provider exception details.
- Add a 13-assertion regression checker to `prebuild` and `verify:static`, plus a dedicated CI step.

## Verification

- `scripts/check-phase10-system-status-probes.mjs`: 13/13 passed.
- Existing operator-only status contract: 9/9 passed.
- Full `npm run verify:static`: exit code 0 under the available Node 22.16.0 runtime.
- Repository specifies Node 24.15.0; typecheck, lint, production build, and live Supabase/Vercel probes are not claimed by this note.

## Operational follow-up

Run the endpoint in a non-production environment with a dedicated operator secret and known-good test schema. Confirm the expected blocker list for invalid credentials, missing tables, provider timeout, and recovered connectivity. Do not put operator keys in browser code or client-visible environment variables.

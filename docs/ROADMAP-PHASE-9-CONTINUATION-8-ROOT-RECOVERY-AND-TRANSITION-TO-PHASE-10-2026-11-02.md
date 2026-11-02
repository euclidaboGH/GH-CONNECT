> Engineering note — 2026-11-02

# Phase 9 — Continuation 8: Root Recovery and Phase 10 Readiness

## Why this continuation matters

Repeated generic error screens can be a symptom of a real exception, a deployment/configuration issue, or a failed upstream dependency. This continuation fixes two avoidable reliability defects in source and improves recovery behavior, but does not claim to eliminate every runtime failure without production error digests and environment logs.

## Changes

- Root metadata now uses a defensive URL parser. A malformed `NEXT_PUBLIC_APP_URL` no longer throws during module initialization and take down every route. Only credential-free HTTP(S) origins are accepted; invalid values omit `metadataBase` safely.
- Route-level error recovery retries the current route instead of always redirecting to `/`, preserving deep-link context and allowing normal authorization checks to run again.
- Route and global error screens provide a support path and remind users to check pending actions before resubmitting, reducing accidental duplicate actions.
- The shared client error boundary clears its automatic retry timer on unmount and manual retry. Removed the unsupported guarantee that recovery controls leave saved data unchanged.
- `withRetry` now bounds caller-supplied settings and clears request timeout timers after success, failure, and before retry backoff. The underlying operation is not forcibly cancelled if its API does not support cancellation; callers must continue to use idempotency for write retries.
- Added runtime tests and a source checker to both `prebuild` and `verify:static`.

## Safety boundaries

No authentication, authorization, Pi payment, GHC balance, financial ledger, database schema, or migration behavior was changed. Error messages remain sanitized; no raw stack or secret is rendered. The support link is a recovery destination, not a claim that telemetry is configured.

## Verification limits

Run the focused checker and runtime tests under the available Node runtime. The repository declares Node `^24.15.0`; Node 22 results are provisional until the exact supported runtime is used. Full TypeScript, lint, production build, Playwright browser execution, Pi Browser and live Supabase behavior remain separate gates.

## Transition toward Phase 10

Phase 10 should start with a release-engineering evidence pass: run Node 24.15.0 CI gates, capture sanitized deployment error digests, verify environment-variable shape without exposing values, execute Playwright on a non-production deployment, and audit security/operations dashboards. Do not mark the project production-ready from source assertions alone.

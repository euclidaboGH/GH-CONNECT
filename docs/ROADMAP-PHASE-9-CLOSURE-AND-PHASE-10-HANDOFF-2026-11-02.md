> Engineering note — 2026-11-02

# Phase 9 closure and Phase 10 start

## Phase 9 closure decision

Phase 9 source-level work is consolidated: route/global error boundaries, same-route retry, safe metadata URL parsing, offline guidance, sanitized support references, accessible loading/recovery, focus/keyboard safeguards, reduced-motion support, responsive viewport contracts, and runtime resilience regression checks are retained in the source tree. Closure checks verify the expected artifacts and make the remaining verification limits explicit.

**Phase 9 is source-implementation complete for this handoff, but not device/browser validated or production certified.** Playwright scenarios have been authored in the existing project but are not yet executed in a real browser in this environment. Protected deep-link behavior, actual screen-reader behavior, safe-area/virtual-keyboard behavior, and the recurring live error screen still require a non-production browser run and sanitized deployment evidence.

## Phase 10 scope — Admin, security, operations, release engineering

This first Phase 10 increment establishes evidence gates rather than pretending to complete all ten roadmap capabilities:

1. Release evidence source checker verifies the supported Node version, read-only GitHub permissions, locked dependency install, static/type/lint/build gates, lock integrity, safety scan, security headers, RLS/SECURITY DEFINER audits, migration readiness and concurrency controls.
2. A deployment environment-shape auditor reports only variable names and validation status; it never prints values. It validates configured URL shape, boolean-like feature flags and `PI_NETWORK` spelling. Missing optional variables are informational, not treated as proof of a failed deployment.
3. Phase 9 closure and Phase 10 source-evidence checks are wired into `prebuild` and `verify:static` so they cannot be silently omitted from those entry points.

## Runbook

- Use the repository-declared Node `24.15.0` runtime.
- Run `npm ci --legacy-peer-deps --no-audit`, `npm run verify:static`, `npm run typecheck`, `npm run lint`, and `npm run build` in that order.
- Run `npm run audit:deployment-env-shape` in the actual deployment environment. Review status only; do not paste secret values into logs or chat.
- Capture the failing route, deployment ID/commit, sanitized correlation digest, timestamp, and relevant redacted server log lines when a generic error screen recurs.
- Run Playwright against a non-production deployment and record actual execution results. Never bypass session checks to make a deep link appear to work.
- Reconcile migrations, RLS grants, `SECURITY DEFINER` ownership/overloads, webhook replay behavior, financial invariants, and operator approvals before release.

## Verification boundary

Source contract checks are not proof of deployed behavior. The current working environment uses Node 22.16.0 while the project declares Node `24.15.0`; all runtime/build gates must be rerun under the supported version. No live Pi Browser, Vercel, Supabase, real-device or Playwright execution is claimed by this handoff. This is **not production approval**.

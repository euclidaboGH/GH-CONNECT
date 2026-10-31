# GreenHaven v0.157.2 — Phase 3 identity hydration hardening

Date: 2026-10-28
Source baseline: `GREENHAVEN-0.157.1-AUDIT-TRUTH-HARDENING-2026-10-28.zip`

## Changes

- Extended shared public identity hydration to bounded nested `comments`, `replies`, and `children` trees while retaining a batched profile query.
- Added explicit traversal safeguards: 500 visited rows, depth 12, 100 unique identity IDs per upstream request, 1 MiB response body, and 5-second timeout.
- Applied public avatar URL validation to persisted fallback photo values used during hydration.
- Expanded Phase 3 source checks from 14 to 16 checks.
- Synchronized package, lockfile, app release metadata, README, project-truth docs, manifest, and consolidated acceptance report to v0.157.2.

## Verification

- Phase 3 identity check: 16/16 passed.
- Phase 2 canonical identity: 17/17 passed.
- Phase 4 identity integration: 10/10 passed.
- Phase 5 design system: 13/13 passed.
- Phase 6 shell/navigation: 17/17 passed.
- Phase 7 social reliability: 23/23 passed.
- Release hygiene: 11/11 passed.
- Dependency-lock integrity: passed.

The first consolidation/project-truth run exposed stale hard-coded v0.157.1 assertions and metadata after the version bump. Those are being synchronized and rechecked as part of this patch; the initial failures are not being represented as passes.

## Not verified

The audit runtime is Node.js 22.16.0 while the project requires `^24.15.0`; dependencies are not installed. No supported-runtime typecheck, lint, production build, browser E2E, live Supabase migration reconciliation, PostgreSQL restore drill, Pi Testnet, or Vercel verification is claimed.

> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 5 — Curation intelligence reliability (v0.94.0)

## Goal
Make the curation-intelligence failure path diagnosable and safer to operate without weakening the requirement that authoritative curation weight comes from a persisted server-owned intelligence snapshot.

## Implemented
- Normalize Supabase/PostgREST RPC failures into bounded diagnostic identifiers rather than passing arbitrary database messages into the curation route's logs.
- Distinguish database configuration, network failure, invalid RPC response, PostgREST schema-cache/function errors, and selected PostgreSQL dependency/schema SQLSTATE failures.
- Extend the curation endpoint's migration-readiness classification for normalized schema/dependency diagnostics.
- Preserve the existing client response contract and do not return raw database errors or credentials.
- Keep `gh_reputation_intelligence` as the mandatory authoritative source. Missing or unreadable snapshots still fail closed; no formula-derived fallback is enabled.
- No database migration was added. This release does not claim that a migration is applied to the live Supabase project.

## Verification
Run:

```bash
node scripts/check-phase5-reliability.mjs
node scripts/check-phase4-identity-integration.mjs
node scripts/check-phase3-profile-identity.mjs
node scripts/check-release-hygiene.mjs
node scripts/check-dependency-lock-integrity.mjs
node scripts/scan-production-safety.mjs
node scripts/verify-phase14-static.mjs
```

## Operator follow-up
If curation still reports `CURATION_INTELLIGENCE_UNAVAILABLE`, inspect Vercel server logs for the sanitized `diagnosticCode`. Then compare the exact SQLSTATE/PostgREST code with the source migration `20261023030002_gh_reputation_curation_intelligence_v2.sql` and confirm its dependencies exist in the target Testnet database. Reconcile remote migration history before applying anything; do not blindly rerun migrations. Confirm server-only Supabase URL/service-role configuration in Vercel without printing secrets. Finally, verify a test account has a row in `gh_reputation_intelligence` and that the refresh RPC returns `ok: true` in an authorized server-side check.

## Explicit limitations
- No live Supabase connection or Testnet vote was executed in this environment.
- Full TypeScript and production builds remain unverified here because the available Node runtime is 22.16.0 while the project requires `^24.15.0`, and dependencies are not installed.
- These diagnostics improve the next failure's observability; they do not by themselves prove the underlying database dependency has been repaired.

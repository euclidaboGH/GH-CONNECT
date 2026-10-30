# Upgrade worklog — 0.192.0

## Scope
System-wide CI hardening focused on making critical security, payment-recovery and treasury regression suites visible as individual GitHub Actions steps.

## Changes
- Added explicit CI steps for database RLS source coverage and SECURITY DEFINER ACL source inspection.
- Added the production safety scan as a CI gate.
- Added explicit Phase 15 payment recovery and Phase 16 payment lifecycle regression gates.
- Added explicit Phase 7 treasury completion contract gate.
- Preserved Node.js 24.15.0, locked dependency installation, comprehensive static suite, typecheck, lint and production build.

## Local verification
- `verify-phase14-static.mjs`: 57/57 passed.
- `scan-production-safety.mjs`: 21/21 passed across 873 source files.
- Security headers: 7/7 passed.
- API CSRF contract: 7/7 passed.
- SECURITY DEFINER source audit: 340 declarations passed static checks.
- Database RLS source coverage: 129 executable table names inspected; 116 with policy definitions and 13 explicitly allowlisted for operator/service-role review.
- Phase 15 payment recovery: 10/10 passed.
- Phase 16 payment lifecycle: 11/11 passed.
- Phase 7 treasury completion: 16/16 passed.

- Environment runtime was Node.js 22.16.0; project-required Node.js 24.15.0 is pinned in `.nvmrc` and CI.

The release evidence is source-only and includes no isolated helper test of the complete application runtime.

## Not claimed
- Node 24 typecheck/lint/Next production build not run in this environment (Node 22.16.0 and no installed dependencies).
- Migration 008 remains REVIEW_REQUIRED and unapplied.
- No disposable PostgreSQL, Supabase, Pi Testnet, Vercel, or authenticated browser E2E was available or executed.

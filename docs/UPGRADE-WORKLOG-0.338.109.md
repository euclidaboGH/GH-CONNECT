# GreenHaven upgrade worklog — 0.338.109

**Date:** 2026-11-19  
**Parent:** 0.338.108 Testnet Safe Upgrades candidate  
**Package:** `gh-connect@0.338.109`  
**Status:** source-only full-project audit and maintenance; not pushed or deployed.

## Scope and changes

1. Reviewed the complete source tree, application/API surface, shared libraries, UI components, Supabase migrations/proposals, environment configuration, CI/Vercel configuration, package scripts and existing regression suite.
2. Added `scripts/check-project-script-integrity.mjs` and registered it in `verify:static`.
3. Removed one repeated invocation of `scripts/check-run288-type-safety.mjs` from `pretypecheck`; its remaining invocation and all other checks remain intact.
4. Preserved the 231 historical migration files byte-for-byte; no schema or ledger SQL was changed.
5. Added `docs/FULL_PROJECT_AUDIT_2026-11-19.md` with scope, findings, verification evidence, release blockers and recommended safe remediation order.
6. Synchronized package, lockfile, app release identity, README, project truth and verified migration manifest to 0.338.109.
7. Rechecked API route ownership, timeouts, durable rate-limit classifications and release readiness boundaries.
8. Rechecked RLS and SECURITY DEFINER source controls without claiming live catalog equivalence.
9. Rechecked environment templates and production-safety boundaries; no credentials were added and financial defaults remain fail-closed.
10. Recorded the remaining runtime, dependency, database, provider and authenticated E2E gates without marking them complete.

**Source-only verification scope:** repository source, manifests and static regression scripts; no live database/provider or authenticated browser session was used.

## Verification

- Full `npm run verify:static`: PASS (exit 0; more than 5,200 passing assertion/output lines).
- Migration integrity: 231 unique versions, hashes and basenames.
- Release hygiene: 21/21; project truth: 11/11.
- API route/access: 10/10; timeout/error/rate-limit: 21/21; Testnet/Mainnet readiness: 12/12.
- RLS source coverage: 176 executable table names; SECURITY DEFINER source audit: 492 declarations.
- Production-safety scan: 21/21 across 1,193 files; security headers: 7/7; JSX safety: 1,177 files.
- Project script integrity: 1,209 command entries; no duplicate commands or missing local script references.
- Dependency lock coverage and package/lock version consistency: PASS.

## Outstanding release blockers

- Node.js 24.15.0 dependency-backed install, TypeScript, ESLint and Next.js production build were not run: the available runner is Node 22.16.0 and dependencies are not installed.
- Browser/device E2E and authenticated multi-account Testnet acceptance remain outstanding.
- Prior npm audit records 22 advisories (1 critical, 13 high, 6 moderate, 2 low). A fresh registry audit failed with `EAI_AGAIN`; no speculative dependency upgrade was applied.
- Clean PostgreSQL migration rehearsal and live Testnet migration-history/catalog reconciliation remain outstanding.
- Atomic reward emission, GHPV durable daily cap and curation redistribution idempotency prerequisites remain held pending reviewed forward-only SQL and concurrency/idempotency verification.
- Pi Sandbox authorization and external provider acceptance remain operator gates.

No live database, migration history, ledger, payment, payout, Pi transfer, GitHub repository or Vercel deployment was changed. No Mainnet action occurred; Mainnet remains untouched. Testnet certification and Production remain NOT APPROVED.

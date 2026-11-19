# GreenHaven upgrade worklog — 0.338.108

**Date:** 2026-11-19  
**Parent:** 0.338.107 release-gate wiring + Pi SDK CSP packaging  
**Package:** `gh-connect@0.338.108`  
**Status:** source-only Vercel packaging / Pi SDK CSP repair; not pushed or deployed as a production release.

## Scope

- Repaired Vercel source packaging so `.env.example` is preserved while local secret environment files remain excluded.
- Expanded CSP allow-list for configured Pi SDKLite CDN and plugin backend origins.
- Added regression gates for packaging and CSP contracts.
- Synchronized package, lockfile, in-app release identity, project truth and source-of-truth at `0.338.108`.
- Audited Pi authentication flow without changing identity, payment, wallet, or database authority.

## Explicit holds

- Testnet Preview deployments remain the only permitted Vercel target for this candidate.
- Mainnet remains NOT APPROVED.
- No Mainnet action occurred. Mainnet remains untouched.
- No database push, Supabase schema/ACL mutation, ledger mutation, payment, payout, or Pi transfer was performed.
- Financial feature flags stay fail-closed; production remains NOT APPROVED.

## Verification notes

- Phase 5 runtime acceptance gate: 15/15.
- RUN380 Phase 6 readiness reports: 12/12 after version synchronization.
- Live Pi Browser and full authenticated Testnet acceptance remain operator gates.
- Dependency audit still records 22 known vulnerability entries pending registry-connected remediation.

## Release decision

- Source packaging and CSP repair only.
- Production remains NOT APPROVED.
- Mainnet remains NOT APPROVED.

## Migration integrity maintenance — 2026-11-19

This maintenance pass is a source-only verification and tooling improvement. It does not certify the live Testnet schema.

1. Kept the uploaded 0.338.108 project as the source baseline and retained the Testnet Preview environment overlay separately from canonical production defaults.
2. Preserved all historical migration SQL files without editing, deleting, renumbering, or reordering them.
3. Rechecked the 231 canonical migration filenames and 14-digit version identifiers.
4. Added SHA-256 duplicate-content detection and duplicate-basename detection for migration SQL.
5. Added a guard that keeps review-only proposal SQL outside the canonical migration directory.
6. Added the `check:migration-integrity` npm script to combine the repository's migration safety checks.
7. Updated the structural inventory generator to derive the release from `package.json` and accept a dated audit output.
8. Regenerated the structural inventory for release 0.338.108 on 2026-11-19 and retained the prior dated artifact as historical evidence.
9. Recorded repeated SQL declarations for semantic review instead of deleting potentially required compatibility or security reconciliation logic.
10. Kept atomic global emission, curation idempotency, GHPV daily-cap durability, and live migration-history reconciliation as explicit holds pending disposable PostgreSQL and Testnet verification.

**Source-only verification scope:** repository files and local static scripts only. No live database connection, remote migration-history read, provider acceptance, or authenticated browser E2E was available in this pass. A clean PostgreSQL rehearsal and read-only Testnet reconciliation are still required.

**Required Node runtime:** Node.js 24.15.0 (the package engine and CI runtime). The local maintenance runner was Node.js 22.16.0, so this pass did not claim Node 24 build/typecheck certification. The migration integrity suite and full repository static verification completed successfully on the local runner; build/typecheck still require the declared Node 24.15.0 runtime and installed dependencies.

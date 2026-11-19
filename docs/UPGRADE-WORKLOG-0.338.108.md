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

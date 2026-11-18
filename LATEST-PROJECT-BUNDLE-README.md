# GreenHaven — Current Project Bundle

**Package:** `gh-connect@0.338.99`  
**Working increment:** RUN333 — Testnet security reconciliation and election tally UI/reconciliation source upgrade  
**Baseline:** user-provided RUN331 archive; RUN332 audit remediation is the immediate parent.  
**Date:** 2026-11-18  
**Release status:** **NOT APPROVED** for production.

## Delivery identity

The current RUN333 archive is a local source derivative. Its SHA-256 is supplied with the packaged artifact in the delivery message. It has not been pushed to GitHub or deployed to Vercel.

## RUN333 changes

1. Used the existing GH Connect Supabase Testnet project directly; no new Supabase branch was created.
2. Applied `20261118033839_revoke_client_select_on_server_only_tables` to revoke redundant `SELECT` grants from `PUBLIC`, `anon`, and `authenticated` on eight RLS-enabled server-only tables. Postflight confirms service-role CRUD remains intact.
3. Reconciled the Testnet history to 46 entries and regenerated the 230-file source migration inventory, manifest, checklist and apply-order guide. Twenty applied history entries still have no matching source filename and eleven same-slug/different-version candidates remain unverified.
4. Added the authenticated field-agent election tally desk, own-assignment acceptance, provenance-gated polling-unit selection and owner/reviewer-only read-only independent tally comparison. Submissions remain disabled until the held atomic tally RPC and approved geography dataset are installed.
5. Hardened the held tally SQL proposal to require active project membership, exact authoritative polling-unit code, source reference/version and the complete active candidate set.
6. Added per-evidence advisory transaction locking to the held evidence hash-chain trigger to prevent concurrent sequence forks.
7. Corrected final-release audit network classification to use `PI_NETWORK` rather than `PI_ENV`, and made the reported release version derive from `APP_RELEASE_VERSION`.
8. Preserved server-side financial authority, Testnet-only payout fences, no mock backends, and Mainnet separation.

## Verification

- `npm run verify:static`: PASS on available Node 22.16.0.
- RUN333 security reconciliation source gate: 11/11.
- Election tally UI/reconciliation source gate: 13/13.
- Election reconciliation runtime tests: 6/6.
- Final release audit environment tests: 4/4.
- Migration source manifest: 230/230.
- Project truth: 11/11.
- Changed TypeScript/TSX syntax transpilation: 7/7 with TypeScript 5.8.3; full project typecheck remains outstanding.
- Full `npm run prebuild:checks` remains blocked because dependencies could not be installed and `typescript` is missing from the local workspace. The supported runtime is Node 24.15.0; typecheck, lint, production build and browser/device acceptance remain outstanding.

## Database and release gates

- Testnet migration history: 46 entries; source inventory: 230 SQL migrations.
- Twenty historical applied migration source files are missing; eleven version-drift candidates are not proven equivalent. Do not reconstruct, repair or replay them by guess.
- The research foundation, media evidence engine and scoped evidence-chain migrations remain held pending exact source review and a safe rehearsal. Testnet currently has `gh_research_projects`, but dependent membership, geography, election, assignment, tally and atomic tally RPC objects are absent.
- Trusted scanner provider/worker and provenance-backed authoritative geography dataset remain external prerequisites.
- GitHub branch protection and source push remain outstanding. No Vercel deployment was triggered; fresh Testnet Preview verification is required.
- Mainnet project was not modified. No balances, payment, payout, reward, membership, election or user data rows were changed.

## Safety rule

Never run a bulk migration push while any migration source/history discrepancy or held migration remains. Testnet and Mainnet must be reconciled independently. Production remains NOT APPROVED until the supported-runtime build, exact database history/catalog reconciliation, provider acceptance, Pi Browser/device tests, and release-owner approval all pass.

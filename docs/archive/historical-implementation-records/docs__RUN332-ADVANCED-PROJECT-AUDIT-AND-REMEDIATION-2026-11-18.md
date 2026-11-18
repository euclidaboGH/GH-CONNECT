# RUN332 — Advanced project, database, GitHub and Vercel audit

**Audit date:** 2026-11-18  
**Working source:** user-provided `GREENHAVEN-0.338.99-RUN331-PHASE1-6-GAP-REGISTER-PHASE7-COMMUNITIES.zip`  
**Working package:** `gh-connect@0.338.99`  
**Status:** source remediation candidate; not pushed; not deployed; no SQL migration applied.

## Executive result

The RUN331 source archive passes `npm run verify:static` on the available Node 22.16.0 runtime. This is a source-contract result only. The project requires Node 24.15.0; a clean dependency install, full TypeScript check, ESLint run and production build have not been certified against RUN331. The Vercel preview build that is currently READY is built from GitHub commit `2f5010d43056ac6f0cc3d32ed4c7929a4095db30`, not from RUN331.

**Production remains NOT APPROVED.** The live Testnet database and repository migration history are not reconciled sufficiently to run `supabase db push`, repair migration history, or apply the three held migrations. Mainnet was not modified.

## Live Supabase Testnet findings (read-only inspection)

Project ref: `tpckwgdsjlkzscjlxiwe` · PostgreSQL 17.11 · project status ACTIVE_HEALTHY.

- Supabase migration history reports **45 applied entries**, latest `20261116171144` (`gh_research_studio_public_forms`).
- The RUN331 source archive contains **229 canonical migration files** and **8 proposal SQL files** (the original seven plus the RUN332 review-only grant-revocation proposal). The source manifest classifies 120 REQUIRED, 106 REVIEW_REQUIRED, 2 PROPOSAL and 1 REQUIRES_APPROVAL. These labels are review guidance, not proof of target state.
- Comparing the 45 live history versions with the archive filenames: **14 exact version matches**, **11 applied history entries with a same-name slug under a different local version**, and **20 applied history entries with no matching filename in the archive**. The exact historical SQL for the 19 unmatched entries was not found in the connected GitHub `testnet` branch either (GitHub code search returned zero matches for sampled exact names). Do not reconstruct or repair these records by guessing.
- There are 215 source migration versions not recorded under their exact version in the live history. This does **not** prove those changes are absent from the schema: older migrations may have been applied manually or represented by differently versioned history entries. Do not replay them wholesale.
- Three source migrations remain unapplied and held: `20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql`, and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql`.
- `gh_research_projects`, `gh_research_responses` and `gh_field_reports` already exist. The dependent research evidence, geography, election contest/candidate/agent/tally and scoped evidence-chain tables/functions are not present. The `gh_research_responses` `(id, project_id)` duplicate-key preflight returned zero, but this alone is not a complete migration rehearsal.
- `gh_field_reports` currently lacks `field_session_jti`; `gh_field_report_evidence`, `gh_research_evidence`, `gh_scoped_evidence_uploads` and `gh_evidence_chain_events` are absent. The held migration dependency order remains foundation → media evidence → scoped upload/custody.
- The live catalog reports 16 RLS-enabled tables with no policies. Eight of those tables also have redundant `authenticated SELECT` grants: `gh_verification_requests`, `ghc_account_flags`, `ghc_community_moderation_log`, `ghc_community_reports`, `ghc_connection_contexts`, `ghc_connection_requests`, `ghc_match_signals` and `ghc_user_blocks`. RLS currently denies client row access because no policies exist; project references are server-side. A narrow revoke-only SQL proposal was added under `supabase/proposals/`; it is not a canonical migration and has not been applied.
- The other no-policy tables are restricted to service-role or have no client grants. Do not add generic policies merely to silence the advisor.
- Live public SECURITY DEFINER inspection found **zero** functions executable by `anon` and **zero** executable by `authenticated`; the sampled public SECURITY DEFINER functions had pinned search paths. No client-executable SECURITY DEFINER issue was identified in this read-only check.
- Supabase Performance Advisor reports **118 unused-index INFO findings**. Do not drop these automatically: usage statistics can be reset or reflect low Testnet traffic. Review index size, table size, query plans and representative workload first.

### Migration safety decision

No live schema change was made. The workspace has no PostgreSQL 17 server, `psql`, Docker or Supabase CLI, and no disposable database branch currently exists. The three held migrations and the proposed client-grant revocation require a disposable PostgreSQL 17 rehearsal plus exact Testnet catalog/history reconciliation before any Testnet application. Mainnet was not queried for writes or modified.

## GitHub findings

Repository: `euclidaboGH/GH-CONNECT` (public; default branch `main`).

- `testnet` HEAD: `2f5010d43056ac6f0cc3d32ed4c7929a4095db30`; branch protection reports `false`.
- `main` HEAD: `80a60a1aae62d4742b478c356255c7c858984785`; branch protection reports `false`.
- Repository rulesets endpoint returned an empty list. The connected GitHub integration cannot read branch-protection details (403 Resource not accessible by integration), and its repository write permission was not assumed.
- RUN331 is not present on either branch. The connected `testnet` branch's package source predates RUN330/RUN331 checks. Do not claim the archive has been pushed.
- The current CI workflow runs static checks, Node 24.15.0, lock integrity, typecheck, lint, production-safety scan and build. The dependency workflow performs `npm audit --json`, but its exit status was not previously enforced explicitly. Both workflows now pin their GitHub Actions to immutable commit SHAs, disable persisted checkout credentials, and enforce a nonzero npm-audit exit.
- No GitHub Actions run result was independently confirmed by the connected status endpoint; combined commit status showed Vercel checks. Treat GitHub Actions as unverified until a fresh run for the eventual RUN332 commit passes.

## Vercel findings

Two Vercel projects are connected to the same repository:

1. `gh-connect-5p3o` — the remembered Testnet preview project. It has no custom domains and its variables are almost entirely Preview/testnet scoped. The latest READY preview is commit `2f5010d...`; it is not RUN331.
2. `gh-connect` — a second/legacy project with production environment variables and Vercel aliases. Its production deployment for `main` commit `80a60a1...` failed. Its latest Testnet preview for commit `2f5010d...` is READY. SSO protection is enabled for non-custom domains.

Historical production build failure was recovered from Vercel logs: `scripts/check-phase10-release-closure.mjs` failed **15/16** because it assumed `needs: static`, while the workflow correctly used YAML flow-list syntax `needs: [static]`. RUN331's release-closure contract was hardened to accept scalar, flow-list and block-list `needs` declarations; the current source check passes. This historical fix is in the working archive but not yet pushed.

The READY Testnet preview build used Node 24.22.3 and Next.js 15.5.26; install/build completed. That result applies to commit `2f5010d...`, not RUN331. The duplicate Vercel projects and unprotected Git branches remain deployment-governance risks. Do not delete, rename or repoint either Vercel project until the canonical production project/domain is confirmed.

### Preview/Testnet environment safety

The `gh-connect-5p3o` Preview/testnet environment has `NEXT_PUBLIC_PI_SANDBOX=true` (public, read-back verified). The remaining Pi, payout, A2U, GHC withdrawal, Paystack and registration-bonus variables are sensitive/encrypted, so their values are masked by Vercel and were not treated as readable facts. No private key or secret value was retrieved or printed.

Vercel accepted Preview/testnet-only upsert requests for `PI_NETWORK=testnet`, `PI_ENV=production`, `PI_A2U_TESTNET_ONLY=true`, and fail-closed values for `PI_EARNINGS_AUTO_EXECUTE`, `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED`, `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`, `PI_A2U_ENABLED`, `GHC_WITHDRAWALS_ENABLED`, `PAYSTACK_TRANSFERS_ENABLED` and `GHC_REGISTRATION_BONUS_ENABLED`. These updates apply only to the `testnet` Preview branch; encrypted/sensitive values are masked on read-back, so independent value verification remains pending. No deployment was triggered; a fresh Preview deployment and server-side health/flag diagnostics are required before treating these values as active. Production-project environment variables were not changed. The Preview project also has both unscoped and `testnet`-branch-specific definitions for `GHC_FIELD_SESSION_SECRET` and `GHC_MARKETPLACE_LISTING_FEE_PI`; this may be intentional override behavior, but the duplicate scopes should be documented or consolidated after the owner confirms the intended precedence.

## Source remediation included in RUN332

1. Corrected `.env.example` so `PI_ENV=production` describes the Pi Platform API mode while `PI_NETWORK=testnet` and `NEXT_PUBLIC_PI_SANDBOX=true` keep the blockchain/SDK on Testnet. Payout switches remain off.
2. Fixed `buildPlatformCapabilities()` environment precedence so explicit sandbox mode is not incorrectly labelled production merely because `PI_ENV=production`. Conflicting sandbox/network settings resolve to `unknown` (fail closed).
3. Added seven runtime regression cases for Testnet, Mainnet, preview defaults and conflicting flags.
4. Added a review-only SQL proposal to revoke redundant authenticated/client SELECT privileges from eight server-only tables without creating broad RLS policies or changing service-role grants.
5. Pinned GitHub Actions to reviewed immutable commit SHAs, disabled persisted checkout credentials, and made the dependency-audit workflow fail if `npm audit` exits nonzero even when a JSON report is produced.
6. Added RUN332 source checks to both `verify:static` and `prebuild:checks`.
7. Reordered the Run #288 type-safety precheck to the start of `pretypecheck`, resolving its own ordering assertion.

## Verification and deployment gate

- RUN331 `npm run verify:static`: PASS before RUN332 remediation.
- RUN332 `npm run verify:static`: PASS after remediation.
- RUN332 focused source/remediation checks: 13/13; Pi environment runtime cases: 7/7; dependency policy: 11/11; documentation hygiene: PASS.
- RUN332 type-safety contract: 8/8 after pretypecheck ordering fix.
- Node 24.15.0 clean `npm ci --legacy-peer-deps`: not run locally; only Node 22.16.0 was available and registry access was unavailable.
- Full typecheck, lint, production build, npm audit and Pi Browser/device acceptance for RUN332: not certified.
- Supabase disposable PostgreSQL rehearsal: blocked pending an authorized temporary branch or equivalent PostgreSQL 17 environment.
- GitHub branch protection/ruleset: not enabled; current integration lacks required admin permission.
- Vercel: no RUN332 deployment; no production deployment; no Mainnet action.

**Release decision: NOT APPROVED.** Do not run `supabase db push`, do not apply the held migrations, do not promote to production, and do not enable payout or reward execution until the migration history is recovered/reconciled and the full release gates pass.

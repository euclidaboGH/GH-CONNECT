> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.** This worklog records the completed 0.338.102 RUN373–RUN375 release and is retained unchanged as historical evidence. The current source version and follow-on work are recorded in `docs/UPGRADE-WORKLOG-0.338.104.md`.

# Upgrade worklog — 0.338.102 RUN373–RUN374

**Date:** 2026-11-19  
**Baseline:** user-supplied `GREENHAVEN-0_338_101-RUN372-FIELD-RESEARCH-DISCONNECTED-2026-11-19.zip`  
**Package identity:** `gh-connect@0.338.102`  
**Scope:** Phase 1–2 Pi authentication UX remediation and Phase 3 API security/performance hardening.

## Implemented changes

1. Improved the Pi authentication error message for the observed generic SDK rejection in a recognized Sandbox iframe. It now points operators to Testnet app registration, exact hosted URL registration, Pi Utilities Sandbox authorization and reopening through Pi → Develop.
2. Kept baseline Pi sign-in on the `username` scope only. Payment and wallet scopes remain isolated to their explicit consent/transaction flows.
3. Preserved mandatory server verification of the Pi access token through Platform API `/v2/me` before GreenHaven identity/session creation.
4. Added the RUN373 regression gate (8/8) and registered it in prebuild, static verification, pretypecheck and prelint.
5. Added durable per-user throttling to social post editing: 20 edits per user per minute, fail-closed when the durable rate-limit service is unavailable.
6. Added explicit 10-second Supabase request deadlines to both social post-edit lookup and update calls, with bounded no-store 503 failure responses.
7. Replaced direct announcement admin-secret string equality with the shared 32-byte minimum, constant-time operator-key verifier and a dedicated header/environment-variable pair.
8. Added durable throttles for announcement publishing (10/minute globally for the operator key) and user read-state writes (60/minute per authenticated user); bounded announcement Supabase requests to 10 seconds.
9. Replaced the bespoke 16-character GHPV settlement key check with the shared 32-byte minimum operator-key verifier. The settlement remains system-only and never mints GHC from votes.
10. Updated stale source checks to validate the centralized Supabase RPC timeout implementation and shared operator-key helper rather than matching obsolete inline source patterns.
11. Added the RUN374 regression gate (14/14) and registered it in prebuild, static verification, pretypecheck and prelint.
12. Prepared `supabase/proposals/20261119_revoke_client_select_identity_session_tables_review.sql` to remove only redundant client SELECT grants on `gh_pi_identities` and `gh_sessions`, with postflight assertions that service_role access remains. It is not a canonical migration and must not be applied directly.
13. Synchronized package.json, package-lock.json, `lib/app-release.ts`, README, source-truth documents, verified manifest and current release notes to `0.338.102`.

## Verification

- RUN373 Pi-auth actionable rejection: 8/8 PASS.
- Existing Pi-auth contracts: RUN338 25/25, RUN342 6/6, RUN344 10/10, RUN370 7/7, RUN371 9/9 PASS.
- RUN374 API hardening: 14/14 PASS.
- Admin body/operator secret checks: 8/8 PASS.
- Economy RPC deadline contract: 12/12 PASS; all privileged RPCs use per-call `timeoutMs` enforced by the central Supabase transport.
- Core Web Vitals/performance checks: 17/17 PASS.
- Phase 4 identity/authentication checks: 16/16 PASS.
- API CSRF contract: 7/7 PASS; domain mutation ownership: 185 routes assigned; media hardening: 27/27 PASS; withdrawal health: 25/25 PASS.
- RUN375 identity/session ACL proposal: 11/11 PASS; it remains outside canonical migrations.
- Full `npm run verify:static`: 63/63 PASS.
- Project truth: 11/11 PASS; release hygiene: 17/17 PASS; migration inventory synchronized at 231 source migrations (122 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 106 REVIEW_REQUIRED).
- Static RLS source coverage: 175 executable table names; 138 tables with policy definitions; 37 explicit no-policy allowlist entries. SECURITY DEFINER source audit: 488 declarations with fixed search_path and PUBLIC execute revocation.

## Known limits / operator gates

- The Pi SDK still rejects `Pi.authenticate()` before returning a token; GreenHaven's `/api/auth/pi` route is not reached. The source change improves diagnostics but cannot repair external Pi Portal registration, URL allowlisting or Sandbox authorization.
- Testnet `gh_pi_identities` and `gh_sessions` still have redundant client-role SELECT ACL grants despite deny-all RLS policies. A revoke is recommended after exact migration-history reconciliation. It was not applied or added to migration history because the Supabase CLI was unavailable and Testnet history is materially drifted from the local source inventory.
- Mainnet remains empty and untouched. No migration replay, `db push`, migration-history repair, SQL schema mutation, Supabase data write, GitHub push, Vercel deployment, payment, payout or financial operation occurred.
- This environment runs Node 22.16.0 while the project requires Node 24.15.0, and `node_modules` is absent. Full dependency-backed typecheck, lint, Next production build and live Pi Browser/two-account E2E remain unverified.

**Release decision: NOT APPROVED.** This worklog records source-level changes and targeted checks only; it is not a deployment or Mainnet certification.

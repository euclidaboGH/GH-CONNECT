# GreenHaven source authority — 0.338.97 remediation candidate (2026-11-17)

**Current source version:** `0.338.97`
**SHA-256:** `dcab57c8f9b43d6f9476745fa8d862b3d26ab33938e00b0bea67132ca2e523ec`  
**User-designated source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Package identity:** `gh-connect@0.338.97` (user-facing brand: GREENHAVEN).

This is the exact archive supplied by the user on 2026-11-17 and is the sole authoritative source for subsequent work. Its project history identifies it as an in-place derivative of the prior 0.338.90 source. Continue in place; use the existing GitHub repository and Vercel project. Preserve existing hidden CI files from the actual repository because the supplied archive omits `.github/workflows/ci.yml` and `.gitignore`.

## Latest implementation

Public respondent and field-session scoped evidence uploads are implemented in source, with signed upload URLs, project/report-bound tokens, streamed SHA-256, file signature checks, quarantine-first storage records, central admin review UI, scanner queue/HMAC callback contract, active geographic-unit validation and append-only SHA-256 evidence event chains. The scanner provider itself is not deployed or configured, so uploads remain quarantined until an external trusted scanner is connected and reports clean. Do not claim malware scanning is operational.

## Held migrations

`20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql` and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` are REVIEW_REQUIRED and unapplied. They must be applied in dependency order after target migration-history reconciliation and schema validation. Testnet's earlier Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Legacy documents

Superseded historical upgrade worklogs are retained under `docs/archive/upgrade-worklogs/` rather than duplicated in the active `docs/` root. These legacy documents preserve historical context only; they do not supersede this source-of-truth file, the current executable source, or the current release evidence.

## Release controls

No push or deployment was performed. Full Node 24.15.0 install/typecheck/lint/build, browser/device acceptance, scanner integration, live Testnet upload/hash/chain verification and populated geographic hierarchy checks remain required. Production NOT APPROVED.

## 2026-11-17 Vercel/GitHub remediation candidate

A local, unpushed remediation candidate restores the existing default-branch `.github/workflows/ci.yml` into the `testnet` source tree because the deployed `testnet` commit lacked that file and the release-integrity prebuild crashed with `ENOENT`. It also adds a root `.gitignore`, makes Run #300 report missing CI metadata cleanly, fixes its case-insensitive `NOT APPROVED` assertions, and synchronizes current release pointers in the audit/acceptance fixtures. The authoritative source archive and SHA-256 above remain the baseline from which this candidate is derived; this addendum does not claim the candidate has been pushed or deployed.

Dependency upgrades are not yet applied: the registry was unreachable, so no refreshed npm audit JSON or reproducible package-lock update could be generated. The deprecated Stellar packages remain transitive through `pi-backend@0.1.3` and must not be overridden without Pi Testnet compatibility evidence. Full Node 24.15.0 install, all 358 prebuild checks, typecheck, lint, build and browser/device acceptance remain required. Production remains NOT APPROVED.

## 2026-11-17 follow-up audit of GitHub `testnet` commit `cecff93`

The newer Vercel log is for `cecff93b5995a10665bb893fa6f70826a6830533`. It confirms the missing CI workflow on `testnet` and four failed Run #300 assertions. The commit diff additionally contains unresolved merge-conflict markers across 14 files covering the migration manifest, verified manifest, source-of-truth/release docs, service registry, social RPC transport, migration inventory generator and Testnet apply-order guide. The archive-derived candidate is clean; those branch files must be reconciled from this authoritative 0.338.92 source rather than manually choosing conflict sides.

The candidate restores the trusted read-only CI workflow and `.gitignore`, hardens Run #300, repairs malformed shared Supabase RPC/REST call sites and dynamic RPC-name interpolation, and extends source checks for conflict markers and malformed dynamic RPC names. It preserves identity immutability, server-owned media authorization, conversation membership authorization, ledger authority and non-spending membership recovery. Candidate verification: Run #300 22/22; Run #301 20/20; Run #250 10/10; RLS source coverage 174 tables; SECURITY DEFINER source audit 481 declarations; migration manifest 229/229; project truth 11/11; Vercel hygiene 17/17; Phase 4 identity snapshot 8/8 plus 13 runtime assertions; dependency-lock integrity PASS.

GitHub's connected write operation returned HTTP 403 (`Resource not accessible by integration`), so the candidate remains local and the live `testnet` branch and Vercel deployment have not been changed. Reauthorize the GitHub integration with repository Contents/commit write access or have a repository maintainer apply the candidate. Supabase inspection was read-only: Testnet has 16 live RLS/no-policy INFO findings and 120 unused-index INFO findings requiring workload-aware review; Mainnet has a SECURITY DEFINER execute-ACL warning for `public.rls_auto_enable()`. No database change was made. Mainnet and all three held migrations remain untouched.

The Vercel npm report's 22 vulnerabilities and package deprecation warnings remain unresolved pending a registry-connected Node 24 clean install, current `npm audit --json`, tested dependency/lockfile updates and full 358-check/typecheck/lint/Next build. The project remains NOT APPROVED for production.


## 2026-11-17 Quiet Premium transformation candidate — 0.338.93

The local source-only derivative is now `gh-connect@0.338.93`, based on the authoritative 0.338.92 archive above. It adds the Quiet Premium design layer for the eleven approved product priorities and a responsive, six-workstream Coming Soon development brief for all 30 unreleased ecosystem services. Registry state remains 42 services / 12 Active / 30 Coming Soon; every Coming Soon destination remains `none`. This is not a feature activation or release-readiness claim. See `docs/QUIET-PREMIUM-TRANSFORMATION-0.338.93.md`. Node 24.15.0 dependency-backed checks and browser/device visual acceptance remain outstanding. GitHub write authorization is still blocked: the connected identity exposes no accessible App installations or repositories and the earlier write returned HTTP 403. No push, deployment, Supabase mutation, migration application or Mainnet change occurred. Production remains NOT APPROVED.

The 0.338.93 candidate adds one independently registered UI regression gate to the prebuild manifest; the current manifest now enumerates 359 checks (dry-run enumeration only, not execution). The new gate verifies the eleven priority-module roots, shared theme-aware premium tokens, focus/reduced-motion support, the 30-track Coming Soon disclosure, and the unchanged 12 Active / 30 Coming Soon registry.


## 2026-11-17 Run #312 notification/RPC follow-up candidate

The working source-only candidate `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip` continues from the 0.338.93 repair candidate without changing the parent archive authority or claiming a new production release. It resolves the additional notification RPC and duplicate-import diagnostics surfaced by the next CI typecheck pass. Push and unified notification RPC payloads now have explicit runtime record validation; unified inbox list/create JSON responses are distinguished from the integer scalar return values of unread-count and mark-read SQL functions. Notification-center and push-subscription responses are consistently `private, no-store`; malformed request JSON is rejected before property access. The Pi listing readiness module now imports the canonical REST client once.

Candidate verification: Run #312 repair contract 28/28; Phase 6 performance/accessibility 23/23; scoped evidence engine 25/25; Vercel build hygiene 17/17; changed TypeScript syntax transpilation passed; focused strict TypeScript compilation of the changed notification routes/RPC modules passed using temporary dependency declarations. The full `npm run verify:static` attempt exceeded the available execution window and is not claimed as complete. Full project typecheck/lint/build remain blocked in this workspace by Node 22.16.0 (project requires Node 24.15.0) and incomplete dependencies. No GitHub push, Vercel deployment, Supabase mutation, migration application, Mainnet action, financial mutation, or Coming Soon service activation occurred. All 30 Coming Soon services remain disabled; production remains NOT APPROVED.


## 0.338.96 audit remediation derivative

This local candidate is derived from the exact user-designated 0.338.93 RUN312 archive. It fixes the confirmed Vercel release-hygiene blocker by adding a credential-free `.env.example`, aligns the essential-controls navigation contract to the six visible shell destinations, and updates stale navigation regression assertions. The package, lockfile and app release identity are synchronized at 0.338.96. The source archive above remains the user's baseline; this derivative is a working candidate, not a live deployment.

Live Supabase inspection: Testnet has 16 RLS-enabled/no-policy informational findings. Catalog inspection shows five tables restricted to postgres only, three with postgres/service_role grants, and eight with anon/authenticated/service_role grants but no policies (therefore no row access through RLS). Do not add broad policies to silence the advisor; review grants and intended server-only routes table-by-table. The 120 unused-index findings are not deletion instructions. Mainnet's `rls_auto_enable()` is an enabled `ddl_command_end` event-trigger function with pinned `search_path=pg_catalog`; its ACL includes anon/authenticated, but the function's event-trigger binding means this is not evidence of an ordinary PostgREST RPC. Mainnet remains untouched pending separate platform review.

Vercel's latest build log confirms the current 0.338.93 preview failure is prebuild check 23/359: `.env.example` is missing. A subsequent deployment log failed a stale feed-navigation contract; the check is being aligned to the actual six-item shell. The marketplace check passes against this archive. Full Node 24.15.0 install, complete 359-check run, typecheck, lint, Next build, browser/device acceptance and scanner-provider integration remain unverified. GitHub push and Vercel deployment have not been performed. Production remains NOT APPROVED.


## 0.338.96 Run 313 working derivative

The current local candidate advances the 0.338.94 remediation derivative with explicit in-memory transaction executors/compensators, reverse-order rollback, failed-compensation visibility, bounded completed-history lookup, and an atomic single-update local backup restore. The coordinator is expressly not a database transaction and is not used for financial authority. A dedicated source gate (8 assertions) and runtime simulation (12 assertions) are registered in prebuild/static verification. The user-designated 0.338.93 RUN312 archive remains the source-of-truth archive; this is a local working candidate only. No push, deployment, Supabase mutation, migration application, Mainnet or payment operation occurred.


## 0.338.96 Run 314 working derivative
Run 314 adds 30 screen-level UI and interaction refinements across active modules, with responsive rails and grids, improved message composer and bubble sizing, wallet/payment sheet safe areas, and profile/feed/rewards content hierarchy. These are presentation-level changes only. The user-designated 0.338.93 archive remains the authoritative starting archive; this derivative is not pushed or deployed.

## Held migrations

`20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql` and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` are REVIEW_REQUIRED and unapplied. They must be applied in dependency order after target migration-history reconciliation and schema validation. Testnet's earlier Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Legacy documents

Superseded historical upgrade worklogs are retained under `docs/archive/upgrade-worklogs/` rather than duplicated in the active `docs/` root. These legacy documents preserve historical context only; they do not supersede this source-of-truth file, the current executable source, or the current release evidence.

## Release controls

No push or deployment was performed. Full Node 24.15.0 install/typecheck/lint/build, browser/device acceptance, scanner integration, live Testnet upload/hash/chain verification and populated geographic hierarchy checks remain required. Production NOT APPROVED.

## 2026-11-17 Vercel/GitHub remediation candidate

A local, unpushed remediation candidate restores the existing default-branch `.github/workflows/ci.yml` into the `testnet` source tree because the deployed `testnet` commit lacked that file and the release-integrity prebuild crashed with `ENOENT`. It also adds a root `.gitignore`, makes Run #300 report missing CI metadata cleanly, fixes its case-insensitive `NOT APPROVED` assertions, and synchronizes current release pointers in the audit/acceptance fixtures. The authoritative source archive and SHA-256 above remain the baseline from which this candidate is derived; this addendum does not claim the candidate has been pushed or deployed.

Dependency upgrades are not yet applied: the registry was unreachable, so no refreshed npm audit JSON or reproducible package-lock update could be generated. The deprecated Stellar packages remain transitive through `pi-backend@0.1.3` and must not be overridden without Pi Testnet compatibility evidence. Full Node 24.15.0 install, all 358 prebuild checks, typecheck, lint, build and browser/device acceptance remain required. Production remains NOT APPROVED.

## 2026-11-17 follow-up audit of GitHub `testnet` commit `cecff93`

The newer Vercel log is for `cecff93b5995a10665bb893fa6f70826a6830533`. It confirms the missing CI workflow on `testnet` and four failed Run #300 assertions. The commit diff additionally contains unresolved merge-conflict markers across 14 files covering the migration manifest, verified manifest, source-of-truth/release docs, service registry, social RPC transport, migration inventory generator and Testnet apply-order guide. The archive-derived candidate is clean; those branch files must be reconciled from this authoritative 0.338.92 source rather than manually choosing conflict sides.

The candidate restores the trusted read-only CI workflow and `.gitignore`, hardens Run #300, repairs malformed shared Supabase RPC/REST call sites and dynamic RPC-name interpolation, and extends source checks for conflict markers and malformed dynamic RPC names. It preserves identity immutability, server-owned media authorization, conversation membership authorization, ledger authority and non-spending membership recovery. Candidate verification: Run #300 22/22; Run #301 20/20; Run #250 10/10; RLS source coverage 174 tables; SECURITY DEFINER source audit 481 declarations; migration manifest 229/229; project truth 11/11; Vercel hygiene 17/17; Phase 4 identity snapshot 8/8 plus 13 runtime assertions; dependency-lock integrity PASS.

GitHub's connected write operation returned HTTP 403 (`Resource not accessible by integration`), so the candidate remains local and the live `testnet` branch and Vercel deployment have not been changed. Reauthorize the GitHub integration with repository Contents/commit write access or have a repository maintainer apply the candidate. Supabase inspection was read-only: Testnet has 16 live RLS/no-policy INFO findings and 120 unused-index INFO findings requiring workload-aware review; Mainnet has a SECURITY DEFINER execute-ACL warning for `public.rls_auto_enable()`. No database change was made. Mainnet and all three held migrations remain untouched.

The Vercel npm report's 22 vulnerabilities and package deprecation warnings remain unresolved pending a registry-connected Node 24 clean install, current `npm audit --json`, tested dependency/lockfile updates and full 358-check/typecheck/lint/Next build. The project remains NOT APPROVED for production.


## 2026-11-17 Quiet Premium transformation candidate — 0.338.93

The local source-only derivative is now `gh-connect@0.338.93`, based on the authoritative 0.338.92 archive above. It adds the Quiet Premium design layer for the eleven approved product priorities and a responsive, six-workstream Coming Soon development brief for all 30 unreleased ecosystem services. Registry state remains 42 services / 12 Active / 30 Coming Soon; every Coming Soon destination remains `none`. This is not a feature activation or release-readiness claim. See `docs/QUIET-PREMIUM-TRANSFORMATION-0.338.93.md`. Node 24.15.0 dependency-backed checks and browser/device visual acceptance remain outstanding. GitHub write authorization is still blocked: the connected identity exposes no accessible App installations or repositories and the earlier write returned HTTP 403. No push, deployment, Supabase mutation, migration application or Mainnet change occurred. Production remains NOT APPROVED.

The 0.338.93 candidate adds one independently registered UI regression gate to the prebuild manifest; the current manifest now enumerates 359 checks (dry-run enumeration only, not execution). The new gate verifies the eleven priority-module roots, shared theme-aware premium tokens, focus/reduced-motion support, the 30-track Coming Soon disclosure, and the unchanged 12 Active / 30 Coming Soon registry.


## 2026-11-17 Run #312 notification/RPC follow-up candidate

The working source-only candidate `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip` continues from the 0.338.93 repair candidate without changing the parent archive authority or claiming a new production release. It resolves the additional notification RPC and duplicate-import diagnostics surfaced by the next CI typecheck pass. Push and unified notification RPC payloads now have explicit runtime record validation; unified inbox list/create JSON responses are distinguished from the integer scalar return values of unread-count and mark-read SQL functions. Notification-center and push-subscription responses are consistently `private, no-store`; malformed request JSON is rejected before property access. The Pi listing readiness module now imports the canonical REST client once.

Candidate verification: Run #312 repair contract 28/28; Phase 6 performance/accessibility 23/23; scoped evidence engine 25/25; Vercel build hygiene 17/17; changed TypeScript syntax transpilation passed; focused strict TypeScript compilation of the changed notification routes/RPC modules passed using temporary dependency declarations. The full `npm run verify:static` attempt exceeded the available execution window and is not claimed as complete. Full project typecheck/lint/build remain blocked in this workspace by Node 22.16.0 (project requires Node 24.15.0) and incomplete dependencies. No GitHub push, Vercel deployment, Supabase mutation, migration application, Mainnet action, financial mutation, or Coming Soon service activation occurred. All 30 Coming Soon services remain disabled; production remains NOT APPROVED.


## 0.338.96 audit remediation derivative

This local candidate is derived from the exact user-designated 0.338.93 RUN312 archive. It fixes the confirmed Vercel release-hygiene blocker by adding a credential-free `.env.example`, aligns the essential-controls navigation contract to the six visible shell destinations, and updates stale navigation regression assertions. The package, lockfile and app release identity are synchronized at 0.338.96. The source archive above remains the user's baseline; this derivative is a working candidate, not a live deployment.

Live Supabase inspection: Testnet has 16 RLS-enabled/no-policy informational findings. Catalog inspection shows five tables restricted to postgres only, three with postgres/service_role grants, and eight with anon/authenticated/service_role grants but no policies (therefore no row access through RLS). Do not add broad policies to silence the advisor; review grants and intended server-only routes table-by-table. The 120 unused-index findings are not deletion instructions. Mainnet's `rls_auto_enable()` is an enabled `ddl_command_end` event-trigger function with pinned `search_path=pg_catalog`; its ACL includes anon/authenticated, but the function's event-trigger binding means this is not evidence of an ordinary PostgREST RPC. Mainnet remains untouched pending separate platform review.

Vercel's latest build log confirms the current 0.338.93 preview failure is prebuild check 23/359: `.env.example` is missing. A subsequent deployment log failed a stale feed-navigation contract; the check is being aligned to the actual six-item shell. The marketplace check passes against this archive. Full Node 24.15.0 install, complete 359-check run, typecheck, lint, Next build, browser/device acceptance and scanner-provider integration remain unverified. GitHub push and Vercel deployment have not been performed. Production remains NOT APPROVED.


## 0.338.96 Run 313 working derivative

The current local candidate advances the 0.338.94 remediation derivative with explicit in-memory transaction executors/compensators, reverse-order rollback, failed-compensation visibility, bounded completed-history lookup, and an atomic single-update local backup restore. The coordinator is expressly not a database transaction and is not used for financial authority. A dedicated source gate (8 assertions) and runtime simulation (12 assertions) are registered in prebuild/static verification. The user-designated 0.338.93 RUN312 archive remains the source-of-truth archive; this is a local working candidate only. No push, deployment, Supabase mutation, migration application, Mainnet or payment operation occurred.


## 0.338.96 Run 314 working derivative
Run 314 adds 30 screen-level UI and interaction refinements across active modules, with responsive rails and grids, improved message composer and bubble sizing, wallet/payment sheet safe areas, and profile/feed/rewards content hierarchy. These are presentation-level changes only. The user-designated 0.338.93 archive remains the authoritative starting archive; this derivative is not pushed or deployed.

## 0.338.97 Run 315 working derivative
This candidate fixes the supplied CI lint/build errors and warning, corrects the stale product-design gate, and ensures a diagnostics artifact exists after early build failure. The user's uploaded 0.338.93 archive remains the authoritative baseline; 0.338.97 is a local working derivative only. No GitHub push, Vercel deployment, Supabase mutation, or financial operation was performed.

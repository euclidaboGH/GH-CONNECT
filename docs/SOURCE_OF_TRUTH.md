# GreenHaven source authority — 0.338.99 RUN336 GitHub/Vercel build cleanup (2026-11-18)

**Current source version:** `0.338.99`
**Current user-provided archive:** `GREENHAVEN-0.338.99-RUN331-PHASE1-6-GAP-REGISTER-PHASE7-COMMUNITIES.zip`  
**SHA-256 of RUN331 archive:** `851ac3a540b76572b1325c6e06a35de069649f37db5cb11d24aca124d239fafa`  
**Current local working derivative:** RUN336 GitHub/Vercel build cleanup, based on RUN335/RUN333; source-only, not pushed or deployed.  
**Package identity:** `gh-connect@0.338.99` (user-facing brand: GREENHAVEN).

RUN331 is the latest user-provided starting archive for RUN332. The earlier RUN324 archive and RUN325–RUN330 derivatives remain historical lineage only. Preserve all existing CI, identity, wallet, payment and migration boundaries. Do not treat the RUN332 candidate as the live GitHub branch or Vercel deployment.

## RUN336 GitHub / Vercel build cleanup

RUN336 addresses the seven TypeScript diagnostics in the supplied GitHub Actions log: the election tally route now explicitly normalizes optional counts to `number | null | "invalid"` and required counts to `number`; the app shell imports the canonical public-route helper; the field assignment UI type includes `assignmentId`; Communities imports `useRef`, uses the resolved `joined` membership state and gives `reduce` a numeric accumulator. Research Studio callback dependencies remain complete with no lint suppression. RUN336 cleanup checks pass 12/12, the updated RUN335 tally gate passes 8/8, and the complete `npm run verify:static` suite passes. Full dependency-backed typecheck/lint/Next build remains pending on supported Node 24.15.x. Remaining upstream dependency warnings and why they were not force-overridden are documented in `docs/RUN336-GITHUB-VERCEL-BUILD-CLEANUP-2026-11-18.md`.

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

## 0.338.98 Run 315 working derivative
This candidate fixes the supplied CI lint/build errors and warning, corrects the stale product-design gate, and ensures a diagnostics artifact exists after early build failure. The user's uploaded 0.338.93 archive remains the authoritative baseline; 0.338.98 is a local working derivative only. No GitHub push, Vercel deployment, Supabase mutation, or financial operation was performed.


## 0.338.99 Run 317 working derivative

This local candidate addresses the verified 0.338.98 Next.js production compile error: shared ID generation now uses Web Crypto without Node-only imports, shared consumers use static imports, and push endpoint hashing is isolated to a server-only module. GitHub Actions confirmed the preceding 0.338.98 typecheck and ESLint passed; the production build failed on `node:crypto`. Run 317 adds a 9/9 boundary gate and preserves the 19/19 push contract tests. The user-designated 0.338.93 archive remains the authoritative baseline; 0.338.99 is a local derivative only. No push, deploy, Supabase mutation or financial operation was performed.


## 2026-11-17 Run 324 local working derivative

The local source candidate derived from RUN323 adds timed examination lifecycle/review, owner-scoped election contest/candidate/agent administration, and Phase 3 marketplace/poll/post-engagement hardening. It is source-only. The Research Intelligence migration remains REVIEW_REQUIRED and unapplied; atomic election tally submission, populated geography data, scanner-provider execution, Node 24.15 dependency-backed build checks and Testnet/device acceptance remain blockers. Do not treat this derivative as deployed or production-approved. See `docs/RUN324-PHASE2-EXAM-ELECTION-AND-PHASE3-QUALITY-2026-11-17.md`.

## 2026-11-18 RUN326 local continuation

The current working derivative continues from the user-designated RUN324 archive through RUN325 and RUN326. RUN326 adds an authenticated election tally submission API and a REVIEW_REQUIRED SQL proposal for a single-transaction tally/candidate-vote/audit write with scoped-agent authorization, geography/candidate validation, arithmetic checks and exact-payload idempotency. The proposal depends on the still-held Research Intelligence foundation migration; it is not a generated migration and has not been applied. It also hardens Messaging idempotency so reusing a client message ID with changed body/reply/shared-post/attachment payload returns HTTP 409 rather than silently returning an unrelated prior message. See `docs/RUN326-PHASE2-TALLY-PHASE3-MESSAGING-START.md`. Focused source gates pass; full Node 24.15 dependency-backed typecheck/lint/build, disposable PostgreSQL rehearsal, held migration review, geography import, scanner integration and Pi Browser/device acceptance remain outstanding. No GitHub push, Vercel deployment, Supabase mutation, migration application or Mainnet operation occurred. Production remains NOT APPROVED.


## 2026-11-18 RUN327 Phase 3 source closeout and Phase 4 discovery

RUN327 continues from the verified RUN326 working archive. The RUN326 Phase 3 Feed, Community, Messaging and Marketplace source gates were rerun; messaging idempotency 10/10, Feed quality 25/25, durable Feed preferences 13/13, Community poll accessibility 10/10, engagement aggregate hardening 6/6, Community completion 21/21, Community pagination 12/12, Marketplace search 6/6, Marketplace saved addresses 29/29, creator/media hardening 13/13, upload cancellation/identity 12/12, draft recovery 11/11, durable media URL 7/7 and upload recovery 9/9 passed. Their runtime helper tests passed, and the repository `npm run verify:static` command completed successfully. This closes the RUN326 Phase 3 source work only; held migrations, live multi-account/Testnet, Node 24 dependency-backed typecheck/lint/build and browser/device acceptance remain outstanding.

Phase 4 discovery identified multiple incompatible Phase 4 tracks in the archive: Identity & Authentication, social Community posts/discussion consistency, Messenger community communications/governance, and older financial/cart/profile tracks. RUN327 records the scope conflict and does not silently select one. Phase 4 implementation awaits the user's selection of the intended track.

No GitHub push, Vercel deployment, Supabase mutation, migration application, Mainnet action, payment, payout, reward or account mutation occurred. Production remains NOT APPROVED. See `docs/RUN327-PHASE3-SOURCE-CLOSEOUT-PHASE4-DISCOVERY-2026-11-18.md`.

## 2026-11-18 RUN328 Phase 4 coordinated source implementation

The RUN328 local derivative is packaged as `GREENHAVEN-0.338.99-RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING.zip` and continues from the RUN327 Phase 3 closeout archive. It implements all three Phase 4 tracks selected by the user: Identity & Authentication, Community discussion/participation, and Messenger community communications. It corrects step-up rotation/proof ordering, adds a held atomic session-cap RPC (runtime opt-in remains disabled), adds a privacy-aware paginated Community member directory, adds group creation from an existing DM with recipient-accepted invitations, and adds consent-based sharing of only the authenticated actor's public GreenHaven profile. Existing canonical Community post rendering, announcements, events, resources and moderation remain in place and are regression-checked. See `docs/RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING-2026-11-18.md`.

The new SQL remains proposal-only at `supabase/proposals/20261118_phase4_identity_group_contact.sql`; it is not a migration and has not been applied. New group/contact/member-directory routes fail closed until their RPC/table dependencies are approved and live. The atomic session-cap runtime flag must remain unset until the SQL is rehearsed and applied. Source verification `npm run verify:static` passed. Node 24.15.x dependency-backed install/typecheck/lint/build, disposable PostgreSQL rehearsal, migration history reconciliation and two-account Testnet/device acceptance remain outstanding. No GitHub push, Vercel deployment, Supabase mutation, migration application or Mainnet operation occurred. Production remains NOT APPROVED.


## 2026-11-18 RUN329 Phase 4 source closeout and Phase 5 five-run / 50-upgrade programme

RUN329 records source-level closeout of the three Phase 4 tracks selected by the user: Identity & Authentication, Community discussion/participation, and Messenger community communications. Focused identity integration 17/17, identity/authentication 16/16, coordinated Phase 4 32/32, community boundaries 9/9, community completion 21/21, pagination 12/12, Messenger community 14/14, Messenger Phase 1 closeout 19/19, held-migration readiness 6/6 source checks, messaging idempotency 10/10 and atomic tally source contract 20/20 passed in the local workspace. This is source closeout only; supported Node 24.15 dependency-backed build, PostgreSQL rehearsal, migration history/catalog reconciliation and authenticated device/Testnet acceptance remain outstanding.

Phase 5 starts with the coordinated RUN327–RUN331 50-upgrade programme in `docs/RUN329-PHASE4-CLOSEOUT-PHASE5-50-UPGRADE-PROGRAM-2026-11-18.md`. It defines exactly ten major upgrades each for migration dependency/rehearsal, election tally and independent reconciliation, authoritative geography/scanner integration, Feed/Community/Messaging, and Marketplace/checkout. The register is scope and acceptance criteria, not a claim that all 50 upgrades have shipped. No SQL migration, Testnet/Mainnet mutation, payment/payout/reward/account mutation, GitHub push or Vercel deployment occurred. Mainnet remains untouched; production NOT APPROVED.

## 2026-11-18 RUN330 Phase 5 gate reconciliation and Phase 6 kickoff

RUN330 reviews the RUN327–RUN331 Phase 5 programme against the actual repository source and regression checks. Marketplace seller/SKU/fulfilment/order foundations, Feed/Community/Messaging foundations and scoped evidence/scanner callback contracts have substantial source coverage. However, Phase 5 is **not closed for release**: RUN327 still requires a disposable PostgreSQL 17 rehearsal and exact target catalog/history reconciliation; RUN328 still requires the agent tally-entry UI and independent multi-agent reconciliation; RUN329 still requires a provenance-backed, licensed authoritative geography dataset and a configured trusted malware-scanner provider/worker. No election result is certified, and unknown/failed/timed-out evidence remains quarantined. Mainnet remains disabled and untouched.

RUN330 starts the established Phase 6 Profile and Identity performance track. Relationship-index keys now reject control characters and identifiers longer than 256 characters; each derived relationship set is capped at 50,000 unique IDs; batch hydration defaults to 500 IDs and has an absolute 5,000-ID cap. Runtime tests cover malformed keys, caller limits, hard caps, per-domain cache isolation and immutable-source invalidation. The block-first relationship policy and exclusion of wallet/ledger/payment data remain unchanged. The dedicated Phase 6 source gate passes 23/23 and runtime contract passes 23 assertions. Full `npm run verify:static` passed after RUN330 (exit 0); `npm run prebuild:checks` remains blocked because TypeScript cannot be resolved without `node_modules`. This is a local source-only derivative; Node 24.15.x typecheck/lint/build and browser/device acceptance remain required. No GitHub push, Vercel deployment, Supabase mutation, migration application, payment/payout/reward/account mutation or Mainnet action occurred. Production remains NOT APPROVED.

## 2026-11-18 RUN331 Phase 1–6 gap register and Phase 7 Communities kickoff

RUN331 continues from the RUN330 local working derivative. It reconciles Phase 1–6 source implementation against the actual remaining release evidence and does not mark externally blocked work complete. It starts the Phase 7 Communities transformation with account-scoped local membership/board cache keys, bounded cache parsing, legacy unscoped-key retirement, `IdentityService` account-switch subscription, previous-account write fencing, selected-community/snapshot clearing and identity-fenced directory reloads. Local cache data remains non-authoritative; server/domain authorization remains the sole source for membership, roles and content access. New tests pass 13/13 runtime assertions and 12/12 source checks and are registered in `verify:static` and `prebuild:checks`. Phase 1–6 release gaps remain explicitly documented: real Pi Browser acceptance; PostgreSQL rehearsal and migration history reconciliation; approved geography and scanner infrastructure; field-agent tally UI and independent reconciliation; Testnet checkout; multi-account/device acceptance; and supported Node 24.15.x build. No SQL, database, financial, account, GitHub, Vercel or Mainnet mutation occurred. Production remains NOT APPROVED. See `docs/RUN331-PHASE1-6-GAP-REGISTER-PHASE7-COMMUNITIES-KICKOFF-2026-11-18.md`.

## 2026-11-18 RUN332 advanced audit and remediation

RUN332 continues from the user-provided RUN331 archive as a source-only remediation candidate. It records a read-only Testnet database audit, GitHub branch/CI audit, Vercel project/deployment audit and the source fixes described in `docs/RUN332-ADVANCED-PROJECT-AUDIT-AND-REMEDIATION-2026-11-18.md`. Testnet currently reports 45 migration-history entries while the source tree contains 229 canonical migration files; exact-version and filename gaps remain unresolved. Twenty applied history entries have no matching source filename in the archive or connected GitHub `testnet` branch. Do not reconstruct or replay these by assumption. The three research/media/scoped-evidence migrations remain held and unapplied pending disposable PostgreSQL 17 rehearsal and catalog/history reconciliation. RUN332 also adds a review-only proposal to revoke redundant authenticated SELECT grants from eight server-only tables; it is not a canonical migration and was not applied.

RUN332 corrects Pi environment-mode precedence, keeps all payment execution flags fail-closed, adds a review-only proposal for redundant authenticated SELECT grants on eight server-only tables, pins GitHub Actions to immutable SHAs, disables persisted checkout credentials and enforces npm audit exit status. Vercel accepted Testnet Preview-only updates for `PI_NETWORK`, `PI_ENV`, `PI_A2U_TESTNET_ONLY` and fail-closed payout/withdrawal/transfer/bonus flags; sensitive values are masked on read-back and a fresh Preview deployment is required to verify runtime behavior. No migration was applied, no GitHub push or Vercel deployment occurred, and Mainnet remains untouched. Production remains NOT APPROVED.


## RUN333 — Existing Testnet security reconciliation (2026-11-18)

RUN333 uses the existing GH Connect Supabase Testnet project directly; no extra branch was created. Applied migration `20261118033839_revoke_client_select_on_server_only_tables` to revoke redundant SELECT grants from `PUBLIC`, `anon`, and `authenticated` on eight RLS-enabled server-only tables. Postflight verified that all eight retain RLS, all client SELECT privileges are absent, and `service_role` retains SELECT/INSERT/UPDATE/DELETE. The Testnet migration history now contains 46 entries. The canonical migration inventory, source manifest, verified manifest, checklist and Testnet apply-order guide have been regenerated to 230 files. The current 46-row history map is `docs/RUN333-MIGRATION-HISTORY-RECONCILIATION.csv`; the RUN332 45-row map remains a historical snapshot. Twenty applied history entries still have no matching source filename and eleven same-slug/different-version candidates remain unverified. The three research/media/scoped-evidence migrations remain held. RUN333 also implements the missing authenticated field-agent tally desk and owner/reviewer-only read-only independent tally comparison. Submissions remain gated until the atomic RPC and provenance-backed polling-unit data are installed. The held evidence-chain trigger source now serializes per-evidence sequence allocation with a transaction advisory lock so concurrent updates cannot fork the chain; this correction is source-only. `npm run verify:static` passes on Node 22.16.0; Node 24.15.x install/typecheck/lint/build remain unverified. No GitHub push, Vercel deployment or Mainnet operation occurred.


## 2026-11-18 RUN337 GitHub audit / environment-template repair candidate

RUN337 restores the safe root `.env.example` from the parent of GitHub testnet commit `9ceeaeafcf0f4b08c2b390fadfed0111a70ce285`, fixing the prebuild `ENOENT` failure. It corrects the dependency-security workflow so npm audit exit code 1 for valid findings is diagnosed as vulnerabilities, not a generic command failure; the workflow continues to fail closed. RUN337 source gate: 7/7; RUN332 audit source gate: 16/16. The exact GitHub audit artifact records 29 vulnerabilities (2 critical, 21 high, 5 moderate, 1 low). Package manifests and lockfile remain unchanged because npm registry access is unavailable in the local build environment and the official Pi SDK transitive chain needs vendor-compatible remediation. No lock hashes were fabricated, no audit bypass or unsafe SDK override was applied. This candidate is not pushed or deployed. Production remains NOT APPROVED.

# Current project truth — 0.338.99 RUN333 (2026-11-18)

**Current source version:** `0.338.99`  
**Package identity:** `gh-connect@0.338.99`  
**Latest user-provided source archive:** `GREENHAVEN-0.338.99-RUN331-PHASE1-6-GAP-REGISTER-PHASE7-COMMUNITIES.zip`  
**RUN331 archive SHA-256:** `851ac3a540b76572b1325c6e06a35de069649f37db5cb11d24aca124d239fafa`  
**Current local working derivative:** RUN333 Testnet security reconciliation candidate; not pushed or deployed.  
**Current status:** **NOT APPROVED** for production.

## Source authority

RUN331 is the latest user-provided 0.338.99 archive. RUN332 and RUN333 are local source derivatives of that archive; neither has been pushed or deployed. RUN333 uses the existing GH Connect Supabase Testnet project directly and applied one narrow grant-revocation migration, documented in `docs/RUN333-TESTNET-SECURITY-RECONCILIATION-2026-11-18.md`. Testnet now records 46 migration entries; the canonical source inventory contains 230 files. Twenty applied history entries still lack matching source filenames and eleven same-slug/different-version records remain unverified. The three research/media/scoped-evidence migrations remain held. Preview/testnet-only Vercel environment update requests were accepted; sensitive values are masked and runtime verification awaits a fresh preview build. Preserve the existing GreenHaven and Pi identity, wallet and financial boundaries, and migration history.

## RUN333 current Testnet state

- Existing Testnet project only; no additional Supabase branch created.
- Applied `20261118033839_revoke_client_select_on_server_only_tables` and verified that the eight target tables retain RLS, client SELECT privileges are absent, and service-role SELECT/INSERT/UPDATE/DELETE remain.
- Live migration history: 46 entries. Canonical source migration inventory: 230 files. Current mapping: `docs/RUN333-MIGRATION-HISTORY-RECONCILIATION.csv`.
- Historical source gaps remain: 20 applied history entries have no matching filename; 11 same-slug/different-version candidates are unverified. Do not reconstruct or bulk-replay.
- RUN333 adds the authenticated field-agent tally desk, own-assignment acceptance, and owner/reviewer-only read-only independent comparison. Tally submission remains gated on the held atomic RPC and a provenance-backed polling-unit dataset; no result is certified.
- Testnet currently has `gh_research_projects`, but not the dependent research membership, geography, election contest/candidate/assignment/tally tables or atomic tally RPC. The new field-agent desk fails closed until those dependencies are safely installed.
- Three research/media/scoped-evidence migrations remain held. No scanner/geography acceptance is inferred.
- `npm run verify:static` passes on Node 22.16.0. Supported Node 24.15.x install/typecheck/lint/build and browser/device acceptance remain outstanding.
- Mainnet untouched; no GitHub push or Vercel deployment. Production remains NOT APPROVED.

## 0.338.92 implementation

- Public respondents can upload images, video, audio and PDF files to a published project using short-lived signed Storage URLs and a one-hour project/submission-key scoped upload session. Up to five files per submission key are accepted. Files attach to the response only when that exact submission key is submitted.
- Field agents can upload evidence only to a durable report created by the same field-session JTI. Field-session codes do not become GreenHaven accounts or admin credentials.
- The central administrator Evidence Review Centre lists Research and Field Desk evidence and records review decisions. Admin access is checked against `GHC_FIELD_ADMIN_USER_ID`.
- Upload completion streams the object through SHA-256 hashing and checks basic file magic bytes against the claimed MIME type. This is MIME-spoofing resistance, not malware detection.
- All new evidence enters `scan_status=pending` and `verification_status=quarantined`. Content delivery is denied until a trusted scanner reports a matching SHA-256 digest as clean. Scanner queue and HMAC-authenticated callback endpoints are implemented; a separate trusted scanning worker/provider and `GHC_EVIDENCE_SCANNER_SECRET` configuration are still required. No file is claimed to have been malware-scanned in this source-only increment.
- Database triggers append evidence creation, scan and review changes to a restricted append-only SHA-256 hash chain. Hashes are evidence-integrity indicators, not a guarantee of physical authenticity or legal certification.
- Optional geographic-unit references are checked against active `gh_research_geo_units` records. For election-observation projects, supplied geographic IDs must resolve to `level_key='polling_unit'`. No national Nigeria geography dataset, international data package, GPS capture, EXIF verification or polling-unit roster is imported in this increment.

## Migration status

The new evidence workflow depends on three additive migrations, all source-only and REVIEW_REQUIRED at packaging time:

1. `20261116182000_gh_research_intelligence_platform_foundation.sql` — project roles, research evidence base, geographic hierarchy, election/exam/challenge/poll foundations and audit events. Its challenge participation function was reordered after the referenced tables to fix a forward type dependency.
2. `20261116190000_gh_media_evidence_engine.sql` — media asset references and Field Desk evidence relation.
3. `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` — scoped upload sessions, scan/quarantine fields, field-session report binding, geographic metadata and append-only hash-chain events.

The existing Testnet migrations `20261116170409_gh_field_reports_public_intake` and `20261116171144_gh_research_studio_public_forms` remain applied and recorded. The three migrations above remain unapplied and held for review. RUN333 applied only the separate server-only SELECT-grant revocation migration on Testnet. Mainnet was not changed.

## Verification limits

The supported runtime requirement is Node.js `^24.15.0`. Full TypeScript, lint, and Next.js production build verification must run on that supported runtime with the locked dependencies installed. The current source-only workspace does not establish those dependency-backed checks.

The source migration inventory is not evidence of applied migrations; it records repository SQL files and classifications only. RUN333 postflight verified the new Testnet grant migration and its privilege effects; all other source files still require exact target-history/catalog reconciliation before application.

The source includes static contract checks and pure file-signature tests. Full Node 24.15.0 dependency-backed TypeScript, lint, production build and browser/device end-to-end acceptance remain outstanding because the available workspace is Node 22.16.0 and dependencies are not installed. Scanner provider execution, signed upload against Testnet, evidence chain postflight and geographic lookup against populated data are not runtime-verified.

No GitHub push, Vercel deployment, Mainnet migration or financial state change was performed. Source presence does not establish database application, runtime success, scanner execution or test acceptance. Production remains NOT APPROVED.


## 0.338.96 full-project audit remediation candidate

- Added a safe `.env.example` containing blank server-only credential placeholders, explicit public/server-only sections, and disabled Pi payout execution defaults. It contains no real credentials.
- Reconciled the essential-controls navigation list with the actual six visible shell destinations: Home, Discover, Messages, Communities, Cart and Profile. The wallet remains an overlay.
- Updated stale regression assertions that still expected the older five-item navigation contract.
- Updated package, lockfile and in-app release identity to 0.338.96.
- No database schema, migration, RLS policy, payment, payout, wallet balance, Pi execution, production environment or deployment was changed.

Focused source checks: release hygiene 17/17; Run #312 notification repair 28/28; Run #304 filter/search release 30/30; scoped evidence engine 25/25; media evidence engine 22/22; Phase 10 release closure 17/17. Full Node 24.15.0 dependency-backed verification remains outstanding because the available environment is Node 22.16.0 and npm installation did not complete.

## Canonical visible navigation

The current visible shell navigation contains six destinations, in order: Home · Discover · Messages · Communities · Cart · Profile. Matches remains available as a secondary/deep-link tab; Wallet remains an overlay.


## 0.338.96 transaction and interaction hardening (Run 313)

- Replaced the misleading in-memory transaction operation flags with explicit ordered operation executors and reverse-order compensation handlers. Failed operations now trigger compensations for completed operations; incomplete compensation is recorded as `failed`. Completed transaction records are retrievable from bounded history.
- Explicitly documented that this in-memory coordinator is not a database transaction and is never authoritative for wallets, payments, rewards, orders, or entitlements. Financial state remains server/RPC/ledger-owned.
- Backup restore now validates the complete snapshot arrays before applying one consolidated state update, preventing subscribers from observing partial profile/settings/posts/conversations restoration.
- Added Run 313 source and runtime regression gates to prebuild and static verification.
- No live database, wallet, Pi, A2U, Mainnet, GitHub, or Vercel operations were performed. Full Node 24.15.0 build and device acceptance remain required; production remains NOT APPROVED.


## 0.338.96 Run 314 — 30 screen-level experience upgrades
- Added a 30-rule adaptive UI layer for Wallet, payment recovery and sheets, Messages, Communities, Marketplace, Feed, Profile, Rewards, Membership and Settings.
- Added explicit component hooks for the responsive community directory grid, marketplace listing grid, conversation rows/bubbles/composer, wallet scroll region, profile timeline and rewards balance panel.
- No payment, wallet, ledger, reward, membership entitlement, order lifecycle, Pi consent, A2U, migration, or Mainnet authority changed.
- Full Node 24.15.0 dependency-backed checks and visual browser/device acceptance remain required.
## 0.338.92 implementation

- Public respondents can upload images, video, audio and PDF files to a published project using short-lived signed Storage URLs and a one-hour project/submission-key scoped upload session. Up to five files per submission key are accepted. Files attach to the response only when that exact submission key is submitted.
- Field agents can upload evidence only to a durable report created by the same field-session JTI. Field-session codes do not become GreenHaven accounts or admin credentials.
- The central administrator Evidence Review Centre lists Research and Field Desk evidence and records review decisions. Admin access is checked against `GHC_FIELD_ADMIN_USER_ID`.
- Upload completion streams the object through SHA-256 hashing and checks basic file magic bytes against the claimed MIME type. This is MIME-spoofing resistance, not malware detection.
- All new evidence enters `scan_status=pending` and `verification_status=quarantined`. Content delivery is denied until a trusted scanner reports a matching SHA-256 digest as clean. Scanner queue and HMAC-authenticated callback endpoints are implemented; a separate trusted scanning worker/provider and `GHC_EVIDENCE_SCANNER_SECRET` configuration are still required. No file is claimed to have been malware-scanned in this source-only increment.
- Database triggers append evidence creation, scan and review changes to a restricted append-only SHA-256 hash chain. Hashes are evidence-integrity indicators, not a guarantee of physical authenticity or legal certification.
- Optional geographic-unit references are checked against active `gh_research_geo_units` records. For election-observation projects, supplied geographic IDs must resolve to `level_key='polling_unit'`. No national Nigeria geography dataset, international data package, GPS capture, EXIF verification or polling-unit roster is imported in this increment.

## Migration status

The new evidence workflow depends on three additive migrations, all source-only and REVIEW_REQUIRED at packaging time:

1. `20261116182000_gh_research_intelligence_platform_foundation.sql` — project roles, research evidence base, geographic hierarchy, election/exam/challenge/poll foundations and audit events. Its challenge participation function was reordered after the referenced tables to fix a forward type dependency.
2. `20261116190000_gh_media_evidence_engine.sql` — media asset references and Field Desk evidence relation.
3. `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` — scoped upload sessions, scan/quarantine fields, field-session report binding, geographic metadata and append-only hash-chain events.

The existing Testnet migrations `20261116170409_gh_field_reports_public_intake` and `20261116171144_gh_research_studio_public_forms` remain applied and recorded. The three migrations above were not applied by this source upgrade. Mainnet was not changed.

## Verification limits

The supported runtime requirement is Node.js `^24.15.0`. Full TypeScript, lint, and Next.js production build verification must run on that supported runtime with the locked dependencies installed. The current source-only workspace does not establish those dependency-backed checks.

The source migration inventory is not evidence of applied migrations; it records repository SQL files and classifications only. RUN333 postflight verified the new Testnet grant migration and its privilege effects; all other source files still require exact target-history/catalog reconciliation before application.

The source includes static contract checks and pure file-signature tests. Full Node 24.15.0 dependency-backed TypeScript, lint, production build and browser/device end-to-end acceptance remain outstanding because the available workspace is Node 22.16.0 and dependencies are not installed. Scanner provider execution, signed upload against Testnet, evidence chain postflight and geographic lookup against populated data are not runtime-verified.

No GitHub push, Vercel deployment, Mainnet migration or financial state change was performed. Source presence does not establish database application, runtime success, scanner execution or test acceptance. Production remains NOT APPROVED.


## 0.338.96 full-project audit remediation candidate

- Added a safe `.env.example` containing blank server-only credential placeholders, explicit public/server-only sections, and disabled Pi payout execution defaults. It contains no real credentials.
- Reconciled the essential-controls navigation list with the actual six visible shell destinations: Home, Discover, Messages, Communities, Cart and Profile. The wallet remains an overlay.
- Updated stale regression assertions that still expected the older five-item navigation contract.
- Updated package, lockfile and in-app release identity to 0.338.96.
- No database schema, migration, RLS policy, payment, payout, wallet balance, Pi execution, production environment or deployment was changed.

Focused source checks: release hygiene 17/17; Run #312 notification repair 28/28; Run #304 filter/search release 30/30; scoped evidence engine 25/25; media evidence engine 22/22; Phase 10 release closure 17/17. Full Node 24.15.0 dependency-backed verification remains outstanding because the available environment is Node 22.16.0 and npm installation did not complete.

## Canonical visible navigation

The current visible shell navigation contains six destinations, in order: Home · Discover · Messages · Communities · Cart · Profile. Matches remains available as a secondary/deep-link tab; Wallet remains an overlay.


## 0.338.96 transaction and interaction hardening (Run 313)

- Replaced the misleading in-memory transaction operation flags with explicit ordered operation executors and reverse-order compensation handlers. Failed operations now trigger compensations for completed operations; incomplete compensation is recorded as `failed`. Completed transaction records are retrievable from bounded history.
- Explicitly documented that this in-memory coordinator is not a database transaction and is never authoritative for wallets, payments, rewards, orders, or entitlements. Financial state remains server/RPC/ledger-owned.
- Backup restore now validates the complete snapshot arrays before applying one consolidated state update, preventing subscribers from observing partial profile/settings/posts/conversations restoration.
- Added Run 313 source and runtime regression gates to prebuild and static verification.
- No live database, wallet, Pi, A2U, Mainnet, GitHub, or Vercel operations were performed. Full Node 24.15.0 build and device acceptance remain required; production remains NOT APPROVED.


## 0.338.96 Run 314 — 30 screen-level experience upgrades
- Added a 30-rule adaptive UI layer for Wallet, payment recovery and sheets, Messages, Communities, Marketplace, Feed, Profile, Rewards, Membership and Settings.
- Added explicit component hooks for the responsive community directory grid, marketplace listing grid, conversation rows/bubbles/composer, wallet scroll region, profile timeline and rewards balance panel.
- No payment, wallet, ledger, reward, membership entitlement, order lifecycle, Pi consent, A2U, migration, or Mainnet authority changed.
- Full Node 24.15.0 dependency-backed checks and visual browser/device acceptance remain required.

## 0.338.98 Run 315 — CI lint and build remediation

- Replaced internal raw anchors in the public research form with Next.js `Link` components for `/` and `/privacy`.
- Removed inline suppressions for `@typescript-eslint/no-require-imports`, a rule absent from the configured ESLint plugin set; retained the existing cryptographic Web Crypto-first implementation and fail-closed fallback behavior.
- Added `state.posts` to the `deleteComment` callback dependency list because the callback reads the current posts snapshot when reconciling comment counts.
- Restored the shared `gh-section-title` class on the reusable section heading, satisfying the actual design-system contract.
- Updated the Pass 14 product-design gate to validate dynamic package/app release synchronization rather than a stale 0.236.0 label.
- Added a CI failure-context artifact file before upload so early prebuild failures do not cause a missing-artifact warning.
- Added a nine-assertion Run 315 source regression gate to prelint, prebuild checks and static verification.
- No Supabase changes, migration application, GitHub push, Vercel deployment, wallet/payment changes, payout enablement or Mainnet operations.
- Local workspace has no installed dependencies and runs Node 22.16.0; the required Node 24.15.0 dependency-backed lint and production build remain unverified. Production remains NOT APPROVED.


## 0.338.99 Run 324 — Phase 2 / Phase 3 local source derivative (2026-11-17)

The current local working candidate adds timed examination delivery/review and election-observation administration to the RUN323 derivative. Exam answer keys are excluded from public projections; respondents use a server-HMAC-hashed session key; deadlines, attempt limits, autosave, server scoring and owner-controlled result release are implemented in source. Election contest/candidate/agent administration is owner-scoped. The Phase 3 increment hardens marketplace search/quantity validation, poll vote presentation and feed/profile/community post engagement counts.

Verification: `npm run verify:static` passed. New exam/election source contract 22/22; membership API 13/13; field intake 7/7; research integrity 12/12; marketplace search 6/6; community poll accessibility 10/10; post count contract 6/6 and runtime 9/9; active-module runtime 58/58; changed TS/TSX syntax transpilation 10/10. The full prebuild/typecheck/lint/build remain unverified because this workspace has Node 22.16.0 and lacks installed project dependencies (including `typescript`); the repository requires Node 24.15.0.

Phase 2 is not operationally closed: the Research Intelligence migration remains REVIEW_REQUIRED and unapplied; election tally submission still requires an atomic database RPC and reconciliation tests; authoritative geographic datasets and the trusted malware-scanning provider remain external prerequisites; real Testnet/device acceptance is outstanding. Phase 3 remains an ongoing product-quality programme, not a completed global-launch certification. No GitHub push, Vercel deployment, Supabase migration, live DB mutation, wallet/payment operation or Mainnet action occurred. Production remains NOT APPROVED. See `docs/RUN324-PHASE2-EXAM-ELECTION-AND-PHASE3-QUALITY-2026-11-17.md`.

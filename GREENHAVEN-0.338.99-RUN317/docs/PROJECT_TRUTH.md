# Current project truth — 0.338.99 (2026-11-17)

**Current source version:** `0.338.99`  
**Package identity:** `gh-connect@0.338.99`  
**Authoritative source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**SHA-256:** `dcab57c8f9b43d6f9476745fa8d862b3d26ab33938e00b0bea67132ca2e523ec`  
**Current status:** **NOT APPROVED** for production.

## Source authority

The supplied 0.338.93 RUN312 archive is the exact user-designated source of truth and supersedes every earlier archive wherever they conflict. Version 0.338.99 is a local remediation derivative of that archive; it does not replace the user-designated source archive. Preserve the existing GitHub repository, Vercel project, Pi integrations, wallet and financial boundaries, and migration history.

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

The source migration inventory is not evidence of applied migrations; it records repository SQL files and classifications only. Confirm applied state independently against the intended Supabase project migration history before any database operation.

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

The source migration inventory is not evidence of applied migrations; it records repository SQL files and classifications only. Confirm applied state independently against the intended Supabase project migration history before any database operation.

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

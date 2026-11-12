# GreenHaven / GH-CONNECT — Phase 1 Consolidated Audit and Implementation Register

**Audit date:** 2026-11-09  
**Last updated:** 2026-11-11  
**Authoritative source archive:** `GREENHAVEN-0.338.55-RUN292-MOBILE-WALLET-AUDIT.zip`  
**Current project package:** `gh-connect@0.338.56`

**Current in-place maintenance derivative:** `gh-connect@0.338.56 (Runs #250–296)`; the audit findings and historical baseline below remain preserved. The original 0.338.18 audit baseline and Run #250–278 snapshots are historical references, not current release pointers.  
**Phase:** 1 of the ten-phase completion roadmap — authoritative baseline and complete audit  
**Disposition:** **Source inventory and selected contracts verified; Phase 1 is NOT fully closed. Production remains NOT APPROVED.**

## Run #291 addendum — 2026-11-11

The user-facing Pi earnings reservation recovery path is tightened so it can release only a `reserved` Testnet request that provably never entered provider execution: no provider payment ID, txid, receipt or verification; no execution start; no lease token or expiry; and zero execution attempts. `processing` and `uncertain` requests remain held until authoritative Pi provider reconciliation. This corrects an unsafe stale-processing proposal in which an old execution-start timestamp could have been mistaken for proof that no provider payment was created. The migration is REVIEW_REQUIRED and unapplied. The new 15-check contract covers the SQL release predicate, provider evidence, lease handling, service-role-only ACL, authenticated/rate-limited route and user-facing explanation.

Run #292 added compact mobile content-first headers and summaries across Marketplace, Communities, Discovery and Messages. A non-blocking postbuild footprint report now measures the Vercel workspace and lists its largest folders/files, to investigate the 4,865 MB source-footprint report. Both connected Vercel projects have successful 0.338.53 Preview builds on Node 24.22.2 with 315 prebuild checks invoked; this is baseline evidence only, not proof for the new 0.338.55 increment. Supabase Testnet still has three uncertain Pi earnings requests totalling 3.00 π gross with no persisted provider payment ID, txid or active lease. They remain held; no financial state or migration was changed. Mainnet Supabase is inactive, current Vercel deployments are Preview-only, and production remains NOT APPROVED.

## Run #290 addendum — 2026-11-11

The exported notification navigation dispatcher now sanitizes caller-supplied deep-link targets at the final navigation trust boundary, before any route navigation occurs. The Phase 5 static checker now inspects the canonical sanitizer module and verifies dispatcher ordering. Focused Phase 5 checks pass 19/19; Run #289 deep-link source and behavior checks pass 37/37 and 20/20. The release metadata is 0.338.53. This does not claim a complete dependency-backed production build or browser/device acceptance. No database migration, financial mutation, GitHub push or Mainnet operation was performed. Production remains NOT APPROVED.

## Run #288 addendum — 2026-11-11

The permissions hook now consumes the exported `GHCContextType` without an `as any` cast, derives match IDs from the declared model and uses the hydrated profile identity in permission context construction. The app shell remains structurally repaired under Run #287. The new type-safety contract passes 6/6; focused Run #287, Run #241, Run #284, Run #283, Run #278, Run #262, Run #263, Run #266 and Run #267 checks pass. Full Node 24 dependency-backed typecheck/lint/build and browser/device acceptance remain open.

Run #283 adds the first cross-module implementation tranche: 55 typed presentation/input helpers across 11 Active modules, five missing feature entry points wired into the root feature registry, safer account-scoped connection-intent cache handling, and an inclusive GHC request-expiry boundary. The new helper suite passes 55/55 and feature wiring passes 16/16. This is not completion of the requested 220 upgrade targets; remaining module-specific feature work and full runtime acceptance remain open.

## Run #281 addendum — 2026-11-11

The current source derivative is `0.338.46`. In addition to Runs #279–280 wallet, communications and Events work, it adds three prelaunch service surfaces backed by existing canonical sources: Charity & Impact reads the authenticated user's recorded segregated charity summary and formats PI from exact atomic units; Services reads only active, durable `kind=service` listings through the existing Marketplace API and hands detail navigation back to the canonical Marketplace listing screen; Creator Tools reads the authenticated creator overview and now has durable fail-closed read/write throttles plus private no-store responses. Each new screen is prepared but not wired into the ecosystem directory. Events and Charity API endpoints are server-gated by canonical registry status and remain 404 while Coming Soon. The Services and Creator Tools views reuse existing active underlying APIs but do not activate the standalone Coming Soon modules. Seller Centre remains implemented inside the Active Marketplace surface. All 41 service statuses remain 11 Active / 30 Coming Soon across nine categories. No database migration was added or applied.

## Run #280 addendum — 2026-11-11

The current source derivative is `0.338.45`. It adds a prepared Events discovery API and screen using the existing canonical `gh_community_events`, `gh_communities`, `gh_community_members`, and `gh_community_event_rsvps` records. The API derives the viewer from the authenticated session, uses a durable fail-closed read throttle, applies public/private/invite-only community visibility before projection, excludes deleted communities and ended/cancelled events, and returns only bounded event projection fields. RSVP writes reuse the existing authenticated community platform RPC route. The canonical service release gate is checked before authentication/data access; because `events` remains `COMING_SOON` with destination `none`, the API returns 404 and the prepared screen is not wired into the directory. No schema change or migration was required for this prepared slice. Events discovery contract is 14/14, release-boundary checks 14/14, and the 41-service registry test confirms 11 Active / 30 Coming Soon across nine categories. The 0.338.45 full static verification chain passes and the consolidated static runner passes 58/58; the 304-command prebuild manifest was only enumerated, not executed. Node 24.15.0 dependency-backed typecheck/lint/build and browser/device acceptance remain outstanding. No SQL was applied and no push/deployment occurred.

## Run #279 addendum — 2026-11-11

The current source derivative is `0.338.44`, based on the user's 0.338.43 ecosystem candidate. It preserves the 41-service registry (11 Active, 30 Coming Soon) and all Coming Soon non-interactive destinations. A Wallet withdrawal entry-point defect was corrected: each new withdrawal-sheet session clears the prior cached withdrawable amount and mapped username before opening, then fetches a fresh no-store server snapshot; the sheet's sticky maximum remains scoped to the current open session. The focused Pi withdraw/consent regression now passes 12/12 (previously 11/12). Run #278 communications regression remains 31/31 and the 30-track coverage gate remains 15/15. The full static chain currently advances past those gates but still requires subsequent regression failures to be reconciled. Node 22.16.0 is below the pinned Node 24.15.0 runtime, and `node_modules` is absent, so no dependency-backed typecheck/lint/production build is claimed. Live Testnet migration history was read-only inspected on 2026-11-11 and returned 37 generated records; source history reconciliation is still required before any migration rehearsal or push. No database writes, migrations, payouts, GitHub push, Vercel deployment, or Mainnet changes were performed. Production remains NOT APPROVED.

## Run #250–255 addendum — 2026-11-10

The current derivative advances the source with immutable Pi identity insert-only resolution and production fail-closed username lookup; Testnet curation/community reconciliation; global server-only SECURITY DEFINER ACLs and hardened postgres default function privileges; pinned search paths; duplicate-index removal; RLS policy deduplication/initplan optimization; eleven missing FK indexes; and a corrected Phase 9.4 marketplace timeline migration that preserves the existing Phase 21 event-journal schema. The live Testnet security advisor now reports no SECURITY DEFINER client-execution or mutable-search-path warnings; the performance advisor reports no duplicate indexes, unindexed foreign keys, RLS initplan or multiple-permissive-policy findings.

The Testnet audit still has operator gates: two old APPROVED membership payment intents require Pi provider reconciliation; one uncertain Pi earnings payout retains a reservation and must not be released without provider evidence; four Daily Claim entries remain pending (two matured); GHC curation issuance remains intentionally disabled; marketplace migrations 194–195 remain unapplied pending disposable PostgreSQL validation; and original migration history 1–189 remains unreconciled. Mainnet was not accessed. Static verification passes, but Node 24.15.0 dependency-backed typecheck/lint/build and provider/device E2E acceptance remain outstanding. Production remains NOT APPROVED.


## Run #272 addendum — 2026-11-10

The current source derivative is `0.338.33`. Thirty Feed/Profile/post-card/comment improvements cover account-scoped preferences and hidden posts, identity-fenced saved-post hydration, reduced-data/online-aware work, owner-fenced profile timelines, abortable/locked pagination, safe profile error copy, durable profile-media updates/removals and blocked/cycle-safe comment trees. Testnet migration `20261110193134` pins the two remaining active feed/comment RPC search paths without changing grants or rows; remote history is 19 generated records against 216 canonical source migrations. Vercel build events identify OOM/SIGKILL during Next.js compilation; source now clears stale Webpack cache and disables persistent production Webpack caching, but Run #272 is not yet pushed/deployed. No Mainnet, Vercel environment, build-machine tier or production setting was changed. See `docs/RUN272-FEED-PROFILE-30-POINT-AUDIT.md`.

## Run #271 addendum — 2026-11-10

The current source derivative at Run #271 was `0.338.32`. The post API now accepts GreenHaven's first-party media facade references, derives media IDs from image/video/PDF attachments and links them through the existing owner-checking RPC. Account-scoped drafts persist attachments, audience, community target and stable publish IDs; composer close saves synchronously. Story create is idempotent by stable request ID, derives owner identity from the server profile, rejects external/signed media URLs, verifies uploaded asset ownership/readiness and validates audience/content. Story viewer/creator add keyboard focus trapping, Escape handling, actual video pause and safe-area layout. Testnet-only migrations `20261110185525`, `20261110185528` and `20261110190531` are applied; 19 generated remote migration records remain divergent from 216 canonical source files after Run #272. No Mainnet or Vercel production changes; source is not pushed/deployed. See `docs/RUN271-POST-COMPOSER-STORIES-30-POINT-AUDIT.md`.

## Run #270 addendum — 2026-11-10

At Run #270, the source derivative was `0.338.31`. Community group cards now use semantic controls, avoid per-card timers and use locale-aware activity labels. Chat UI access requires active server-confirmed chat membership, not just community membership; chat-state fetches fail closed and ignore stale responses. Chat, post and platform routes sanitize IDs and validate action enums, review decisions, event ordering, HTTPS links, resource bounds, report values and moderator targets. Testnet-only migration `20261110182120_community_chat_membership_revocation_and_reconciliation.sql` atomically revokes the separate realtime-chat membership on community leave/removal/ban, serializes membership transitions, adds a defensive chat-state check, and reconciles one stale active chat grant (postflight zero). Conversation/message history was preserved. The `gh_community_search_public` RPC and public search indexes were installed on Testnet under generated migration version `20261110183004`; a smoke query confirms server-side filtering/pagination. The original source migration remains REVIEW_REQUIRED pending history reconciliation. Testnet has 15 generated migration-history records against 212 canonical source files; do not bulk apply, repair or replay. The latest Vercel preview still builds old commit `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` and fails the old visual-cohesion assertion; Run #270 is not pushed/deployed. Mainnet and Vercel production settings remain untouched; production is NOT APPROVED. See `docs/RUN270-COMMUNITY-30-POINT-AUDIT.md`.

## Run #269 addendum — 2026-11-10

The Run #269 source derivative was `0.338.30`. Run #269 fixes stale Vercel prebuild UI assertions, mirrors the checks in static verification, makes the Run #267 release assertion version-aware, and adds a client-role ACL regression gate. The active Testnet project received migration `20261110174922_revoke_client_table_write_and_sequence_privileges.sql`: client table-write/DDL-adjacent grants were removed from all public tables, client sequence privileges were removed, and postgres-owned defaults now fail closed. Postflight confirms 0/140 public tables with client write privileges and 0/9 client-accessible public sequences. Existing SELECT/RLS and service-role access are preserved. The Run #269 canonical migration inventory was 210 files; Testnet's generated history had 13 records and remains unreconciled against the historical source migration sequence. Three uncertain payout requests and two APPROVED-but-unfulfilled membership intents remain blocked on provider evidence. Mainnet is inactive and untouched; production remains NOT APPROVED. See `docs/RUN269-30-POINT-AUDIT-AND-MAINTENANCE.md` and `docs/TESTNET-RECONCILIATION-2026-11-10.md`.

## 1. Purpose and non-destructive rules

This register is the controlling source-audit index for the ten-phase completion roadmap. It reconciles current-source evidence across migrations, application architecture, community, messaging, economy, marketplace, identity, security, deployment and user experience. It supersedes no migration history and does not silently amend prior reports. Older reports remain historical snapshots unless they explicitly identify themselves as current-release documents.

Rules:

- Preserve the 0.338.18 archive as the historical audit baseline; use the current 0.338.33 derivative of `GREENHAVEN-0.338.30-RUN269-30-POINT-MAINTENANCE.zip` and its executable source for implementation.
- Preserve working architecture, features, interfaces, assets, integrations and dependency versions unless a confirmed defect requires a narrowly scoped fix.
- Do not apply additional migrations beyond the Run #272 social RPC hardening and the narrow Run #271 story patches and the previously documented Run #270 Testnet patches, repair remote history, change balances, execute payouts, or change provider/deployment settings without target-specific review. Run #269 ACL hardening and Run #270 community/chat/search patches are separately documented as Testnet-only changes; Mainnet remains untouched.
- Distinguish **source present**, **source check passed**, **database applied**, **Testnet verified**, and **production verified**. They are not interchangeable states.
- Do not close Phase 1 while the supported-runtime gate, full audit register, or external environment evidence remains open.

## 2. Reproducible source inventory

| Item | Observed value | Interpretation |
|---|---:|---|
| `package.json` version | `0.338.18` | Matches archive release identity |
| Canonical SQL migration files | 199 | Repository inventory only |
| Migration classifications | 118 REQUIRED; 78 REVIEW_REQUIRED; 2 PROPOSAL; 1 REQUIRES_APPROVAL | `REQUIRED` is not automatic authorization to apply |
| Migration source manifest | 199/199 synchronized | Source inventory gate passes |
| `check-*.mjs` + `test-*.mjs` files | 384 | File count only; not a pass count |
| Domain mutation routes with declared owner | 151 | Route-level ownership map passes; does not prove DB/RPC duplicate writers are absent |
| Relative / alias source imports inspected by consistency gate | 1,453 files; zero unresolved imports | Static repository consistency only |
| Node runtime available in audit environment | `v22.16.0` | Below required `^24.15.0`; blocks supported-runtime verification |
| `node_modules` | Absent | Dependency-backed TypeScript/build/lint cannot be claimed as run successfully |

## 3. Phase 1 audit results

### 3.1 Checks executed in the supplied archive

| Check | Result | What it proves / does not prove |
|---|---|---|
| `check-priority9-message-search.mjs` | PASS 10/10 | Search UI calls full-history server endpoint and handles bounds/accessibility; not live DB proof |
| `check-priority10-phase1.mjs` | PASS 15/15 | Conversation information-centre and roadmap contracts; not full product completion |
| `check-priority10-phase1-closeout.mjs` | PASS 19/19 | Source contracts for settings, search RPC/API, edit/pin boundaries and test fixtures; does not prove the migration is deployed |
| `check-priority10-messenger-community.mjs` | PASS 14/14 | Shared-media and voice playback scope honesty; does not prove durable voice sending or calling |
| `check-independent-marketplace-community-audit.mjs` | PASS 42/42 | Selected marketplace/community source controls |
| `check-phase1-outbox-contract.mjs` | PASS 13/13 | Outbox proposal contract and safety design; proposal remains non-deployable pending review/rehearsal |
| `check-domain-mutation-route-owners.mjs` | PASS | 151 mutating routes have exactly one declared domain owner; database-level ownership still open |
| `check-migration-source-manifest.mjs` | PASS 199/199 | Migration source inventory/manifests synchronized |
| `check-repository-consistency.mjs` | PASS 6/6 | Package/lock identity, runtime declarations, ESM, imports and script targets are consistent |
| `check-sql-lexical-integrity.mjs` | PASS | 199 files are lexically balanced; not PostgreSQL parser or execution proof |
| `check-security-audit-20261109.mjs` | PASS 34/34 | Selected security source assertions pass |

These checks were executed with Node 22.16.0 only where the scripts support that runtime. They must not be represented as a full CI, typecheck, lint or production-build pass.

### 3.2 Migration and database status

- The current migration directory contains 199 unique canonical 14-digit versions; the source manifest and generated review-order documents synchronize.
- The latest migration is `20261109100001_gh_messaging_phase1_controls_search.sql`, classified `REVIEW_REQUIRED` and documented as unapplied.
- Testnet and Mainnet migration histories have **not** been reconciled in this phase. No remote database was accessed.
- The full 199-file dependency graph and clean PostgreSQL execution/rehearsal remain incomplete. Source lexical checks are not a substitute for PostgreSQL execution.
- No `supabase db push` or bulk apply is authorized by this register.
- A current migration audit records the inventory as 199 (118 REQUIRED / 78 REVIEW_REQUIRED / 2 PROPOSAL / 1 REQUIRES_APPROVAL). Older dated documents referring to 198 migrations / 77 REVIEW_REQUIRED are stale relative to this archive and must remain clearly historical or be annotated as superseded; do not rewrite their historical snapshot as if it were current evidence.

### 3.3 Architecture and identity

**Verified at source-contract level:** package/lock identity; import resolution; 151 mutating API routes have exactly one declared domain owner; selected identity, session and security checks pass.

**Open:** prove actual database/RPC writer ownership; find legacy and duplicate writers; verify session-derived identity and account isolation end to end; validate all authorization rules against deployed RLS, grants and function overloads. The domain map is accountability metadata, not proof that duplicate database writers have been eliminated.

### 3.4 Community and messaging

**Verified at source-contract level:** community and marketplace control suite 42/42; indexed full-history message-search source contracts; message settings/edit/pin boundary checks; shared-media UI explicitly scopes itself to loaded history; voice playback is present for existing attachments.

**Open:** apply and verify the messaging migration only after reconciliation and approval; test member vs outsider search and preferences against real Testnet; verify two-account/multi-device persistence; complete contact sharing and create-group-from-DM flows; establish durable voice recording/sending, full server-backed shared-media archive and audio/video calling infrastructure before representing them as operational. Current source audit explicitly says call signaling/TURN/call persistence were not found in the inspected UI path.

### 3.5 Economy and payments

**Verified at source-contract level:** selected financial security checks 34/34, atomic ledger guards, payout/receipt-fencing and related source contracts are registered in the source suite; the migration inventory is synchronized.

**Open:** PostgreSQL concurrency and ledger invariants; Testnet Pi identity/payment/withdrawal journeys; exact provider receipt and txid matching; remote migration/RLS/grant validation; recovery after uncertain provider outcomes; actual reservation/balance reconciliation. GHC/bank payout paths and any Pi operation lacking its complete external evidence must remain disabled. Source assertions are not evidence of real settlement.

### 3.6 Marketplace and membership

**Verified at source-contract level:** selected 22 marketplace and 20 community controls pass; seller commission is server-calculated in the audited source; order/fulfilment routes have bounded authorization and throttling contracts.

**Open:** database-backed concurrency and failure tests; remote RLS/RPC acceptance; order/payment/ledger/entitlement reconciliation under retries; provider and refund settlement; live end-to-end browser acceptance.

### 3.7 Build, deployment and device acceptance

**Blocked in this audit environment:** supported Node 24.15.x verification. Current runtime is Node 22.16.0, and `node_modules` is absent. Prior archive notes report dependency installation timed out. Therefore typecheck, lint and production build are **not passed** by this Phase 1 audit. Browser/device screenshots, Pi Browser and physical Android acceptance are also not established by the checks executed here.

## 4. Consolidated phase mapping

| Roadmap phase | Scope | Confirmed evidence | Main remaining exit criteria |
|---|---|---|---|
| 1 | Authoritative baseline and complete audit | This register; source inventory and selected checks above | Reconcile all known documents/issues into one register; supported-runtime verification; preserve external DB blockers explicitly |
| 2 | Migration integrity and database dependency graph | 199-file manifest; lexical check; partial dependency audit | Full dependency graph; disposable PostgreSQL execution; separate Testnet/Mainnet history/catalog reconciliation |
| 3 | Architecture, identity and durable operation boundaries | 151 route-owner declarations; selected security checks | Database/RPC duplicate-writer audit; session identity and RLS/grant runtime tests; outbox decision/rehearsal |
| 4 | Community, social graph and moderation | 20 community controls in independent audit; additional community source checks | Two-account/multi-role visibility, moderation, block/mute and durable feed tests on live Testnet |
| 5 | Messaging and communication completion | Search 10/10; Phase 1 closeout 19/19; messaging/community 14/14 | Migration acceptance; full-history search live test; contact/group flows; durable voice; call subsystem only after infrastructure design |
| 6 | GHC ledger, rewards and economy integrity | `docs/PHASE-6-GHC-LEDGER-REWARDS-ECONOMY-AUDIT-2026-11-09.md`; 10 targeted source suites pass (see report) | PostgreSQL concurrency/conservation/replay; resolve E6-01 negative-total clamping observability gap; provider receipt and recovery evidence |
| 7 | Pi identity, payments and withdrawal recovery | Source-side identity/payout/receipt contracts | Authenticated Testnet provider journeys, exact receipts, interrupted recovery and operator evidence |
| 8 | Marketplace, membership and settlement | 42 selected marketplace/community controls | Database concurrency, provider receipts, refunds, order/ledger/entitlement reconciliation |
| 9 | Application performance and UX | Source-level responsive/navigation and performance checks exist | Supported build, measured performance, accessibility, browser/Android/Pi Browser acceptance |
| 10 | Release engineering and independent acceptance | CI scripts and release gates exist in source | Complete CI on supported runtime; database/provider/device evidence; backup/restore, monitoring, approvals |

## 5. Prioritized issue register

| ID | Severity | Issue / gap | Owner phase | Required evidence or action | Status |
|---|---|---|---|---|---|
| P1-01 | Critical | Supported runtime is not available in this audit environment | 1 / 10 | Run on Node 24.15.x with complete lockfile install; typecheck, lint, build | BLOCKED |
| P1-02 | Critical | Testnet and Mainnet migration history not reconciled | 2 | Separate project identity, migration history export, CLI comparison and catalog evidence | BLOCKED — operator/project access |
| P1-03 | Critical | Full 199-migration dependency graph and PostgreSQL rehearsal incomplete | 2 | Validate dependencies and execute on disposable matching PostgreSQL before any live apply | OPEN |
| P1-04 | Critical | Financial source checks are not live settlement proof | 6 / 7 / 8 | Ledger invariants, concurrency, Testnet provider receipts and recovery evidence | OPEN; keep gated |
| P1-05 | High | Route owner map does not prove unique DB/RPC writers | 3 | Trace each critical mutation from UI/API through RPC/table/triggers; detect legacy writers | OPEN |
| P1-06 | High | Messaging migration remains REVIEW_REQUIRED and unapplied | 2 / 5 | Reconcile histories, review SQL, PostgreSQL rehearsal, explicit approval, Testnet two-account checks | OPEN |
| P1-07 | High | Messaging contact-sharing and create-group-from-DM are not end-to-end complete | 5 | Define privacy/API contract and verify persisted group/member transitions | OPEN |
| P1-08 | High | Durable voice send, complete media archive and real calling are not established | 5 | Durable media contract; call signaling/TURN/provider and recovery; cross-device tests | OPEN; no false feature claims |
| P1-09 | High | Community authorization and visibility need live multi-role acceptance | 4 | Member/outsider/blocked/banned/moderator scenarios on target DB | OPEN |
| P1-10 | High | Marketplace/economy settlement needs DB-backed retry and reconciliation evidence; PI balance RPC can mask negative raw totals by clamping | 6 / 7 / 8 | Concurrent orders, payments, refunds, entitlements, receipts, ledger matching and explicit raw-balance integrity signal | OPEN — see E6-01 |
| P1-11 | Medium | Audit docs contain older inventory snapshots | 1 | Label dated reports historical; use current 199-file manifest as current source | TRACKED |
| P1-12 | Medium | Browser/device and accessibility acceptance not complete | 9 / 10 | Run device matrix, keyboard/screen reader, offline, session/account switching | OPEN |
| P1-13 | Medium | Performance claims require installed build and measurements | 9 | Capture bundle/API/feed/media metrics against explicit budgets | OPEN |

## 6. Phase 1 exit criteria

Phase 1 is complete only when all items below are satisfied or recorded as a formally accepted external blocker with an owner and a no-go effect:

- [x] Authoritative archive and package version recorded.
- [x] Canonical migration and check-script inventory counted from the supplied archive.
- [x] Current migration classifications recorded and cross-checked against the source manifest.
- [x] Representative messaging, community, marketplace, architecture, SQL lexical and security contracts executed.
- [x] Source-only versus live-environment proof boundaries documented.
- [x] Ten-phase traceability and prioritized issue register created.
- [ ] Full source suite / `verify:static` run to completion on supported Node 24.15.x environment.
- [ ] Typecheck, lint and production build pass with complete dependencies.
- [ ] Testnet and Mainnet migration history evidence collected independently.
- [ ] Every high/critical issue assigned to the next phase with an explicit acceptance test.

**Phase 1 decision:** source audit register delivered; Phase 1 remains **IN PROGRESS** because supported-runtime checks and remote environment evidence are not available in this workspace. This is not a production approval.

## 7. Next execution order

1. Complete Phase 1 closeout on a supported Node 24.15.x environment and reconcile the full suite result.
2. Begin Phase 2 with read-only Testnet and Mainnet evidence capture, then complete dependency graph and disposable PostgreSQL rehearsal.
3. Do not apply any migration until its environment history, dependencies, SQL behavior, approval class and recovery plan are established.
4. Continue in roadmap order, carrying the issue IDs above into each phase closeout report.

## 8. Evidence references in this source archive

- `docs/MIGRATION_AUDIT_AND_DUAL_ENVIRONMENT_RECONCILIATION_2026-11-09.md`
- `docs/MIGRATION_DEPENDENCY_ORDER_AUDIT_2026-11-09.md`
- `docs/FINANCIAL-SECURITY-AUDIT-2026-11-09.md`
- `docs/INDEPENDENT-MARKETPLACE-COMMUNITY-FINANCIAL-AUDIT-2026-11-09.md`
- `docs/PHASE-I-IMPLEMENTATION-2026-11-09.md`
- `docs/PHASE-II-IMPLEMENTATION-2026-11-09.md`
- `docs/PHASE-III-IMPLEMENTATION-2026-11-09.md`
- `docs/PRIORITY_10_FOUR_PHASE_EXECUTION_PLAN.md`
- `docs/ACCEPTANCE-COMPLETION-REGISTER.md`
- `docs/PROJECT_TRUTH.md`
- `docs/SOURCE_OF_TRUTH.md`
- `docs/SECURITY-AUDIT-0.338.6.md`

**Change scope in this Phase 1 pass:** this consolidated register only. No application behavior, SQL migration, dependency, lockfile, remote database, wallet balance, provider state or deployment setting was changed.


## Phase 7 update — Pi identity and withdrawal boundary (2026-11-09)

Phase 7 identified and corrected a production identity-namespace fallback in `resolveAuthenticatedUser`: a valid Pi `/v2/me` UID without a canonical GH mapping is no longer accepted as the GH user ID in production. Non-production legacy fallback remains explicitly isolated. See `docs/PHASE-7-PI-IDENTITY-WALLET-AUTHORIZATION-WITHDRAWAL-2026-11-09.md`. This is a source-level fix only; Testnet/Mainnet and provider E2E evidence remain outstanding.

## Phase 8 update — marketplace, membership and settlement (2026-11-09)

Phase 8 corrected an application-vs-database commission precision mismatch: app-side marketplace commission calculations now use eight-decimal integer arithmetic matching the immutable seller-proceeds SQL snapshot. Added `scripts/check-phase8-cross-domain-settlement.mjs`, `scripts/test-phase8-cross-domain-settlement.mjs`, and the phase report `docs/PHASE-8-MARKETPLACE-MEMBERSHIP-CROSS-DOMAIN-SETTLEMENT-2026-11-09.md`; the new check/test are wired into `prebuild` and `verify:static`.

**Outstanding release blocker P8-02:** application fee settings remain configurable through `GHC_MARKETPLACE_PLATFORM_FEE_BPS` and `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR`, while the SQL snapshot hardcodes 500 basis points and has no minimum-fee floor. Until an additive DB-backed shared policy is designed and rehearsed, deployments must use 500 basis points and no minimum fee. Phase 8 remains source-level and partially complete; no SQL migration was applied and no financial/Testnet/Production transaction was executed.


## Run #296 registration integrity update (2026-11-12)

The active source package is now `gh-connect@0.338.56`. Run #296 prevents incomplete onboarding through explicit field selection, durable step-by-step profile saves, authenticated durable avatar uploads and a server-side completion gate. See `RUN296-ONBOARDING-REGISTRATION-DELIVERY.md`.

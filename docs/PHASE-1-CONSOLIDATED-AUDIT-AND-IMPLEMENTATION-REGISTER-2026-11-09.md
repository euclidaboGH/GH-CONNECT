# GreenHaven / GH-CONNECT — Phase 1 Consolidated Audit and Implementation Register

**Audit date:** 2026-11-09  
**Authoritative source archive:** `GREENHAVEN-0.338.18-STEP2-SURGICAL-SQL-FIXES-DEPENDENCY-AUDIT-2026-11-09.zip`  
**Project package:** `gh-connect@0.338.18`

**Current in-place maintenance derivative:** `gh-connect@0.338.25 (Runs #250–259)` (Runs #250–258); the audit findings and historical baseline below remain preserved.  
**Phase:** 1 of the ten-phase completion roadmap — authoritative baseline and complete audit  
**Disposition:** **Source inventory and selected contracts verified; Phase 1 is NOT fully closed. Production remains NOT APPROVED.**

## Run #250–255 addendum — 2026-11-10

The current derivative advances the source with immutable Pi identity insert-only resolution and production fail-closed username lookup; Testnet curation/community reconciliation; global server-only SECURITY DEFINER ACLs and hardened postgres default function privileges; pinned search paths; duplicate-index removal; RLS policy deduplication/initplan optimization; eleven missing FK indexes; and a corrected Phase 9.4 marketplace timeline migration that preserves the existing Phase 21 event-journal schema. The live Testnet security advisor now reports no SECURITY DEFINER client-execution or mutable-search-path warnings; the performance advisor reports no duplicate indexes, unindexed foreign keys, RLS initplan or multiple-permissive-policy findings.

The Testnet audit still has operator gates: two old APPROVED membership payment intents require Pi provider reconciliation; one uncertain Pi earnings payout retains a reservation and must not be released without provider evidence; four Daily Claim entries remain pending (two matured); GHC curation issuance remains intentionally disabled; marketplace migrations 194–195 remain unapplied pending disposable PostgreSQL validation; and original migration history 1–189 remains unreconciled. Mainnet was not accessed. Static verification passes, but Node 24.15.0 dependency-backed typecheck/lint/build and provider/device E2E acceptance remain outstanding. Production remains NOT APPROVED.

## 1. Purpose and non-destructive rules

This register is the controlling source-audit index for the ten-phase completion roadmap. It reconciles current-source evidence across migrations, application architecture, community, messaging, economy, marketplace, identity, security, deployment and user experience. It supersedes no migration history and does not silently amend prior reports. Older reports remain historical snapshots unless they explicitly identify themselves as current-release documents.

Rules:

- Keep the 0.338.18 archive as the sole source baseline for this work.
- Preserve working architecture, features, interfaces, assets, integrations and dependency versions unless a confirmed defect requires a narrowly scoped fix.
- Do not apply migrations, repair remote history, change balances, execute payouts, or change provider/deployment settings as part of this source-only phase.
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

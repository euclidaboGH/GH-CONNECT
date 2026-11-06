> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# GreenHaven Phase 1–12 System-Wide Acceptance and Remediation

## Release snapshot

- Current source baseline for this consolidated report: `0.331.0` (2026-11-06). Historical implementation notes below retain their original release labels; they are not the current project version.
- Scope: consolidation and source-level acceptance across Phases 1–12, plus the later source checks already present in this repository.
- The canonical project root is the repository root. The stale nested `greenhaven-upgrade-next/` copy was removed because it was pinned to `0.150.1` and duplicated the project tree; its only nested-only path was an empty directory.

## Current audit status (v0.331.0)

- Phase 7 Wallet source implementation is closed in 0.320.0; dedicated Wallet entry contract: 14/14. External Node 24.15.x build, browser/device and live Pi Testnet acceptance remain production release blockers. This remains a read-only snapshot; consent, quote, withdrawal execution, GHC ledger and provider authorities are unchanged.
- Phase 8 Rewards source implementation is closed in 0.323.0. It includes bounded account-scoped snapshots, authenticated GHC ledger history/search/filtering, server-authoritative daily claims and seven durable server-verified idempotent non-financial mission achievement unlocks. Dedicated Phase 8 contracts pass 18/18, 20/20, 15/15 and 24/24. Mission GHC issuance remains disabled; the new additive migration is REVIEW_REQUIRED and unapplied. Node 24, Testnet, browser/device and operator acceptance remain production blockers.

- Phase 7 creator/business identity increment (0.319.0) adds safe public portfolio presentation, account-scoped server achievement hydration and professional-interest discovery relevance. Dedicated Phase 7 identity showcase contract passes 10/10. The consolidated static suite must pass before source-only audit closure.

- The v0.194.0 CI-hardening increment adds explicit CI visibility for RLS source coverage, SECURITY DEFINER ACL source inspection, production safety, Phase 15 payment recovery, Phase 16 payment lifecycle and Phase 7 treasury completion. These remain source-level checks, not deployed-database or provider acceptance.

- The v0.157.0 uploaded baseline passed the network/database-independent static suite: 43/43 checks.
- The v0.157.1 patch synchronized release-truth metadata. The v0.157.2 patch strengthens Phase 3 public identity hydration with bounded nested comment/reply traversal and safe avatar fallback validation. The v0.157.3 patch hardens restore-evidence reads against symlink/path-swap races and expands Phase 4 recovery/identity regression contracts. The v0.157.4 patch centralizes approved brand asset paths, guards logo files with SHA-256 checks, and strengthens safe-area and high-contrast UI behavior. The v0.157.5 patch hardens browser navigation runtime guards, validates settings-section payloads, rejects control characters in navigation strings, and provides a Home fallback for direct-entry not-found recovery. The v0.157.6 patch fails closed when feed posts lack canonical author identifiers, preventing malformed feed rows from bypassing mute enforcement, and adds the Phase 7 social contract to consolidated static verification. The v0.157.7 patch strengthens wallet snapshot validation and no-store responses. The v0.157.8 Phase 9 increment tightens Pi transaction projection and payment-intent input validation while preserving read-only, user-scoped reconciliation. The v0.157.9 Phase 10 increment adds streaming body bounds to marketplace order creation, payment, transition and commerce mutations; strict quantity validation; bounded listing identifiers; non-coercive commerce payload handling; and no-store mutation responses. The v0.157.10 follow-up prevents generic public transitions from asserting refunds or commerce lifecycle outcomes, and requires durable seller delivery/service activation before buyer confirmation. The v0.157.11 Phase 11 increment validates marketplace intent/order identifiers, amount and rail agreement, refund/cancellation terminal-state consistency, avoids reusable membership-reference false matches, and centralizes the payment-intent history cap.
- The v0.157.12 Phase 12 increment repairs the consolidated static runner registration for the audit-UX check, adds a stronger release gate for migration inventory/classification drift and duplicate migration prefixes, and synchronizes current release truth across documentation and artifacts. This remains source-only evidence.
- The v0.157.13 cross-phase hardening increment applied streaming byte limits to seven previously unbounded JSON write routes across account lifecycle, social, notifications, communities, and marketplace features.
- The v0.157.14 follow-up adds streaming byte limits to twelve further high-impact financial, identity, and social write routes, tightens payout amount type validation, and makes social follow target identifiers string-only. The v0.157.16 follow-up extends this to connection requests, reports, matching signals, creator tips, and bank-beneficiary mutations, with runtime tests for the bounded JSON parser. These are source-level safeguards and isolated helper tests, not full application or live-system acceptance.
- The available audit container runs Node.js 22.16.0, while the project requires Node.js 24.15.0; `node_modules` is absent. TypeScript, lint, production build and browser E2E have therefore not been run here. Phase 16 post-interaction and Phase 17 cohesive social-engagement source checks are registered in the current release.
- The repository migration inventory is generated from the canonical migration directory; see `docs/MIGRATION_CHECKLIST.md` for current counts and classifications. The current 189-file inventory is 117 REQUIRED, 69 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL and 2 PROPOSAL. This is a source inventory only; each target's remote migration history must be reconciled independently.
- No live Supabase/Pi/Vercel operation, database migration, restore drill, or financial mutation was performed.

## Improvements made

1. Removed the stale duplicate project tree to prevent engineers from editing or packaging an obsolete source version by mistake.
2. Added `scripts/check-phase1-12-consolidation.mjs` and registered it in the npm scripts and consolidated static suite.
3. Strengthened version consistency across `package.json`, `package-lock.json`, `lib/app-release.ts`, and `VERIFIED_MANIFEST.txt`.
4. Preserved explicit boundaries between source-level checks and operational acceptance.
5. Retained all existing network-independent source checks and did not change production data, financial records, or database migration state.

## Verification performed

- `node scripts/verify-phase14-static.mjs` — passed before the consolidation changes; rerun after changes is required and recorded in the delivery summary.
- Phase 1–12 consolidation contract — checks version consistency, required phase reports, static-suite registration, stale-tree absence, runtime pin, and honest acceptance wording.
- ZIP integrity — must be checked on the final archive.

## Outstanding release acceptance

Source checks do not prove that GreenHaven builds, deploys, or behaves correctly against live infrastructure. The environment used for this review exposes Node.js 22.16.0 while `.nvmrc` pins Node.js 24.15.0; `node_modules` is not present. Consequently TypeScript, lint, production build, browser E2E, and real PostgreSQL/Testnet operator drills cannot be honestly claimed as complete in this environment.

Before deployment, use Node.js 24.15.0, install strictly from the lockfile, run typecheck/lint/build and browser journeys, reconcile migration history against a disposable database, test wallet/payment/order idempotency and recovery, and attach real operator evidence. Do not apply migrations or mutate production financial data as part of a source audit.


## Historical v0.152.0 hardening delta (superseded by subsequent releases)

- Added a finite timeout to public profile identity hydration and rejected protocol-relative, backslash-containing, and control-character photo URLs.
- Bounded navigation destinations and externally sourced navigation event payloads.
- Rejected malformed supplied Pi transaction amounts rather than silently omitting invalid values.
- Expanded Phase 3, Phase 6, and Phase 9 regression checks.
- The network/DB-independent static suite was rerun on this source tree: 35/35 checks passed.
- Runtime TypeScript/lint/build, browser journeys, and operational database/Testnet checks remain separate acceptance requirements.


## v0.157.23 cashback foundation note

The source baseline adds a review-gated PI cashback attribution and four-month period-ledger migration, wires the marketplace PI commission source to the authenticated buyer, and registers dedicated regression checks. This remains source-only until disposable PostgreSQL/Testnet validation, migration-history reconciliation, all eligible source integrations, payout execution and Mainnet A2U authorization are proven.


## v0.157.24 cashback statement boundary

A private, read-only cashback statement is available in source through existing Rewards Center and Wallet screens. The feature hides rather than invents zero balances when the backend migration/service is unavailable. Cashback is not withdrawable until the separate A2U payout execution and funding gates are completed.


## v0.157.25 cashback period-close safety boundary

The source adds a service-role-only close wrapper that enforces a seven-day reconciliation grace after the four-month UTC earning window ends. This reduces the chance that late verified revenue journaling is omitted from an immutable cashback snapshot. Migration `20261029010003_pi_cashback_period_reconciliation_grace.sql` remains REVIEW_REQUIRED and unapplied; its ACL, ownership and concurrency semantics must be validated on disposable PostgreSQL before any target migration is considered.


## v0.157.27 marketplace payment/revenue reconciliation recovery

The Pi marketplace payment route now distinguishes completed payment verification from cashback revenue-journal reconciliation. Revenue-journal upstream calls are bounded to five seconds per attempt. If the journal append fails, the API reports a retryable reconciliation state without asking the buyer to pay again. The retry path validates and reuses the original completed intent and repairs eligible interrupted order transitions through the existing state machine. This remains source-level evidence only.


## v0.157.27 boundary — Testnet cashback A2U

Added a separate cashback A2U payout domain, authenticated claim route, shared global A2U sequence lease, provider verification, and UI gating. The new migration is review-required and unapplied. Static source contracts are not evidence of a real Pi wallet credit. Supported-runtime typecheck/lint/build, disposable PostgreSQL validation, target migration reconciliation, funded Pi Testnet transfer, retry/recovery, and browser verification remain release gates.

- The v0.183.0 increment added PI earnings payout request/reservation. The v0.184.0 increment adds privileged settlement and authoritative-cancellation release RPCs. v0.185.0 adds a dedicated general-earnings Testnet execution worker with durable global sequence leasing, provider-payment recovery, independent read-after-write receipt verification, and guarded settlement. v0.187.0 adds bounded execution input, an active lease heartbeat, a ten-minute lease window, and safe recovery when provider completion already exists. Live Pi Testnet E2E and PostgreSQL concurrency/failure-injection remain release blockers.


## v0.187.0 Phase 4 receipt/lease fencing

- Revalidates the active execution lease immediately before Pi create, submit, complete, and settlement operations.
- Heartbeat locks and validates the request lease and global A2U lane together before extending either, preventing partial extension if the global lane has been lost.
- PostgreSQL settlement/release RPCs now validate receipt identifier, A2U direction, Pi Testnet, canonical recipient, exact net amount, GreenHaven domain/request metadata, and transaction verification/completion or authoritative cancellation with no transaction.
- Source contract: `scripts/check-phase4-receipt-fencing.mjs` (13 checks). No PostgreSQL engine or authenticated Pi Testnet provider was available; no live DB migration or payout was run.


## v0.188.0 Phase 5 shared Pi A2U sequence lane

General PI earnings execution now shares the durable `gh_pi_a2u_sequence_lease` with seller and cashback A2U domains. The earnings worker uses a namespaced lease owner and shared-lane fencing for begin, heartbeat, provider binding and release. Cashback source eligibility is fail-closed to the audited marketplace PI commission source; other categories remain pending until their provider revenue and compensation producers are verified. Migration `20261030010007_pi_a2u_shared_sequence_lane.sql` is REVIEW_REQUIRED and unapplied. PostgreSQL cross-domain concurrency, Node 24 build and live Testnet payout remain unverified.


## v0.189.0 Phase 6 financial reconciliation

The authenticated read-only wallet reconciliation now compares authoritative PI earnings and withdrawable snapshots using validated atomic units, probes the authoritative cashback statement rather than hardcoding feature availability, and reports healthy/attention/degraded status in the earnings dashboard. No ledger writes or database migrations were added. Runtime and operator acceptance remain outstanding.


## v0.194.0 Phase 7 treasury visibility

Added a read-only operator snapshot composing authoritative PI cashback reconciliation and A2U exception queues. Seller payables, general earnings reservations, bank settlements and GHC utility balances are explicitly excluded pending verified aggregate sources. Static source checks are integrated; Node 24 build and live database/Testnet/browser validation remain required.

## v0.194.0 CI governance increment

Added an executable workflow-governance contract and explicit CI visibility for marketplace integrity, cross-feature wallet reconciliation, and request-boundary follow-up contracts. This improves failure localization; it is not a claim of runtime payment or database acceptance.


## v0.196.0 marketplace payment evidence binding

The current marketplace PI payment route now requires provider, currency, purpose, order reference, authenticated owner, completed status, and finite amount agreement on the persisted payment intent. Browser-provided payment IDs and transaction hashes are not accepted as evidence. Community PI creation-fee settlement also enforces provider, currency, dedicated purpose metadata, and an exact intent reference or explicit community binding. Phase 18 source-contract checks are part of static verification and CI; live Pi Testnet acceptance remains outstanding.


## v0.196.0 marketplace RPC transport hardening

Durable marketplace order RPCs now have bounded timeouts and fail-closed malformed-response handling. See `docs/UPGRADE-WORKLOG-0.196.0.md`. This remains source-only until database/runtime/Testnet gates pass.


## v0.198.0 Phase 20 marketplace seller-net proceeds

Added an append-only per-order proceeds snapshot with verified PI/GHC evidence binding and changed seller payout request eligibility to consume seller net rather than order gross. Migration `20261030010009_phase20_marketplace_net_proceeds.sql` is REVIEW_REQUIRED and unapplied. Commission is currently fixed at 500 bps pending confirmation against the configured commercial policy. Existing gross-based payout allocations require historical reconciliation. See `docs/UPGRADE-WORKLOG-0.198.0.md`; this is source-only work, not database or Testnet acceptance.


## v0.198.0 Phase 21 marketplace lifecycle journal

Added append-only database-authored lifecycle event history for canonical marketplace order/payment/delivery/escrow/dispute transitions. Migration `20261030010010_phase21_marketplace_case_event_journal.sql` is REVIEW_REQUIRED and unapplied; it is not a refund, dispute-resolution or settlement engine. See `docs/UPGRADE-WORKLOG-0.198.0.md`.


## v0.200.0 Phase 22 marketplace adjustments and payout fencing

Added immutable order adjustment records for refund/chargeback/dispute accounting, idempotent service-role intake, and seller-net payout reservation after adjustments with shared seller/currency locking. Migration `20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql` remains REVIEW_REQUIRED and unapplied. Provider refund execution, operator dispute adjudication, historical payout remediation, automatic membership renewal charging, and PostgreSQL/Testnet acceptance remain outstanding. See `docs/UPGRADE-WORKLOG-0.200.0.md`.


## v0.200.0 Phase 23 treasury and community reconciliation

Treasury now reports marketplace gross, commission, seller net, adjustments, reservations, settlements and historical allocation discrepancies from canonical sources. Community membership lifecycle events are append-only; a read-only queue compares completed payment intents with canonical entitlements. PI and GHC are never summed together. Migration `20261030010012_phase23_treasury_community_reconciliation.sql` is REVIEW_REQUIRED and unapplied. See `docs/UPGRADE-WORKLOG-0.200.0.md`.


## v0.202.0 Phase 25 operational workflow foundations

The Phase 25 SQL source-contract checker is static only. Provider integration, complete dispute/correction execution, disposable PostgreSQL validation, and live Testnet acceptance remain outstanding.

## v0.201.0 Phase 24 financial exception detail

Added bounded, read-only service-role reports for per-allocation payout evidence discrepancies and membership payment-to-entitlement exceptions. Historical rows are not rewritten, access is not granted from payment status alone, and provider settlement evidence remains a separate requirement. Migration `20261030010013_phase24_financial_exception_detail.sql` remains REVIEW_REQUIRED and unapplied.


## Phase 8 locale presentation update (v0.295.0)

The shared internationalisation layer now exposes locale-aware compact numbers, percentages, units, relative time, plural selection, text collation and presentation metadata. Static checks verify API wiring and fallback boundaries. Runtime TypeScript/build gates remain separate and must be completed under Node.js 24.15.0.


## Phase 10 accessibility interaction update (v0.297.0)

The current source release adds shared live-status semantics, localized main landmark and navigation announcements, 44px interactive target sizing, consistent keyboard focus, reduced-motion support and forced-colors error affordances. These source checks do not replace browser/screen-reader acceptance.


## Phase 12 locale integration update (v0.298.0)

Locale preference lifecycle now tolerates unavailable embedded-browser storage and synchronizes cross-tab changes. Intl unit/plural formatting has defensive fallback behavior. The dedicated source contract is registered in prebuild and static verification. This is source-level verification only; supported-runtime build and browser/device acceptance remain outstanding.


## Phase 13 social Stories and profile media update (v0.300.0)

The current source now includes a simplified story-card rail, viewer-authorized full-screen story media resolution, and separate view/edit actions for profile and cover images. See `docs/SOCIAL_STORY_PROFILE_MEDIA_PHASE13_0.300.0.md`.


## Phase 14 creator media preview update (v0.300.0)

Post and Story composition now support full-screen image preview before publishing. Attached post and Story videos provide inline playback controls and resolve private media through the existing durable-media resolver. The preview layer does not upload, persist, publish, or alter media authorization. Dedicated source gate: `scripts/check-creator-media-preview-phase14.mjs`. Device/browser validation remains pending.


## Current baseline update — 0.310.0 (2026-11-04)

Phase 20 moved all 21 payout, rewards and financial-reporting route modules from process-local rate limits to the shared database-backed security control plane with explicit fail-closed behavior when durable storage is unavailable. This is a source-level abuse-control improvement only. It does not change payout settlement, provider verification, treasury funding, or migration state.


## Current baseline update — 0.310.0 (2026-11-04)

Phase 21 moved private messaging read/write, private-media signing/upload/resolution, and account export/lifecycle intake rate limits onto the shared durable security control plane with fail-closed behavior. The new repository-integrity gate verifies the ten protected boundaries, pipeline registration, release metadata, migration prefix uniqueness and exact migration-manifest byte counts. No migration was added or applied. Supported-runtime build and operational acceptance remain outstanding.


## Current baseline update — 0.310.0 (2026-11-04)

Phase 22 adds atomic, row-locked durable marketplace order transitions and an expanded canonical order read contract. The new migration is review-required and not applied. Source-level verification does not establish PostgreSQL execution, concurrent transaction behavior, live provider settlement, or production acceptance.


## Current baseline update — 0.310.0 (2026-11-04)
Phase 23 separates marketplace reservation cleanup from order snapshot reads to avoid broad expiry sweeps inside row-locked state transitions. Repository migration integrity checks now cover 177 source migrations and SECURITY DEFINER search_path declarations. Live database validation remains outstanding.


## Current Phase 3 handoff (0.315.8)

Marketplace browse filters, GHC/PI currency-safe price sorting, premium listing-card presentation and durable marketplace listing-report intake are included in source. The new listing-report migration is REVIEW_REQUIRED. Source checks do not establish SQL deployment, operator moderation, Node 24 build, browser/device acceptance or Testnet readiness. Phase 1/2 runtime and database acceptance gates remain open.


## Current Phase 4 handoff (0.315.9)

The marketplace cart now validates and bounds local cache records, synchronizes across browser tabs, locks cart edits during checkout, and selectively removes only successfully reserved order lines. The server remains authoritative for listing price, seller, inventory, order reservation and payment. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`. This is source-only verification, not live checkout or production acceptance.


## Current Phase 6 and Phase 7 handoff (0.319.0)

Profile and Identity now uses per-domain cached relationship indexes derived from canonical social arrays. Derived sets are independently invalidated when their immutable source arrays change, and people/profile lists can batch-hydrate unique IDs from one prepared snapshot. Block-first relationship safety remains intact; private wallet/GHC data is excluded. No migration or financial authority change. The focused Phase 6 runtime and source checks pass; full supported-runtime acceptance remains open.


## 0.323.0 Phase 8 source completion

The mission progress endpoint now derives identity from server authentication, applies a durable fail-closed rate limit, parses bounded JSON and ignores client metadata. A service-role-only SQL function verifies community membership, posts, comments, profile onboarding and connection request state against durable rows, then unlocks a non-financial achievement idempotently. Mission GHC issuance remains disabled under the current economy policy. Migration `20261106170001_phase8_verified_mission_achievements.sql` is REVIEW_REQUIRED and has not been applied. Phase 8 source implementation is closed; production approval remains pending Node.js 24.15.0 build, disposable PostgreSQL/Testnet, browser/device and operator acceptance.


### Current increment — 0.325.0 Membership foundation

The current source release begins Product Phase 9 with strict membership entitlement row parsing, paid-expiry validation, bounded status reads and conflict-safe plan selection. This is source-only evidence; Node 24.15.x build, browser/device and external database/provider acceptance remain outstanding.


## 0.326.0 current-increment note

The current source baseline adds Phase 9 Membership lifecycle/access controls. Its own static/runtime contracts are 20/20 and 15/15; existing membership session/foundation/parser contracts remain passing. This note does not supersede historical system-wide acceptance results or claim a full production build. Node 24.15.x dependency-backed typecheck/lint/build, disposable PostgreSQL/Testnet, browser/device and operator verification remain required.


## 0.327.0 current-increment note

Phase 9 Membership now requires exact durable Pi provider, PI currency, membership purpose and COMPLETED/FULFILLED state for every membership grant/recovery path. The new SQL follow-up is REVIEW_REQUIRED and unapplied. Strict Pi intent policy tests pass 10/10 and source wiring/security checks pass 10/10. Node 24.15.0 dependency-backed typecheck/lint/build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain pending.


## 0.329.0 current-increment note

Phase 10 tightens the service worker to cache only explicitly allowlisted public static assets. Navigations, authenticated documents, Next.js RSC responses, all API routes and private media remain network-only. Feed and Story speculative media prefetch now respects Data Saver, constrained connections and the local reduced-data preference, rechecks before work and applies strict caps. The reconnect banner cleans up its timer. Phase 10 focused checks pass 14/14 settings/performance, 17/17 resilience and 11/11 service-worker policy tests. This remains source-only; Node 24.15.0 typecheck/lint/build, browser/device and operational acceptance remain outstanding.


## 0.330.0 current-increment note

Phase 10 adds lazy-loaded Settings subsections, preserves signed media URLs without arbitrary query mutation, holds pagination locks through asynchronous page loads and falls back to visible content on WebViews without IntersectionObserver. Focused Phase 10 navigation/media checks pass 9/9 and runtime assertions pass 7/7; the 0.329.0 service-worker policy and resilience checks remain passing. Node 24.15.x dependency-backed typecheck/lint/build and Android/Pi Browser device acceptance remain pending. Production remains NOT APPROVED.


## 0.330.1 current-increment note

The 0.330.1 patch corrects stale CI regression contracts so the PI Withdraw action, emerald own-story treatment, package/lockfile/manifest version and Phase 10 active roadmap marker are checked against the current source. The 0.330.0 navigation/media changes and 0.329.0 privacy-safe service-worker policy remain in the baseline. These checks are source evidence only. Node 24.15.0 dependency install, TypeScript, ESLint, production build, disposable database, Pi Testnet and browser/device/operator acceptance remain outstanding; production remains NOT APPROVED.

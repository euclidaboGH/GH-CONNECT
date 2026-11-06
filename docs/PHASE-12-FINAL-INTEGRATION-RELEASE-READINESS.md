> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 12 — Final integration and release readiness

Release: `0.330.1` (2026-11-06)

The 0.312.0 source baseline includes Phase 20 payout controls, Phase 21 private-surface durable abuse controls, Phase 22 atomic marketplace order transitions, Phase 23 migration/lock-scope hardening, Phase 24 migration-classification/operator-guide synchronization, and Phase 26 wallet ledger resilience/premium wallet presentation. The canonical inventory contains 189 migrations: 117 REQUIRED candidates, 69 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL, and 2 PROPOSAL. All classifications remain source-review states; no migration is claimed applied. Runtime/build and operator acceptance remain pending.

## Delivered in v0.157.12

- Corrected the consolidated static runner so `check-phase1-12-audit-ux.mjs` runs as its own check instead of being accidentally placed in a three-element tuple and skipped.
- Strengthened the Phase 12 final gate to verify release version consistency, current-baseline documentation, phase-gate registration, canonical migration inventory/classification counts, unique migration versions, and explicit operational acceptance boundaries.
- Updated the Phase 1–12 acceptance report, project-truth record, README, package/lock/app release version, and verified migration manifest to identify the current source baseline.
- Added a worklog that records checks run and their actual limits.

## v0.183.0 PI earnings payout request foundation

The source now includes a Testnet-only, feature-flagged request endpoint and an additive request/reservation migration. It is not a transfer execution path. Provider receipt verification, settlement, and safe release/recovery remain incomplete and must pass disposable PostgreSQL failure/concurrency tests and authenticated Testnet lifecycle tests before payout execution is enabled.

## 0.320.0 Phase 7 Wallet reliability increment

The Pi withdrawable preview now uses bounded/cancellable read-only hydration, clears stale session values, and validates successful server responses, finite non-negative amounts and linked identity. No financial execution authority or migration changed. This is source-level reliability evidence only; the release remains NOT APPROVED for production until runtime, browser/device, Testnet reconciliation and operator gates pass.

## 0.322.0 Phase 8 Rewards integrity increment

Rewards Centre economy snapshot hydration is bounded, abortable and account-scoped; malformed/null/negative amounts remain unknown, and optional response identity is checked before display. Daily claim messages use only a finite non-negative server-reported amount; local streak estimates are never presented as credited GHC. Failed claims cannot flash a claimed-success state. The daily claim endpoint, reward issuance, maturity, GHC ledger, Pi cashback and settlement authorities remain unchanged. No migration was added or applied. Phase 7 Wallet source implementation is closed, but its Node 24.15.x build, browser/device and live Pi Testnet acceptance remain release blockers.

## Release gates

The final gate is network- and database-independent. It does not prove that the app compiles, migrations have been applied remotely, Pi Testnet/Mainnet works, or browser/accessibility/operational acceptance is complete.

Required before deployment:

1. Use Node.js `24.15.0` or a compatible later Node 24 release satisfying `package.json`.
2. Install from the lockfile using the repository's documented npm command.
3. Run the consolidated static verification, TypeScript, lint, and production build.
4. Run authenticated browser journeys on mobile and desktop, including accessibility, session/account switching, error recovery, marketplace checkout and membership flows.
5. Reconcile migration history against each target environment independently; validate sequencing-sensitive migrations on disposable PostgreSQL/Testnet.
6. Complete disposable-database restore, marketplace concurrency, wallet reconciliation, and Pi Testnet evidence checks.
7. Require explicit operator approval before any Mainnet or production mutation.

## Safety and status

No production database, balances, payments, orders, entitlements, or migrations were changed. The source gate never contacts external systems. The migration inventory is not evidence of applied migrations. **Release status remains NOT APPROVED for production until the runtime and operator gates above are complete.**


## Cross-phase follow-up — v0.157.14

The subsequent cross-phase hardening increment added streaming bounded JSON parsing to seven high-impact mutation endpoints. The Phase 1–12 consolidated gate now includes a dedicated request-boundary regression contract. These source checks improve release confidence but do not replace Node.js 24.15.0 install/build checks, browser tests, disposable PostgreSQL restore/concurrency drills, migration-history reconciliation, or Pi Testnet acceptance.


## Cross-phase follow-up — v0.157.16

Added bounded streaming JSON parsing and stricter input types to connection request, moderation report, matching signal, creator tip, and bank-beneficiary mutation routes. Added a runtime test for the shared bounded JSON reader. This does not prove the full Next.js application builds or that provider/database integrations pass. Production remains NOT APPROVED until the supported Node.js 24.15.0 locked install, TypeScript/lint/build, browser journeys, database restore/concurrency tests, migration history reconciliation, and Pi Testnet checks are completed.


## v0.157.24 boundary

The read-only Pi cashback statement is wired into Rewards Center and Wallet. It is not a payout flow. The two cashback migrations remain REVIEW_REQUIRED and unapplied; full build, live database and Pi A2U validation remain required.


## v0.157.25 boundary

Cashback period close now has a seven-day reconciliation grace wrapper in source. The new migration is not applied, and this source-only safeguard does not establish cashback payout readiness. Full Node 24 install/typecheck/lint/build, disposable PostgreSQL validation, remote migration-history reconciliation, and Pi Testnet payout verification remain required.


## v0.157.27 boundary

Marketplace Pi payment reconciliation failures are now surfaced as retryable states separate from payment verification, and revenue-journal upstream calls are bounded to five seconds per attempt, with static contracts in the release suite. No provider payment is resubmitted by the recovery path. This is source-level hardening only; release remains NOT APPROVED for production pending supported-runtime build and operator validation.


## v0.157.27 boundary

The Testnet cashback A2U source path is implemented, but the migration is not applied and a funded Pi Testnet wallet transfer has not been verified. Do not tell testers that wallet credits are ready until the new migration is individually reviewed/applied to Testnet, Testnet A2U credentials and funding are configured, and an end-to-end transfer plus retry/reconciliation tests pass. Mainnet remains disabled.

## v0.184.0 PI earnings settlement/recovery foundation

Added an additive, REVIEW_REQUIRED migration for privileged settlement after exact verified Testnet receipt binding, plus cancellation/no-transaction-only reservation release. This is database lifecycle logic, not a complete provider execution worker. PostgreSQL failure-injection/concurrency, Node 24 build and full Pi Testnet lifecycle remain unverified. Mainnet remains disabled.


## v0.187.0 Phase 4 receipt and lease fencing

The latest source adds database-side JSON receipt validation and atomic lease heartbeat fencing. The route checks lease ownership immediately before provider mutations and settlement. The source test covers these invariants; it does not substitute for actual PostgreSQL concurrency/failure injection or funded Pi Testnet E2E. Production remains NOT APPROVED until supported-runtime build and operator gates pass.


## v0.188.0 Phase 5 shared A2U coordination

The general earnings A2U worker now uses the same durable Pi app-wallet sequence lease as seller and cashback payouts. The migration is review-required; validate simultaneous requests across all three domains and stale-token fencing on disposable PostgreSQL. Cashback source eligibility is restricted to verified marketplace PI fees until other sources have complete settlement and refund attribution. No live database or Pi provider action was performed.


## v0.189.0 Phase 6 financial reconciliation

Phase 6 compares PI ledger and withdrawable snapshots, validates atomic-unit values, probes cashback from its authoritative statement RPC, and surfaces health state to the wallet dashboard. It is read-only and introduces no migration. Node 24, PostgreSQL/Testnet and browser acceptance remain required; release remains NOT APPROVED for production.


## v0.194.0 Phase 7 treasury visibility

Added a read-only operator snapshot composing authoritative PI cashback reconciliation and A2U exception queues. Seller payables, general earnings reservations, bank settlements and GHC utility balances are explicitly excluded pending verified aggregate sources. Static source checks are integrated; Node 24 build and live database/Testnet/browser validation remain required.

## v0.194.0 CI governance increment

CI now verifies its own runtime, permissions, lockfile-install order, required security and commerce gates, and separate typecheck/lint/build steps. Marketplace integrity, cross-feature wallet reconciliation, and expanded request-boundary checks are explicit workflow steps. External acceptance remains outstanding.


## v0.195.0 marketplace payment evidence binding

Phase 18 now requires marketplace PI intents to be server-authoritative and bound to the PI provider, PI currency, marketplace purpose, exact order reference, authenticated buyer, completed status and durable order amount. Client-supplied payment IDs and transaction hashes are ignored as evidence. This source-level hardening does not establish successful provider checkout; authenticated Pi Testnet tests remain required.


## v0.196.0 marketplace durable RPC transport hardening

The marketplace order-store and GHC spend PostgREST calls now use bounded 10-second timeouts and explicit no-store behavior. Non-empty malformed JSON responses fail closed rather than being treated as successful mutations; empty PostgREST void responses remain supported. Phase 19 source-contract checks run in prebuild, static verification and CI. This remains source-only until disposable PostgreSQL, supported Node 24 runtime, and authenticated Testnet acceptance are complete.


## v0.198.0 Phase 20 marketplace seller-net foundation

The source adds immutable per-order proceeds snapshots and seller-net-based payout eligibility. The migration is REVIEW_REQUIRED and unapplied; confirm the 500-bps policy, reconcile historical gross allocations, and pass disposable PostgreSQL concurrency plus Pi/GHC Testnet evidence before activation.


## v0.198.0 Phase 21 marketplace lifecycle audit journal

Added immutable database-authored marketplace lifecycle events. The migration remains REVIEW_REQUIRED and unapplied; static checks do not prove PostgreSQL or Testnet acceptance.


## v0.200.0 Phase 22 marketplace adjustments and payout fencing

Added immutable order adjustment records for refund/chargeback/dispute accounting, idempotent service-role intake, and seller-net payout reservation after adjustments with shared seller/currency locking. Migration `20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql` remains REVIEW_REQUIRED and unapplied. Provider refund execution, operator dispute adjudication, historical payout remediation, automatic membership renewal charging, and PostgreSQL/Testnet acceptance remain outstanding. See `docs/UPGRADE-WORKLOG-0.200.0.md`.


## v0.200.0 Phase 23 treasury and community reconciliation

The treasury report wraps the Phase 7 base report and adds marketplace gross, commission, seller net, adjustments, outstanding payout allocations, paid settlements, missing proceeds snapshots, and legacy allocation discrepancy counts. Community membership events are append-only and link to canonical payment intent IDs; completed payment reconciliation is read-only and currency-separated. Migration `20261030010012_phase23_treasury_community_reconciliation.sql` remains REVIEW_REQUIRED and unapplied. No historical payout or membership rows are rewritten. PostgreSQL concurrency validation and Testnet payment/renewal acceptance remain outstanding. See `docs/UPGRADE-WORKLOG-0.200.0.md`.


## v0.202.0 Phase 25 operational workflow foundations

Phase 25 remains review-required and unapplied. Static contracts do not replace PostgreSQL execution, provider verification, concurrency tests, or Testnet acceptance.

## v0.201.0 Phase 24 financial exception detail

Adds read-only per-allocation payout reconciliation details and community payment-to-entitlement exception details. It does not perform automatic historical corrections, provider refunds, membership grants or renewals. Migration remains REVIEW_REQUIRED; PostgreSQL concurrency and authenticated Testnet acceptance remain outstanding.


## v0.298.0 global locale integration follow-up

Locale preference continuity now survives restricted embedded-browser storage during the active session, cross-tab preference changes remain synchronized, and Intl unit/plural formatting has defensive fallback behavior. See `docs/GLOBAL_LOCALE_INTEGRATION_PHASE12_0.298.0.md`. This does not alter the existing operational release gates: supported-runtime build, browser acceptance, database migration reconciliation and explicit operator approval remain mandatory.


## v0.299.0 Phase 13 social Stories and profile media update

The current source replaces the decorative story-bubble rail with compact vertical story cards, resolves private Story media through the existing viewer-authorized media resolver, and separates full-size profile/cover viewing from edit/upload actions. The source UX contract gate passes 13/13. Supported-runtime build, TypeScript, lint, browser/device testing, private-media live checks, migration reconciliation, and operator approval remain required before production release. See `docs/SOCIAL_STORY_PROFILE_MEDIA_PHASE13_0.299.0.md`.


## v0.300.0 Phase 14 creator media preview

Post composer photo attachments now open in the shared full-screen gallery before publishing; attached post videos provide inline playback controls. Story photos open in the shared viewer and Story videos use the viewer-authorized DurableVideo resolver. Preview, removal, upload and publishing remain distinct responsibilities. The source regression gate passes 10/10. This is not browser/device acceptance.


## 0.306.0 Phase 20 — payout control-plane hardening

Seller payout intake/history, bank beneficiary create/disable, bank account resolution, bank directory, bank transfer execution, PI/GHC/bank reconciliation, operator transitions and exception resolution now use the durable rate-limit control plane. If durable rate-limit storage is unavailable, these routes deny the operation rather than falling back to per-instance counters. Existing authorization, recent step-up, provider verification, payout idempotency, treasury funding and atomic settlement remain unchanged.


## 0.309.0 Phase 21 — private-surface control hardening

Ten private messaging, private-media and account privacy rate-limit boundaries now use awaited shared database-backed enforcement with deny-on-unavailable semantics. Repository integrity checks now validate those boundaries, release metadata, migration prefix uniqueness and manifest byte synchronization. No database migration was added or applied. Source checks pass; Node 24.15.x build, live Supabase, provider, browser/device and operator acceptance remain outstanding.


## 0.308.0 Phase 22 — marketplace order transition serialization

The durable marketplace transition path now calls a row-locking PostgreSQL RPC rather than loading an order and later overwriting it through the generic upsert. The RPC validates the state graph while holding the order lock, appends the audit event, and returns canonical order data. Service-role-only ACLs and fail-closed RPC transport are enforced. No payment settlement, refund, GHC/Pi, escrow, payout or ledger mutation was added. The new migration is review-required and has not been applied.


## 0.309.0 Phase 23 — migration integrity and lock-scope hardening
- Separated reservation expiry cleanup from the marketplace order snapshot function.
- Ordinary application reads explicitly run cleanup before fetching the snapshot and fail closed if cleanup is unavailable.
- Locked transition/commerce RPCs return snapshots without sweeping unrelated reservations inside their transaction.
- Added repository-wide checks for canonical migration filenames, duplicate versions, empty SQL files and SECURITY DEFINER search_path.
- The additive migration remains REVIEW_REQUIRED pending disposable PostgreSQL concurrency and Testnet migration-history validation.


## 0.315.9 source baseline update

The current repository baseline includes Phase 3 Marketplace discovery and report-intake source changes. This is not production approval. The marketplace report migration is REVIEW_REQUIRED, and the supported-runtime build, disposable PostgreSQL, remote migration reconciliation, Testnet and operator acceptance gates remain outstanding.


The 0.315.9 Phase 4 cart/checkout source increment adds bounded cart-cache normalization, cross-tab synchronization, checkout interaction locking and selective cleanup of reserved cart lines. It does not add or apply a migration and does not alter order, wallet or payment authority. The new source checks are registered in static verification; live payment and device acceptance remain open.


## 0.319.0 Phase 6 completion and Phase 7 premium profile experience

The release adds reusable per-domain relationship indexes and deduplicated batch hydration while preserving block-first relationship safety and all existing financial authority boundaries. No migration was added. Focused Phase 6 runtime/source checks and repository/migration-manifest consistency checks pass. Supported Node 24.15.x typecheck, lint, production build, browser/device and live provider/database acceptance remain outstanding.


## 0.323.0 Phase 8 Rewards source completion

Phase 8 source implementation is closed. Six mission types are now verified against durable records and unlock non-financial achievements idempotently through a service-role-only RPC. The mission route uses verified server identity, bounded JSON and durable fail-closed rate limiting. No GHC/Pi mission issuance was enabled; generic activity issuance remains disabled by policy. The additive migration `20261106170001_phase8_verified_mission_achievements.sql` is REVIEW_REQUIRED and unapplied. Dedicated Phase 8 mission contracts and existing Rewards regression contracts must pass. Node.js 24.15.0 build, disposable PostgreSQL/Testnet validation, browser/device acceptance and operator sign-off remain required.


## Current source increment — 0.325.0

Phase 9 Membership foundation is included in source release 0.325.0. It adds strict entitlement parsing and bounded status reads only; it does not certify live database/provider behavior or change financial execution authority. Production remains NOT APPROVED until supported-runtime, browser/device, database/Testnet and operator gates are complete.


### Current source note — 0.326.0

Phase 9 Membership source checks are registered in the main static suite. The source increment is not production approval: the new membership lifecycle/renewal migration remains REVIEW_REQUIRED and unapplied; Node 24.15.x build gates, disposable PostgreSQL/Testnet validation, browser/device and operator acceptance remain mandatory.


## 0.327.0 Phase 9 Membership payment-rail integrity

Completed-payment membership activation, fulfillment, recovery and payment-history reconciliation now require an explicit durable Pi provider, PI currency, membership purpose, non-empty provider payment ID and COMPLETED/FULFILLED status. Missing discriminators fail closed. The additive SQL renewal follow-up is REVIEW_REQUIRED and unapplied. The 0.327.0 static suite is source-only and does not replace Node.js 24.15.0 typecheck/lint/build, disposable PostgreSQL/Testnet, browser/device or operator acceptance. Production remains NOT APPROVED.


## 0.329.0 Phase 10 privacy-safe caching and media efficiency

Service-worker caching now uses an explicit public-static allowlist. Navigation documents, authenticated pages, Next.js RSC payloads, all API routes and private media are network-only; install-time precache also validates response cache headers. Feed and Story media prefetch follows reduced-data/Data Saver and constrained-network signals, rechecks at execution time and is strictly bounded. Focused Phase 10 checks pass 14/14 settings/performance, 17/17 resilience and 11/11 executable service-worker policy assertions. This is source-level verification only. Supported Node 24.15.0 typecheck/lint/build, browser/device testing, disposable PostgreSQL, Pi Testnet and explicit operator acceptance remain required. Production remains NOT APPROVED.

## Current source baseline — 0.330.1 (2026-11-06)

Phase 10 navigation/media reliability adds lazy-loaded Settings subsections, signed media URL preservation, async pagination locking and an IntersectionObserver fallback for embedded WebViews. Focused Phase 10 checks pass 9/9 source assertions and 7/7 runtime assertions. The supported Node 24.15.x dependency-backed build and real-device acceptance remain required. This source baseline does not change the production status: NOT APPROVED.


### 0.330.1 CI regression-contract patch

The Phase 10 patch release corrects stale source regression assertions and keeps package, lockfile, app release, project truth and migration manifest synchronized. The CI contract changes do not alter runtime payment or entitlement behavior. Release remains NOT APPROVED for production: supported-runtime install/build, disposable PostgreSQL, Pi Testnet, browser/device and operator acceptance are still required.

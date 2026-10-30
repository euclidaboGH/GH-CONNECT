# GreenHaven Phase 1–12 System-Wide Acceptance and Remediation

## Release snapshot

- Current source baseline for this consolidated report: `0.214.1` (2026-10-30). Historical implementation notes below retain their original release labels; they are not the current project version.
- Scope: consolidation and source-level acceptance across Phases 1–12, plus the later source checks already present in this repository.
- The canonical project root is the repository root. The stale nested `greenhaven-upgrade-next/` copy was removed because it was pinned to `0.150.1` and duplicated the project tree; its only nested-only path was an empty directory.

## Current audit status (v0.214.1)

- The v0.194.0 CI-hardening increment adds explicit CI visibility for RLS source coverage, SECURITY DEFINER ACL source inspection, production safety, Phase 15 payment recovery, Phase 16 payment lifecycle and Phase 7 treasury completion. These remain source-level checks, not deployed-database or provider acceptance.

- The v0.157.0 uploaded baseline passed the network/database-independent static suite: 43/43 checks.
- The v0.157.1 patch synchronized release-truth metadata. The v0.157.2 patch strengthens Phase 3 public identity hydration with bounded nested comment/reply traversal and safe avatar fallback validation. The v0.157.3 patch hardens restore-evidence reads against symlink/path-swap races and expands Phase 4 recovery/identity regression contracts. The v0.157.4 patch centralizes approved brand asset paths, guards logo files with SHA-256 checks, and strengthens safe-area and high-contrast UI behavior. The v0.157.5 patch hardens browser navigation runtime guards, validates settings-section payloads, rejects control characters in navigation strings, and provides a Home fallback for direct-entry not-found recovery. The v0.157.6 patch fails closed when feed posts lack canonical author identifiers, preventing malformed feed rows from bypassing mute enforcement, and adds the Phase 7 social contract to consolidated static verification. The v0.157.7 patch strengthens wallet snapshot validation and no-store responses. The v0.157.8 Phase 9 increment tightens Pi transaction projection and payment-intent input validation while preserving read-only, user-scoped reconciliation. The v0.157.9 Phase 10 increment adds streaming body bounds to marketplace order creation, payment, transition and commerce mutations; strict quantity validation; bounded listing identifiers; non-coercive commerce payload handling; and no-store mutation responses. The v0.157.10 follow-up prevents generic public transitions from asserting refunds or commerce lifecycle outcomes, and requires durable seller delivery/service activation before buyer confirmation. The v0.157.11 Phase 11 increment validates marketplace intent/order identifiers, amount and rail agreement, refund/cancellation terminal-state consistency, avoids reusable membership-reference false matches, and centralizes the payment-intent history cap.
- The v0.157.12 Phase 12 increment repairs the consolidated static runner registration for the audit-UX check, adds a stronger release gate for migration inventory/classification drift and duplicate migration prefixes, and synchronizes current release truth across documentation and artifacts. This remains source-only evidence.
- The v0.157.13 cross-phase hardening increment applied streaming byte limits to seven previously unbounded JSON write routes across account lifecycle, social, notifications, communities, and marketplace features.
- The v0.157.14 follow-up adds streaming byte limits to twelve further high-impact financial, identity, and social write routes, tightens payout amount type validation, and makes social follow target identifiers string-only. The v0.157.16 follow-up extends this to connection requests, reports, matching signals, creator tips, and bank-beneficiary mutations, with runtime tests for the bounded JSON parser. These are source-level safeguards and isolated helper tests, not full application or live-system acceptance.
- The available audit container runs Node.js 22.16.0, while the project requires Node.js 24.15.0; `node_modules` is absent. TypeScript, lint, production build and browser E2E have therefore not been run here.
- The repository migration inventory is generated from the canonical migration directory; see `docs/MIGRATION_CHECKLIST.md` for current counts and classifications. This is a source inventory only; each target's remote migration history must be reconciled independently.
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

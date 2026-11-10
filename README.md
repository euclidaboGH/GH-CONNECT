# GreenHaven / GH-CONNECT

**Current source version:** `0.338.16`

Production status: **NOT APPROVED** — supported Node 24.15.0 dependency-backed typecheck/lint/build, browser/device, live database/provider and operator acceptance remain outstanding.

This repository is the canonical GreenHaven / GH Connect source tree. See `docs/SOURCE_OF_TRUTH.md` and `docs/CURRENT_BUILD_CONTEXT.md` before implementation or release work.


## Latest communications transformation — 0.338.13

Phase 1 has started. See `docs/PRIORITY_10_FOUR_PHASE_EXECUTION_PLAN.md` for the full review, research, source audit, 35 workstreams mapped into four phases, security gates and implementation record. The conversation information centre is the first Phase 1 increment; the wider programme is not yet complete.\n\nSee `docs/PRIORITY_10_MESSENGER_COMMUNITY_TRANSFORMATION.md` for the Facebook Messenger reference review, source capability audit, 35-workstream upgrade plan, implementation notes, research references and outstanding production verification.\n\n## Last documented hardening notes — 0.330.49 (baseline for 0.338.9)

The 0.330.48 maintenance increment begins controlled Feed reliability work: client reconciliation now matches the canonical database keyset order (`created_at DESC, id DESC`) so equal-timestamp posts produce the correct next-page cursor. Runtime and source regression checks cover the ordering contract. The 15-section / 150-essential maintenance register remains the programme-wide target; its items are not represented as completed merely because they are registered. The latest notification baseline remains Phase 11.2.5, with remote Web Push disabled pending vetted sender integration, deployment secrets, approved database schema, scheduled worker and real device/provider acceptance. Production approval remains pending Node 24.15.x dependency-backed build, PostgreSQL/Testnet/Mainnet reconciliation and browser/mobile/two-account acceptance.
The 0.330.49 Phase 3 hardening increment closes wallet reservation transparency and recovery, makes GHC membership purchase preflight/debit serial per account, makes reward claim replay idempotent for reward-ID aliases, and verifies Pi payment identity/network/amount/transaction before binding or completing a recovered payment. The new SQL migration is REVIEW_REQUIRED and must be validated/applied by an operator after target database history reconciliation. Authenticated Testnet execution, PostgreSQL concurrency, Node 24.15.0 dependency-backed build and browser/device acceptance remain outstanding.



## 0.338.9 experience refinement

This release tightens the shared header, gives Marketplace and Community content more responsive breathing room, makes active-tab scroll reset deterministic, and prevents global keyboard shortcuts from interfering with editing or modal workflows. The 31-check UI/navigation audit is part of prebuild and static verification. Financial and database authority is unchanged; the project remains NOT APPROVED for production until Node 24.15.0, database, provider and browser/device acceptance gates pass.


## 0.338.10 — Messaging and Community transformation

This release adds a responsive multi-line message composer, bounded recent-message search inside conversations, keyboard-safe search/emoji dismissal, and safer offline/error handling for community join and invitation actions. No database migrations or financial-authority changes were introduced. See [`docs/PRIORITY_9_MESSAGING_COMMUNITY_TRANSFORMATION.md`](docs/PRIORITY_9_MESSAGING_COMMUNITY_TRANSFORMATION.md) for implementation scope and verification limits.


## 0.338.13 — Phase 1 messaging contracts

Adds durable conversation nicknames, quick-reaction/read-receipt preferences, read-receipt opt-out semantics, and GIN-indexed server-side full-history message search. Migration `20261109100001_gh_messaging_phase1_controls_search.sql` is REVIEW_REQUIRED and unapplied. See `docs/UPGRADE-WORKLOG-0.338.13.md`; Phase 1 cannot advance until remote history reconciliation, operator approval, Testnet PostgreSQL and two-account verification, plus contact-share/group-create acceptance.

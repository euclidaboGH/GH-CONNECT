# GreenHaven / GH-CONNECT

**Current source version:** `0.338.6`

Production status: **NOT APPROVED** — supported Node 24.15.0 dependency-backed typecheck/lint/build, browser/device, live database/provider and operator acceptance remain outstanding.

This repository is the canonical GreenHaven / GH Connect source tree. See `docs/SOURCE_OF_TRUTH.md` and `docs/CURRENT_BUILD_CONTEXT.md` before implementation or release work.


## Last documented hardening notes — 0.330.49 (baseline for 0.338.6)

The 0.330.48 maintenance increment begins controlled Feed reliability work: client reconciliation now matches the canonical database keyset order (`created_at DESC, id DESC`) so equal-timestamp posts produce the correct next-page cursor. Runtime and source regression checks cover the ordering contract. The 15-section / 150-essential maintenance register remains the programme-wide target; its items are not represented as completed merely because they are registered. The latest notification baseline remains Phase 11.2.5, with remote Web Push disabled pending vetted sender integration, deployment secrets, approved database schema, scheduled worker and real device/provider acceptance. Production approval remains pending Node 24.15.x dependency-backed build, PostgreSQL/Testnet/Mainnet reconciliation and browser/mobile/two-account acceptance.
The 0.330.49 Phase 3 hardening increment closes wallet reservation transparency and recovery, makes GHC membership purchase preflight/debit serial per account, makes reward claim replay idempotent for reward-ID aliases, and verifies Pi payment identity/network/amount/transaction before binding or completing a recovered payment. The new SQL migration is REVIEW_REQUIRED and must be validated/applied by an operator after target database history reconciliation. Authenticated Testnet execution, PostgreSQL concurrency, Node 24.15.0 dependency-backed build and browser/device acceptance remain outstanding.


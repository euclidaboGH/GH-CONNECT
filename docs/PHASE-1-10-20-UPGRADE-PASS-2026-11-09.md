# GreenHaven Phase 1–10 — 20 Essential Upgrade Pass

**Source:** `gh-connect@0.338.16`  
**Working patch:** source-only hardening on `0.338.16` (package version unchanged)  
**Date:** 2026-11-09  
**Scope:** two high-priority upgrades per phase, with regression contracts and explicit external acceptance boundaries.  
**Production:** **NOT APPROVED**

## Engineering disposition

This pass deliberately separates source changes from work that requires a connected Supabase project, PostgreSQL, Pi Testnet, real devices or operator approval. No live data, balances, payouts, inventory, provider state, remote migration history or deployment configuration was changed.

Two concrete implementation changes are included:

1. **Phase 6:** an additive, non-canonical SQL proposal that preserves the existing clamped PI balance fields while exposing raw available/reserved totals and an integrity signal. It is not in `supabase/migrations` and is not authorized for application.
2. **Phase 8:** marketplace commission calculation now uses the same fixed 500 bps policy as the immutable proceeds SQL snapshot. Runtime environment overrides and the unmirrored minimum-fee floor are ignored until a shared database-backed policy is designed and rehearsed.

The other items strengthen existing controls with an independent 20-point regression contract; they do not pretend that unavailable external acceptance has occurred.

## The 20 upgrades — two per phase

| Phase | # | Essential upgrade | Implementation / acceptance | State |
|---|---:|---|---|---|
| 1 — Source of truth | 1 | Release identity consistency | Package, in-app release and consolidated audit must agree on 0.338.16 before the next release increment. | Regression gate |
| 1 — Source of truth | 2 | Honest programme status | Keep Testnet/Mainnet and production blockers visible; no source-only pass may imply production approval. | Regression gate |
| 2 — Database integrity | 3 | Canonical migration inventory | Enforce 199 unique 14-digit migration versions; inventory remains a source count, not an applied-state claim. | Regression gate |
| 2 — Database integrity | 4 | Proposal isolation | Keep ledger observability proposal outside canonical migrations; CI must never push migrations. | Implemented + gate |
| 3 — Architecture & identity | 5 | Canonical GH identity only | Production Pi bearer auth must resolve a verified Pi UID to a canonical GH identity; no raw UID fallback. | Regression gate |
| 3 — Architecture & identity | 6 | Withdrawal execution isolation | User-facing trigger remains bounded/no-store and delegates authorization, ownership, consent, network and receipt checks to the protected worker. | Regression gate |
| 4 — Social & community | 7 | Unified target-ID sanitation | Follow/block target identifiers share the same bounded sanitizer. | Regression gate |
| 4 — Social & community | 8 | Honest membership state | Pending and banned community outcomes remain distinct; offline failures cannot mutate local membership state. | Regression gate |
| 5 — Messaging | 9 | Idempotency collision prevention | API message IDs must match the store's 80-character normalization limit. | Regression gate |
| 5 — Messaging | 10 | Private full-history search | Search RPC must recheck active membership and exclude deleted messages; the UI cannot rely on loaded-window-only filtering. | Regression gate |
| 6 — GHC/PI economy | 11 | Raw ledger anomaly visibility | Proposed PI balance RPC adds raw available/reserved totals plus integrity flags while preserving legacy clamped fields. | Proposal only; not applied |
| 6 — GHC/PI economy | 12 | Fail-closed balance presentation | Negative raw totals must be treated as integrity anomalies; GHC and PI remain separate assets and ledgers. | Regression gate + proposal |
| 7 — Pi identity & withdrawals | 13 | Production Pi mapping enforcement | Verified Pi `/v2/me` UID is not itself a GreenHaven user ID; missing mapping fails closed in production. | Regression gate |
| 7 — Pi identity & withdrawals | 14 | Recipient-bound payout authorization | Payout execution remains bound to the canonical account and exact authorized Pi recipient. | Regression gate |
| 8 — Marketplace & membership | 15 | App/database commission parity | Enforce canonical 500 bps until an approved shared database policy exists; ignore unmirrored environment overrides. | Implemented |
| 8 — Marketplace & membership | 16 | Remove unmirrored fee floor | Remove app-only minimum fee so seller proceeds cannot diverge from immutable SQL snapshot. | Implemented |
| 9 — Performance & UX | 17 | Safe settings export | Settings export retains versioned schema and excludes secret-bearing keys. | Regression gate |
| 9 — Performance & UX | 18 | Shared filter primitives | Cross-surface filters use shared exports; filtering is never treated as authorization. | Regression gate |
| 10 — Release engineering | 19 | Supported runtime gate | Require Node 24.15.0 and explicit typecheck, lint and production build gates. | Regression gate; runtime unavailable here |
| 10 — Release engineering | 20 | Production no-go protection | Keep production NOT APPROVED and prevent CI from applying migrations. | Regression gate |

## Newly fixed defects

### Phase 6 — PI balance integrity observability

The canonical `gh_earnings_balances` function clamps negative raw available/reserved totals to zero. That preserves a safe display value but can hide an accounting anomaly from a downstream reconciliation reader. The proposal adds `rawAvailableAtomic`, `rawReservedAtomic`, `integrityOk` and `integrityAnomalies`; existing `availableAtomic` and `reservedAtomic` remain clamped for compatibility. Before adoption, test every caller and RPC grant, then rehearse against disposable PostgreSQL. No live or canonical migration was changed.

### Phase 8 — Marketplace commission parity

The app previously read `GHC_MARKETPLACE_PLATFORM_FEE_BPS` and `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR`, while the immutable SQL proceeds snapshot uses 500 bps and no minimum floor. That allowed an app/DB policy mismatch. The app now applies 500 bps only and has no minimum fee floor. Runtime regression tests set conflicting environment values and prove they cannot change the result. A future configurable fee requires one authoritative database-backed policy and a migration rehearsal before configuration is re-enabled.

## Verification

- Existing Phase 10 release closure: 16/16 passed before this increment.
- Existing maintenance gap-fill: 20/20 passed before this increment.
- Existing project-truth check: 10/10 passed before this increment.
- Existing release hygiene: 11/11 passed before this increment.
- Final `npm run verify:static` completed with **exit 0** on Node 22.16.0 after the new checker and code changes were registered. The new 20-point regression contract passed 20/20; Phase 8 settlement source/runtime checks passed; migration manifest passed 199/199; repository consistency passed 6/6; documentation hygiene passed. This is source-level verification only.
- Node 24.15.0 is required. `node_modules` is absent. Typecheck, ESLint and Next.js production build are not claimed.
- The new 20-point regression checker must pass before this increment is accepted.

## Hard blockers that remain

1. Reconcile Testnet and Mainnet migration histories independently.
2. Complete the full migration dependency graph and disposable PostgreSQL rehearsal.
3. Execute PI/GHC ledger invariants, concurrency, idempotency, timeout-after-commit and recovery tests on PostgreSQL.
4. Perform authenticated Pi Testnet payment, payout and receipt/recovery tests.
5. Complete two-account/multi-role community, messaging and notification acceptance.
6. Complete buyer/seller inventory reservation and order settlement concurrency tests before enabling finite-stock production sales.
7. Resolve notification preference last-write-wins risk with an atomic durable preference contract before claiming cross-device concurrency safety.
8. Complete browser, Android, Pi Browser, keyboard and screen-reader acceptance.
9. Run Node 24.15.0 `npm ci`, typecheck, lint and production build.

**Decision:** two concrete source-level fixes and 20 cross-phase regression controls are prepared. External acceptance remains outstanding. Production remains **NOT APPROVED**.

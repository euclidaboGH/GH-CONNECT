# Phase 6 — GHC ledger, rewards and economy integrity audit

**Baseline:** `gh-connect@0.338.13` (Phase 5 working archive)  
**Status:** `PARTIALLY COMPLETE — DATABASE REHEARSAL AND ONE LEDGER-OBSERVABILITY GAP OPEN`  
**Scope:** GHC dual-entry transfer ledger, PI earnings ledger separation, rewards/claim issuance, withdrawal reservations/settlement, creator tips/reward pools, financial reconciliation, idempotency and recovery.

## Executive result

The reviewed source has meaningful protections: GHC transfers are represented by paired debit/credit rows and serialized balance checks; transfer-request and PI payout flows have idempotency contracts; PI earnings use integer atomic units and service-role-only ledger RPCs; rewards and payouts are server-authoritative; GHC and PI are separate rails; charity is not treated as withdrawable earnings. The focused source-contract suites listed below passed.

This is not proof of a live database or payment execution. No PostgreSQL server, disposable Supabase project, remote Testnet/Mainnet migration histories, or provider receipts were available for this audit. No migration was applied and no financial state was changed.

## Finding E6-01 — Negative ledger totals can be hidden by the PI balance RPC

**Severity:** High for auditability; not proof that a user balance is currently wrong.  
**Evidence:** `supabase/migrations/20261029010006_gh_unified_earnings_ledger.sql`, function `public.gh_earnings_balances`, aggregates available and reserved amounts from immutable ledger entries, then clamps either negative total to zero before returning it. The subsequent reconciliation consumes these reported snapshots. A corrupted, inconsistent, or historically anomalous ledger could therefore yield a displayed zero instead of exposing the negative raw aggregate; the report cannot independently distinguish that condition from a genuine zero balance using the clamped fields alone.

**Safe next change:** prepare a reviewed additive migration that preserves compatibility for existing consumers while returning explicit raw aggregates and an `integrityOk`/anomaly signal. Keep withdrawable amounts fail-closed at zero if the raw balance is negative, but ensure reconciliation degrades and exposes an operator-facing anomaly instead of presenting the ledger as healthy. Do not apply this proposal until the Phase 2 dependency graph, disposable PostgreSQL rehearsal, and Testnet/Mainnet history reconciliation are complete.

## Verified source contracts

- GHC transfer uses canonical sender/recipient balance locks, checks spendable balance and transfer limits, and validates a matching debit/credit pair on idempotent replay.
- GHC transfer-request idempotency is bound to requester, payer, amount and normalized note; conflicting reuse is rejected.
- PI earnings ledger stores integer atomic units; duplicate credit/reserve/settle/release requests are payload-bound; reserve, settle and release are serialized per user.
- PI payout settlement binds the exact Testnet recipient/network and verified receipt; uncertain outcomes retain reservations; release requires authoritative cancellation and no transaction.
- GHC and PI remain separate assets; charity remains segregated and non-withdrawable in reconciliation.
- Reward issuance and transfer authority remain server/database-side; no client-supplied balance or client-side minting was introduced by this audit.

## Targeted source checks run

| Suite | Result |
|---|---:|
| Unified earnings ledger | 20/20 |
| Available-balance and payout policy | 12/12 |
| Financial reconciliation | 12/12 |
| Economy database boundaries | 10/10 |
| Economy RPC deadlines | 11/11 |
| PI payout request lifecycle | 21/21 |
| PI settlement and recovery | 15/15 |
| Receipt/lease fencing | 13/13 |
| Treasury operations | 11/11 |
| Treasury completion | 16/16 |
| Cross-feature reconciliation | 9/9 |

These checks inspect source contracts. They do not execute SQL or prove production state. One broader wallet resilience checker reported 16/17 in the extracted archive because it requires Git metadata to prove incremental-cache files are ignored and untracked; the ZIP extraction is not a Git checkout, so that check is environment-inapplicable here. A TypeScript runtime test also could not run under the available Node `22.16.0` because it imports `.ts` directly; the repository pins Node `24.15.0`.

## Required before Phase 6 closeout

1. Reconcile Testnet and Mainnet migration histories separately; do not infer applied state from source files.
2. Run the full canonical migrations on a disposable PostgreSQL/Supabase instance with matching extensions and roles; exercise ledger invariants and rollback.
3. Add concurrency tests for simultaneous GHC sends in both directions, same-key/different-payload retries, double acceptance of transfer requests, repeated reserve/settle/release, and reward claims at maturity boundaries.
4. Verify conservation of GHC debit/credit pairs and reconcile PI gross, fee, net, reserved and paid amounts against verified provider receipts.
5. Resolve E6-01 with a backward-compatible, reviewed SQL proposal and tests before treating financial reconciliation as a complete anomaly detector.
6. Run Node 24.15.x install, typecheck, lint and production build; execute authenticated multi-account Testnet journeys with operator evidence.
7. Keep GHC/bank payouts and any PI path lacking verified external evidence disabled.

## Decision

**Phase 6 remains open.** The source-level architecture is substantially guarded, but the balance-clamping behavior is an observability gap that must be addressed before relying on the PI ledger snapshot as a complete integrity signal. No live balances, migrations, payouts, or provider transactions were changed by this phase.

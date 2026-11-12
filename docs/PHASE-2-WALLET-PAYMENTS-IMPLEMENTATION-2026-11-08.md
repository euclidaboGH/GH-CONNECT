# Phase 2 — Wallet & Payments implementation report

**Project baseline:** GreenHaven 0.330.48
**Date:** 2026-11-08
**Status:** Implemented, awaiting verification

## Scope

Phase 2 follows Feed and precedes Rewards & Membership. The audit preserved the existing GHC ledger, wallet snapshot, Pi payment intent, escrow, explicit wallet-consent, withdrawal, A2U and reconciliation authorities. No duplicate ledger or alternate wallet was introduced.

## Defect corrected

Three durable GHC spend call paths trusted a successful HTTP transport unless the PostgREST payload explicitly contained `ok: false`. A malformed payload could therefore be interpreted as a successful debit without proof of a committed ledger transaction. This was especially dangerous for marketplace orders, where the order flow could progress based on an unverified spend response.

## Implementation

- Added `lib/server/economy/spend-rpc-contract.mjs`, a shared fail-closed parser for the durable `ghc_execute_spend` response.
- Applied it to `app/api/economy/ledger/spend/route.ts`.
- Applied it to `app/api/marketplace/orders/[orderId]/pay/route.ts`.
- Applied it to `executeDurableGhcSpend` in `lib/server/economy/store.ts`, covering premium utility and related durable spend consumers.
- Required explicit `ok: true`, matching reference, matching amount at four-decimal GHC precision, boolean idempotency status and transaction ID.
- Added bounded 10-second timeouts and `cache: no-store` to all three durable RPC requests.
- Changed ambiguous marketplace spend failures to retryable 503 responses; the order payment claim remains held for idempotent recovery. Definite insufficient balance returns 402 and releases the claim; idempotency conflict returns 409.
- Added source and payload tests and registered them in `prebuild` and `verify:static`.

## Test evidence

| Check | Result |
|---|---:|
| New spend RPC source contract | 10/10 |
| New spend RPC payload tests | 13/13 |
| Wallet completion | 12/12 |
| Wallet transfer integrity | 8/8 |
| Wallet authorization | 27/27 |
| Wallet security hardening | 11/11 |
| Payment-intent hardening | 11/11 |
| Wallet ledger resilience | 17/17 |
| Wallet amount helpers | 20/20 |
| Payment request body bounds | 20/20 |
| Cross-feature wallet reconciliation | 32/32 |
| Marketplace payment binding | 17/17 |
| Marketplace RPC transport | 12/12 |
| Additional withdrawal, payout, receipt-fencing, A2U, treasury and financial gates | Passed |

## Safety boundaries

- No ledger history or financial balance was rewritten.
- No Supabase migration was added, changed, applied, reordered or removed.
- No provider payment was executed and no production deployment was made.
- Pi and GHC remain separate rails.
- Existing Testnet-only/fail-closed A2U and explicit wallet consent remain intact.

## Remaining acceptance

1. Install dependencies and run typecheck/build under the project-required Node 24.15.0 runtime.
2. Verify the target Supabase schema has the intended final `ghc_execute_spend` definition and execute tests against an isolated database.
3. Exercise concurrent spend requests, same-reference same-amount retries, same-reference different-amount conflicts, timeout-after-commit recovery, and withdrawal-lock contention.
4. Verify authenticated browser/mobile wallet flows and marketplace order recovery.
5. Complete Pi Testnet approval, completion, incomplete-payment recovery, refund and payout reconciliation with operator-controlled test accounts.

**Acceptance decision:** Phase 2 is implemented but not verified complete. Static checks cannot substitute for database, provider, browser or Testnet evidence.

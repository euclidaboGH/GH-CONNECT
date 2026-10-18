# Phase 9.1 — Marketplace Payment/Expiry Race Hardening

**Status:** source-only hardening candidate. Not deployed; no migration applied. SQL execution and real concurrent database tests remain required.

## Finding addressed

The Phase 9 candidate atomically reserved inventory, but an order could be expired and its stock released while a payment request was in progress. A stale request could then try to persist payment against an order whose inventory had already been released.

## Source changes

- Added `payment_claimed_at` to durable marketplace orders.
- Added `gh_marketplace_order_claim_payment(text, text, text)`, which locks the order row, checks buyer/currency/status/reservation expiry, and grants one payment claim.
- Added `gh_marketplace_order_release_payment_claim(text, text, text)` for a definite payment failure.
- Expiry skips claimed reservations. The verified-payment status trigger clears the claim and commits the reserved stock.
- The API claims inventory before GHC ledger spend, and only after validating a completed, amount-matched Pi intent for Pi payments.
- Pi intents must use the `marketplace` purpose and reference the order being paid; a unique partial index prevents one intent from being attached to multiple orders.
- Concurrent payment attempts are rejected while a claim is active.
- A definite GHC failure releases the claim. A transport/server failure with an ambiguous outcome intentionally leaves the claim in place to avoid releasing inventory after a potentially committed payment.
- Static regression coverage now checks the claim RPC, expiry exclusion, currency-specific claims, and failure-release wiring.

## Operational consequence

A claimed payment with an ambiguous outcome may hold stock until an operator or future automated reconciliation process determines whether the ledger/payment provider committed. This is an intentional safety-over-availability choice. Before rollout, define monitoring and a controlled recovery procedure that reconciles the GHC spend reference or Pi intent/provider transaction before releasing stock.

## Validation performed

- Marketplace inventory reservation static tests: 36/36 passed.
- Marketplace order payment-gate tests: 14/14 passed.
- All repository `scripts/test-*.mjs` tests: 86 scripts, 0 failures.
- Release hygiene: 10/10 passed.
- TypeScript syntax transpilation checks: 5/5 changed TypeScript files passed.
- Migration release-readiness static check passed, with 10 future-dated migrations still requiring review.
- ZIP integrity must be checked on the final archive after this follow-up patch.

## Additional review finding addressed

A completed Pi intent was previously validated by buyer and amount but not bound strongly enough to a specific marketplace order. The route now checks the intent purpose and reference ID, and the migration adds a unique partial index for `payment_intent_id`. Because the index can fail if the target database already contains duplicate non-null intent IDs, inspect existing data before applying it.

## Not verified

- SQL was not executed by PostgreSQL; no `psql` or PostgreSQL parser is available in this environment.
- No disposable database or Supabase Testnet connection was available, so concurrency, row locks, trigger behavior, RPC grants and rollback semantics have not been runtime-tested.
- Full TypeScript typecheck, ESLint and Next.js production build were not run because `node_modules` / the Next.js binary are absent.
- No live migration, Git push, deployment, Pi payment or Mainnet operation occurred.

## Release gate

Keep finite-stock production sales disabled until a disposable PostgreSQL/Testnet run validates concurrent last-unit reservations, idempotent replay, reservation expiry, payment-claim/expiry races, duplicate payment attempts, GHC timeout-after-commit recovery, Pi intent recovery, cancellation restoration and permissions. Reconcile Testnet and Mainnet independently.

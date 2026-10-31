# Phase 9 — Wallet Transaction Integration

Release: `0.98.0`

## Scope

This phase improves the Pi payment-intent history presentation and data integrity while preserving the distinct GHC ledger rail. It normalizes numeric amounts even when JSON/PostgREST supplies numeric strings, keeps currency explicit, exposes payment references and provider payment identifiers, provides readable labels for supported payment purposes, and distinguishes provider completion from actual feature fulfilment.

The wallet no longer substitutes the current time when a payment row has no valid creation timestamp. Missing timestamps remain unknown rather than being represented as a fabricated recent transaction. The payment-intent store mapper also avoids synthesizing a current timestamp for absent creation time.

## Authority and safety

- GHC balances and activity remain sourced from the server-owned `ghc_transactions` ledger/projection.
- Pi history remains sourced from authenticated, user-scoped `ghc_payment_intents` records.
- Pi and GHC are not merged into a combined balance or transaction rail.
- This phase adds no database migrations, no synthetic transaction rows, no balance mutation, and no changes to provider settlement or fulfilment logic.
- Payment-intent API remains authenticated and no-store.

## Verification

Run `npm run check:phase9-wallet-transactions` and `npm run verify:static` under the supported Node.js 24 runtime. Source contract checks do not replace typecheck, lint, build, or live Testnet verification.

## Known follow-up

The shared history is not yet a cross-source reconciliation engine. Phase 10 should map each feature's authoritative event and ledger records, reconcile payment intent -> provider completion -> fulfilment/entitlement, and surface discrepancies without rewriting financial records. Phase 11 should complete transaction detail/receipt UI and multi-account concurrency/authorization testing.

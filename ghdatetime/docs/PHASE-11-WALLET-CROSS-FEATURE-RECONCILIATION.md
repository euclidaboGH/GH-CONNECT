> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 11 — Wallet cross-feature reconciliation

## Scope

The authenticated `GET /api/payments/reconciliation` endpoint compares Pi payment intents against authoritative marketplace order and membership entitlement records where mappings exist. It is read-only, user-scoped, rate-limited, cache-disabled, and bounded to five concurrent feature lookups. GHC ledger transfers remain a separate asset rail. Unsupported feature mappings remain explicitly unverified.

## Integrity improvements in v0.157.11

- Marketplace order references resolve only the canonical order ID or the explicitly supported `market_order_` prefix; the loaded order ID is rechecked before payment matching. Marketplace matches require at least one exact payment identifier. If both an intent ID and provider payment ID are stored, contradictory values are surfaced as an attention finding instead of allowing one matching field to hide the conflict.
- A linked order is not marked matched unless its persisted currency/payment method agree with the PI rail and the positive, finite order total matches the intent amount within the payment flow's `0.001` tolerance.
- `REFUNDED`, `FAILED`, and `CANCELLED` intents require corresponding authoritative order state. A refunded intent cannot be reported as reconciled merely because an order is not currently marked paid.
- Membership reconciliation matches the canonical `paymentIntentId`; only when that field is absent does it accept the provider payment ID or `pi:<intent-id>` purchase reference. It no longer uses a potentially reusable product/reference ID as proof that an old payment granted the current entitlement.
- User ID is rechecked in the route even though the durable store query is already user-scoped. An order owned by another account is not described in a way that exposes its state.
- The payment-intent store exports `PAYMENT_INTENT_HISTORY_LIMIT`, and the reconciliation endpoint uses the same constant. Coverage reports both returned records and Pi records actually reconciled.

## Reliability and safety contracts

- No payment, balance, order, entitlement, or fulfilment writes are performed.
- A missing authoritative feature record is not treated as proof of payment failure.
- The endpoint does not merge GHC/internal ledger records into Pi reconciliation.
- The 100-record cap is disclosed; a capped report is not a lifetime audit and a full page only signals possible truncation.
- Feature mappings not explicitly implemented remain unverified.

## Verification

Run `npm run check:phase11-wallet-reconciliation` and the consolidated static suite. These are source contracts, not live payment or database tests. Browser acceptance, supported Node.js 24 build checks, live provider/Testnet verification, and disposable-database tests remain required before deployment. No production database or financial records were changed by this phase.

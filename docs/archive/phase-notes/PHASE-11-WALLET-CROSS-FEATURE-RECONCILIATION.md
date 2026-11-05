> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 11 — Wallet Cross-Feature Reconciliation

Release: `0.100.0`

## Implemented

- Added authenticated, user-scoped, read-only `GET /api/payments/reconciliation`.
- Reconciles marketplace Pi payment intents against the durable marketplace order store using the intent reference, buyer ownership, payment-intent/provider-payment linkage, payment method/currency, payment status and order lifecycle.
- Reconciles membership intents against durable membership entitlement state, requiring a direct payment-intent or purchase-reference match. A memory/default entitlement source is explicitly reported as unverified.
- Returns `matched`, `attention_required`, `unverified`, and `not_applicable` findings with stable diagnostic codes; unknown feature mappings are not guessed.
- Wallet Pi rail calls the endpoint and shows server-side reconciliation counts and actionable findings.
- GHC ledger remains separate; this feature does not merge Pi intents into GHC transactions.

## Safety boundaries

This endpoint is read-only. It does not transition payment intents, grant entitlements, mutate orders, adjust balances, or initiate provider calls. An unavailable order is reported as unverified, not automatically as failed. Only the authenticated user's own payment intents are queried, and marketplace order ownership is checked before displaying its state.

## Remaining verified limitation

Cross-feature mappings are now implemented for marketplace and membership only. Curation, utilities, boosts, sponsored listings, digital products, donations, premium features, verification, refunds and other categories remain explicitly unverified until their authoritative server records and stable reference contracts are confirmed. Creator/seller/reward payouts are classified as non-purchase categories and are not assessed as purchase fulfilment. This is the complete safe Phase 2 scope for mappings supported by current source contracts, not proof that every feature is reconciled in the live deployment.

## Verification

- `scripts/check-phase11-wallet-cross-feature-reconciliation.mjs` validates auth scoping, durable source use, owner/link checks, read-only behaviour and wallet integration.
- Full static suite, safety scan, TypeScript, lint, production build, DB integration and live Testnet transactions must be run in the project's supported Node.js `24.15.0` environment before deployment sign-off.
- No live database writes, migrations or Pi provider calls were made during this change.

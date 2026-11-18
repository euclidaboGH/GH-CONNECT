> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 12 — Pi transaction details and portable receipts

Release: `0.101.0`

## Implemented

- Adds a focused transaction detail sheet to each Pi payment-intent row without mixing Pi intent records into the authoritative GHC ledger.
- Shows the stored purpose/product, amount when valid, currency, current status, creation date when known, intent ID, reference ID, provider payment ID, and product ID when present.
- Surfaces the matching read-only server reconciliation finding where one exists.
- Adds client-side copy, native share, and plain-text receipt export so users can preserve identifiers for support.
- Adds status-specific guidance for paid-but-not-fulfilled and failed/incomplete payment records, including duplicate-payment caution.
- Accessible modal semantics, close button and Escape handling.

## Integrity and security boundaries

- The receipt is a presentation of available intent fields, not a provider-generated receipt, proof of settlement, or proof of fulfilment.
- No transaction timeline is invented: historical provider event timestamps are not available in the intent list contract.
- Missing amounts, dates, references, and provider IDs remain unavailable instead of being fabricated.
- Receipt generation is local and read-only; it does not call payment APIs, mutate balances, change intent status, or grant entitlements.
- GHC ledger transaction details remain separate from Pi payment intents.

## Verification

Run `node scripts/check-phase12-pi-transaction-details.mjs` and the combined `npm run verify:static` in the required Node.js `24.15.0` environment. This source-level checker does not replace TypeScript, lint, production build, accessibility review, or authenticated Pi Testnet end-to-end tests.

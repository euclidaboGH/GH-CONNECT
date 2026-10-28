# Phase 9 — Wallet Transaction Integration

Release: `0.157.8`

## Delivered in this increment

- Hardened the canonical Pi transaction projection: a row must have a bounded, control-character-free intent ID, explicit PI currency, and a positive amount with no more than eight decimal places. Boolean, blank, hexadecimal, missing, malformed, excessive, or zero amounts are rejected rather than represented as valid transaction history.
- Bounded and validated provider payment IDs, references, purpose/status labels, and product metadata before exposing them to the wallet presentation layer. Unknown non-empty purposes remain identifiable; they are not silently reclassified.
- Rejected implausibly future timestamps instead of presenting them as trustworthy history. Missing/invalid timestamps remain unknown; the current time is never substituted.
- Hardened payment-intent creation input parsing so JSON booleans and blank/malformed numeric strings cannot be coerced into amounts; amount precision is capped at eight decimal places. Invalid metadata types, non-string references, and control characters in references/idempotency keys are rejected; intent endpoint errors use explicit no-store headers.
- Preserved authenticated user-scoped history, explicit `provider === "pi"` and `currency === "PI"` filtering, read-only reconciliation, bounded feature-store concurrency, buyer ownership checks, and durable membership entitlement checks.

## Reconciliation boundaries

The reconciliation endpoint is diagnostic-only. It reads authenticated-user payment intents and authoritative feature records where mappings exist. It never mutates payments, orders, entitlements, balances, or fulfilment. Missing feature mappings remain unverified; absence of a record is not treated as proof of payment failure. The marketplace mapping validates buyer ownership and linked payment identifiers. Membership checks require a durable database-backed entitlement result. The report discloses the 100-record store limit and potential truncation.

## Verification and limits

Run `npm run check:phase9-wallet-transactions` and `npm run verify:static` under the supported Node.js 24 runtime. Source checks do not replace TypeScript, lint, production build, browser/device acceptance, provider Testnet tests, or disposable-database concurrency testing. No migration, provider call, production write, or fabricated settlement evidence was introduced by this phase.

# GreenHaven v0.157.11 — Phase 11 reconciliation integrity worklog

Date: 2026-10-28

## Findings addressed

1. Marketplace references can be stored as either an order ID or the known `market_order_`-prefixed form. Reconciliation now safely normalizes only that explicit prefix and rechecks the loaded order ID. Marketplace reconciliation previously allowed an exact match on one payment identifier to hide a conflicting second identifier. It now flags conflicting persisted intent/provider references.
2. A payment could be counted as reconciled without checking the order total against the payment-intent amount or verifying that the order's payment method and currency agree with the PI rail. Those checks now fail to attention-required.
3. Terminal payment states were grouped under a broad "not paid" condition, which could incorrectly classify a refunded intent as reconciled while the order remained completed or otherwise inconsistent. Refund, failure, and cancellation states now have separate authoritative agreement checks.
4. Membership reconciliation could match an active entitlement using a reusable `referenceId`. It now prefers exact `paymentIntentId`, with provider payment ID or `pi:<intent-id>` fallback only when the canonical intent field is absent.
5. The store's 100-record query limit was duplicated in reconciliation logic. The limit is now exported from the intent store and shared by the endpoint, reducing drift risk. Coverage includes both returned record count and PI intent count reconciled.

## Files changed

- `app/api/payments/reconciliation/route.ts`
- `lib/server/payments/intent-store.ts`
- `scripts/check-phase11-wallet-cross-feature-reconciliation.mjs`
- Release metadata, README, Phase 11 report, project-truth and acceptance documentation

## Verification boundary

Static/source contracts can detect regressions in the documented invariants but cannot prove SQL/RPC runtime behavior, provider truth, account-level isolation under a live database, or UI/browser acceptance. No payment, entitlement, order, ledger, or production database was mutated. Node.js available in this environment is 22.16.0, below the repository's Node.js 24.15.0 requirement; dependencies are not installed, so TypeScript, lint and production build are not claimed.

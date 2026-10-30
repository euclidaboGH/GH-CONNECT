# GreenHaven upgrade worklog — v0.199.0

## Phase 22 — Marketplace audited financial adjustments and payout fencing

- Added `gh_marketplace_order_adjustments`, an append-only adjustment journal keyed to canonical marketplace orders and separated by PI/GHC currency.
- Supports explicit refund, chargeback, dispute-award and dispute-reversal adjustment classifications. Gross adjustment and seller-net reduction are stored independently; amounts are bounded against the verified order and seller-net snapshot.
- Added service-role-only, idempotent adjustment intake. It requires an existing immutable Phase 20 proceeds snapshot and an upstream evidence fingerprint. Replayed keys with changed payloads fail closed.
- Adjustments after an order has been allocated to a payout are rejected and require a separate payout reconciliation workflow. This avoids silently changing a reserved or paid liability.
- Replaced seller payout reservation to reserve `seller_net - posted seller-net adjustments`, lock candidate orders in deterministic order, and conserve allocations.
- Added a shared seller/currency advisory lock for payout reservations, adjustments and order lifecycle changes to reduce refund/dispute-vs-payout races.
- Added static source-contract checks to `verify:static` and prebuild.

## Critical boundaries and outstanding acceptance

- Migration `20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql` is `REVIEW_REQUIRED` and unapplied. It depends on Phase 20 proceeds, Phase 21 lifecycle events, and existing payout/order tables. Reconcile remote migration history and validate on disposable PostgreSQL before Testnet.
- The RPC records an adjustment only; it does not call Pi, GHC, Paystack or any provider to execute a refund, chargeback, transfer or reversal. Trusted server code must verify provider evidence and make the decision before calling the service-role RPC.
- Seller-net reduction is explicit, not inferred from gross refund. Commercial policy must define the correct seller/platform split for partial refunds, chargebacks and dispute awards.
- Payouts already allocated before Phase 22 are not rewritten. Existing gross-based allocations and settled requests require a separately approved historical reconciliation plan.
- The payout lock lane coordinates this migration's adjustment/order/payout functions. All other order-mutating RPCs, payout status transitions and external settlement workers must be reviewed to ensure they use compatible locking and do not bypass the service boundary.
- Treasury's existing report has not yet been replaced to include the new adjustment journal; the next integration gate must expose gross adjustments, seller-net reductions, reserved liabilities and paid settlements from the same canonical sources.
- Community paid membership/renewal entitlement integration, social sections, and broader platform performance/accessibility work remain in the system-wide roadmap; they are not claimed as delivered by this marketplace increment.
- No disposable PostgreSQL runtime, Supabase Testnet, authenticated PI/GHC provider test, supported Node.js 24.15.0 build, Git push or deployment was available/performed. No live database was changed.

## Verification scope

Static contract checks only. These do not prove SQL syntax, RLS runtime, ACL behavior, transaction isolation, provider execution, or end-to-end correctness.


Verification is source-only; isolated helper tests, supported Node.js 24.15.0 typecheck/lint/build, PostgreSQL execution, and Testnet acceptance are still required.

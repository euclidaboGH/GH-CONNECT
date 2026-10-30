# v0.201.0 — Phase 24 financial exception detail

## Scope

- Added bounded, service-role-only, read-only payout allocation diagnostics that join canonical payout requests/allocations to immutable seller proceeds snapshots and append-only adjustments.
- Classifies missing proceeds snapshots, seller/currency mismatches and allocation differences without rewriting historic allocations or asserting external settlement proof.
- Added bounded, service-role-only membership payment-to-entitlement diagnostics that check canonical purpose/product, user identity, payment completion, intent linkage and expiry.
- Membership diagnostics never grant or renew access and explicitly state that a linked payment intent is not independent provider settlement evidence.
- PI and GHC remain separate; the new reports are diagnostics, not a new balance authority.

## Validation

- Static source-contract checks are included in `verify:static` and `prebuild`.
- The migration is REVIEW_REQUIRED and must be tested on a disposable PostgreSQL database after reconciling target migration history.
- Real concurrent transaction, rollback, authenticated provider, Node 24 production build and mobile browser acceptance are not claimed by this source-only release.

## Operational safety

Do not automatically correct historical payout rows. Export discrepancies, compare provider settlement evidence and original payout evidence, obtain operator approval, then apply a separately reviewed append-only correction. Do not grant community access from status alone; provider evidence and the canonical product/catalog amount must be validated by the trusted payment workflow.

The checks in this worklog are source-level checks only. This environment currently exposes Node.js 22.16.0, not the required Node.js 24.15.0; supported-runtime TypeScript/lint/build acceptance and real PostgreSQL/Testnet validation have not been performed.

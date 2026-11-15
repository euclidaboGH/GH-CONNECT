# Phase 8 — Marketplace, Membership & Cross-Domain Settlement

Date: 2026-11-09  
Source baseline: `gh-connect@0.338.13`, Phase 7 archive  
Status: **PARTIALLY COMPLETE — source-level settlement precision fix; live financial verification outstanding**

## Scope

This increment audits the boundaries connecting marketplace payment verification, immutable seller-proceeds snapshots, platform revenue journaling, and membership entitlement purchases. It intentionally does not apply SQL, change ledger balances, issue refunds, execute payouts, or alter Testnet/Mainnet settings.

## Finding P8-01 — Application and durable proceeds used different commission precision

`lib/server/marketplace/commission.ts` previously rounded gross order amounts to four decimal places before calculating the application-side commission. The durable proceeds migration `20261030010009_phase20_marketplace_net_proceeds.sql` calculates commission at eight decimal places and stores `numeric(18,8)`. For an order of `10.12345678` at 500 basis points, the application previously calculated `0.5061`, while the SQL snapshot calculates `0.50617283`. The mismatch could cause the revenue journal and seller-proceeds snapshot to disagree even when the basis-point policy is otherwise the same.

**Implemented:** application-side gross, fee and seller-net calculations now use eight-decimal scaling and integer `BigInt` arithmetic, matching the SQL formula's precision and floor behavior. Added `scripts/test-phase8-cross-domain-settlement.mjs` to verify the representative split and boundary cases.

## Finding P8-02 — Runtime commission configuration is not fully shared with SQL

The application reads `GHC_MARKETPLACE_PLATFORM_FEE_BPS` and `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR`; the immutable proceeds SQL currently hardcodes `v_bps := 500` and has no corresponding minimum-fee floor. Therefore a non-500 runtime basis-point override or a positive minimum-fee setting can still make application-side revenue-journal values differ from the database snapshot.

**Not silently changed:** removing existing configuration support or rewriting a historical migration would be an unsafe, uncoordinated policy change. Until a future additive database-backed commission-policy design is approved and rehearsed, the safe operational constraint is to keep `GHC_MARKETPLACE_PLATFORM_FEE_BPS` unset or `500` and `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR` unset/`0`. Treat any other setting as a release blocker for marketplace settlement parity.

## Existing controls reviewed

- Marketplace PI payment must use a durable, owned Pi intent with PI currency, marketplace purpose, matching order reference and server-side amount.
- GHC marketplace spending uses the durable spend RPC and a reference bound to the order.
- Seller proceeds are stored in an immutable order snapshot and payouts are allocated from eligible seller net, not gross order value.
- GHC membership purchase uses an atomic spend-plus-entitlement RPC; the current UI generates a purchase-attempt-scoped reference.
- Pi membership activation requires a completed/fulfilled verified Pi intent, matching server catalog price and exact `membership_<tier>_<period>` product ID.
- No historical migration was edited and no new migration was added in this increment.

## Verification

The new Phase 8 test covers eight-decimal commission parity, minimum-fee behavior, gross caps, invalid gross rejection, current membership request contracts, and the SQL proceeds formula. Run it with:

```bash
node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/test-phase8-cross-domain-settlement.mjs
```

Selected adjacent suites to run: `check-phase18-marketplace-payment-binding.mjs`, `check-phase19-marketplace-rpc-transport.mjs`, `check-phase20-net-proceeds.mjs`, `check-phase21-marketplace-event-journal.mjs`, `check-phase22-marketplace-adjustments.mjs`, `check-phase9-membership-foundation.mjs`, `check-phase9-membership-lifecycle` and `check-migration-source-manifest.mjs`.

## Not verified / exit criteria

- No PostgreSQL rehearsal or Testnet/Mainnet migration-history reconciliation was performed.
- No provider payment, refund, seller payout, GHC debit, membership purchase or renewal was executed.
- No runtime environment values were inspected; operator must verify the commission settings in each deployment environment.
- Supported Node 24.15.x full build/lint/typecheck remains outstanding because this workspace has Node 22.16.0 and dependencies are not installed.
- Cross-domain DB concurrency, payment replay, refund/payout race, and entitlement recovery tests remain required before release.

**Phase 8 decision:** one confirmed application-vs-SQL precision mismatch is corrected at source. Commission policy configuration parity remains an explicit release blocker. This phase is not database-applied, Testnet-verified or production-certified.

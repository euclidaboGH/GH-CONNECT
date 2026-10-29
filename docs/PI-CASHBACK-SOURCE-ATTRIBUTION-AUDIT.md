# GreenHaven Pi cashback source-attribution audit — v0.157.23

Status: source audit and first source integration; **not payout-ready**. The associated cashback migration is `REVIEW_REQUIRED` and unapplied.

## Policy boundary

Cashback is 3% of the net eligible company revenue attributable to a user's verified PI spending in a fixed four-month UTC period. It is not 3% of gross spend. Only verified PI-denominated company revenue may be eligible. Seller proceeds, GHC ledger activity, unverified callbacks, unsettled revenue, arbitrary metadata, and test transactions are excluded. PI amounts are stored in integer 10^-7 PI atomic units.

## Source inventory

| Source | Code path reviewed | Payer / revenue evidence | Cashback status |
|---|---|---|---|
| Marketplace PI purchase | `app/api/marketplace/orders/[orderId]/pay/route.ts` | Authenticated order owner (`order.buyerId`); payment intent must belong to that user, be `marketplace`, reference that order, be completed/fulfilled, and amount-match. Revenue basis is server-calculated platform commission, not seller proceeds. Event time comes from the completed intent timestamp. | **Wired in v0.157.23** via attributed append RPC, explicitly PI-only and opt-in. Verified-order recovery retries the idempotent revenue journal append without submitting a new Pi payment. |
| Marketplace GHC purchase | Same route, GHC branch | GHC ledger spend and internal utility accounting; not a Pi revenue event. | **Excluded** from Pi cashback. |
| Membership payments | `app/api/payments/fulfill/route.ts`, `app/api/membership/activate/route.ts`, `app/api/membership/reconcile/route.ts` | Payment intents and fulfillment exist, but this increment does not prove the full revenue/refund accounting source and ownership mapping. | **Not wired** until eligible net company revenue and refund linkage are documented. |
| Promotion / sponsored listing / digital services | Payment-intent routes and relevant feature fulfilment paths | Candidate platform revenue, but must be matched to the actual completed PI intent and the specific product's fulfillment/settlement evidence. | **Not wired**; eligibility must be approved per source. |
| Creator tips | `app/api/social/tips/route.ts` and verified tip settlement migrations | Tipper and creator payables are different from company revenue; only a verified platform commission, if one exists, could qualify. | **Not wired**; never cashback the creator's payable amount as platform revenue. |
| GHC pack acquisition using PI | GHC pack / payment-intent paths | PI received for a utility purchase may have separate issuance, redemption and refund obligations. | **Not wired** until finance policy distinguishes gross receipts from obligations and refunds. |
| Refunds / chargebacks | No complete cashback-linked compensation producer established in this increment | The new attributed RPC requires a refund/chargeback to reference an original eligible PI source event and match the original payer. | **Not wired**. No post-period clawback is automated; late adjustments require a separately approved carry-forward policy. |
| Pi ad rewards | `app/api/ads/verify/route.ts` | Ad reward validation is not the same as company revenue earned from the user's spending. | **Not cashback revenue** by default. Treat as a separately funded bonus only if the provider's eligibility and funding terms allow it. |

## Implemented in v0.157.23

- Additive payer attribution (`paying_user_id`), explicit `cashback_eligible` opt-in and `related_source_event_id` to the append-only company revenue journal.
- A service-role-only attributed append RPC that rejects cashback eligibility unless the provider/currency/payer are valid, and requires refunds/chargebacks to point to an eligible original source event owned by the same payer.
- Four-month UTC period-close RPC, fixed Jan/May/Sep period starts, exact integer arithmetic, unique period windows, unique user/period/policy entitlements, no early close, and duplicate/concurrent close recovery.
- Marketplace PI platform commission passes the authenticated buyer ID and completed intent timestamp. Existing unattributed journal entries are not silently reassigned to users; idempotency conflicts fail safely.
- A static regression contract verifies the financial boundaries and reference calculation.

## Still required before the feature can be shown as withdrawable

1. Review and validate the migration on disposable PostgreSQL, including RPC grants, append-only triggers, concurrency and all window boundaries.
2. Reconcile migration history independently for Testnet and Mainnet before any application.
3. Wire and test each approved payment source and a compensating refund/chargeback source; add a backfill proposal only if historical transactions can be proven to belong to the canonical payer.
4. Decide how late events/refunds after a closed period are carried forward, how minimum withdrawal works, and what source proves available payout funding.
5. Add user-scoped read APIs and statement UI under Rewards Center / Wallet, with no client table access.
6. Implement separate reward-payout intents and connect them to the approved, globally serialized A2U execution/recovery path only after Testnet verification.
7. Confirm GreenHaven's actual Pi Mainnet A2U/outgoing-wallet eligibility with Pi; code cannot grant that permission.

This audit does not establish remote database state, actual provider settlement, or Mainnet listing approval.

# GreenHaven VIP/VVIP pricing reconciliation — 2026-10-18

## Canonical list prices
- VIP: 150 GHC per paid month; 1,800 GHC undiscounted for 12 paid months.
- VVIP: 300 GHC per paid month; 3,600 GHC undiscounted for 12 paid months.
- Every plan grants one additional bonus month.
- GHC discounts apply to paid duration only: 1 month 0%, 4 months 5%, 8 months 10%, 12 months 20%.

| Paid duration | Discount | VIP list | VIP charge | VIP access | VVIP list | VVIP charge | VVIP access |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 month | 0% | 150 | 150 | 2 months | 300 | 300 | 2 months |
| 4 months | 5% | 600 | 570 | 5 months | 1,200 | 1,140 | 5 months |
| 8 months | 10% | 1,200 | 1,080 | 9 months | 2,400 | 2,160 | 9 months |
| 12 months | 20% | 1,800 | 1,440 | 13 months | 3,600 | 2,880 | 13 months |

## Implemented in this candidate
- Added `lib/membership-pricing.ts` as the shared GHC price calculation policy.
- Updated domain and server membership catalog annual GHC charges to 1,440 VIP / 2,880 VVIP.
- Updated yearly spend catalog entries to derive their charges from the shared policy.
- Updated membership comparison display to show 150/300 monthly and 1,440/2,880 discounted yearly GHC charges.
- Added `scripts/test-membership-pricing.mjs` and wired it into `ci:verify`.
- Updated Phase 7 roadmap and referral calculation rule: 5% applies to actual qualifying VIP GHC charged after discount. Thus the 12-month VIP referral example is 72 GHC (5% of 1,440).

## Not yet complete
The runtime membership flow still accepts only monthly/yearly period identifiers. The four duration choices, bonus-month entitlement expiry, matching durable Pi products, payment-intent product IDs, UI selector and end-to-end activation must be implemented as one Phase 7 feature before the four plans are advertised as available. This candidate does not claim those four plans are live. Pi prices remain a separate price rail and must not be inferred from GHC pricing.

No live database, Testnet or production deployment was changed by this work.


## Phase 7 implementation update — four subscription durations

The source candidate now exposes 1-, 4-, 8-, and 12-paid-month VIP/VVIP packages. Each grants one bonus calendar month; the GHC price is calculated server-side from the canonical monthly base and discount schedule (0%, 5%, 10%, 20%). The API accepts only supported paid-month counts, and entitlement expiry uses calendar-month arithmetic rather than assuming every month is 30 days.

Both GHC and Pi checkout support all four paid durations (1, 4, 8 and 12 months) for VIP and VVIP. Pi uses its own monthly base prices (VIP 1.5 π; VVIP 3 π) and the same 0%, 5%, 10% and 20% duration discount schedule. Each package grants one bonus calendar month. These are separate in-app prices, not a claim that GHC is redeemable for Pi or a public exchange rate.

This is source-level implementation only. It still requires typecheck/build, database-backed Testnet payment/entitlement verification, and an atomicity review of the existing spend-then-entitlement sequence before production release.

# Phase 7 follow-up — Pi membership pricing parity

Date: 2026-10-18  
Project: GH-CONNECT 0.61.1  
Status: Source candidate; live Pi/Testnet fulfillment remains unverified.

## Pricing decision

The existing product reference uses VIP at 1.5 Pi per paid month and VVIP at 3 Pi per paid month. Preserve those base prices and apply the same discount schedule as GHC. Pi and GHC are separate in-app payment prices; this is not a public exchange rate or a promise that GHC can be redeemed for Pi.

| Tier | Paid duration | List price | Discount | Pi charged | Access including bonus |
|---|---:|---:|---:|---:|---:|
| VIP | 1 month | 1.50 π | 0% | **1.50 π** | 2 months |
| VIP | 4 months | 6.00 π | 5% | **5.70 π** | 5 months |
| VIP | 8 months | 12.00 π | 10% | **10.80 π** | 9 months |
| VIP | 12 months | 18.00 π | 20% | **14.40 π** | 13 months |
| VVIP | 1 month | 3.00 π | 0% | **3.00 π** | 2 months |
| VVIP | 4 months | 12.00 π | 5% | **11.40 π** | 5 months |
| VVIP | 8 months | 24.00 π | 10% | **21.60 π** | 9 months |
| VVIP | 12 months | 36.00 π | 20% | **28.80 π** | 13 months |

## Changes in this follow-up

- Added active GH Pay catalog products for all eight tier/duration combinations.
- Added all eight Pi membership plans to the GH Pay product surface.
- The premium membership confirmation offers both Pi and GHC for each of the four paid durations.
- Corrected payment fulfillment: completed four- and eight-month Pi purchases now retain their exact billing period when the server activation endpoint is called. Previously, the completion mapper accepted only monthly and yearly, which could leave a valid 4/8-month Pi payment without the matching entitlement.
- Corrected the generic GH Pay VIP monthly fallback to use the canonical 1.5 π price rather than 1 π.
- Kept Pi price calculation in `lib/membership-pricing.ts` and expanded `scripts/test-membership-pricing.mjs` to check all eight active Pi products and exact period mapping.
- Updated documentation that previously described 4- and 8-month Pi products as disabled.

## Verification

- `node scripts/test-membership-pricing.mjs` passed.
- `node scripts/test-economy-v12.mjs` passed (174/174); its old literal-price assertion was updated to assert use of the canonical pricing helper.
- All 84 `scripts/test-*.mjs` scripts passed.
- `node scripts/test-10-phase-baseline.mjs`: 8/8 passed.
- `node scripts/test-vercel-build-repair.mjs`: 9/9 passed.
- `node scripts/check-release-hygiene.mjs`: 10/10 passed.

## Release gates still outstanding

- A clean dependency installation, full TypeScript typecheck, ESLint and Next.js production build have not been run in this workspace.
- Test the Pi payment lifecycle in authorized Testnet/Pi Browser: approval, completion, exact product/tier/period binding, callback replay, activation retry, cross-device recovery and bonus-month expiry.
- Confirm all eight product IDs and amounts against the actual deployed GH Pay payment-intent configuration before production release.
- No live database migration, Pi payment, Git push, Vercel deployment or Mainnet operation was performed for this follow-up.

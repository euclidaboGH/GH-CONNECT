# Phase A — Daily claim & Rewards visual system (0.171.0)

## Goal
Replace prototype rectangular daily-reward cards with a premium pill claim control and clear GHC vs PI separation.

## Delivered
- `DailyRewardFeedCard` → compact **rounded-full** claim pill (coin + Claim CTA)
- Claimed state → soft status pill with Lagos countdown (not a long slab)
- Rewards Centre banner: **GHC daily** vs **PI cashback 0.5% quarterly**
- Claim readiness remains **settings-only** (operator chrome)
- Sheet/prompt copy clarifies GHC utility ≠ Pi cashback

## Not changed
- Server claim authority (`postDailyClaim`)
- Lagos day boundary / streak math
- Lightning FAB entry on body portal

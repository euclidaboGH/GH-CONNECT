> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

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

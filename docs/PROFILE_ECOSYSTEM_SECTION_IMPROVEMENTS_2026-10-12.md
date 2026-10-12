# Profile ecosystem section improvements (2026-10-12)

## Scope
Profile ecosystem hub, profile more-nav (Marketplace/Ecosystem), profile screen section chrome.

## Improvements
- Clean lucide import (build-safe: no `Wallet,,`)
- Loading states for membership & wallet cards
- Offline banner (honest, no invented balances)
- Manual refresh control
- Auto-refresh on visibility / online / membership payment events
- Fallback navigation via `navigateTo` when parent handlers missing
- Clear section labels: Your services · Marketplace & ecosystem
- Focus rings / min heights for touch
- Profile more-nav: Marketplace & Ecosystem always visible
- Profile screen: section heading above hub

## Safety
Still display-only for balances/tiers from existing APIs. No invented GHC or membership state.

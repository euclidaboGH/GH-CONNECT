# Phase E — Ecosystem polish (0.175.0)

## Goal
Cross-app professional feel: toasts clear of the tab bar, smoother tab fades, stories rail, empty-state consistency, feed performance hints.

## Delivered
- Toast host **z-index 220** above bottom nav; card-style toasts (not flat pills under the bar)
- Tab panels **200ms ease-out** opacity with `prefers-reduced-motion` respect
- Feed post **content-visibility** intrinsic size for scroll performance
- Stories rail snap class + tighter feed header copy
- Feed empty uses `variant="feed"`
- Marketplace empty-state preset
- Offline banner stays **top** (not under nav)

## Not claimed
- Full design redesign of every screen
- New backend services

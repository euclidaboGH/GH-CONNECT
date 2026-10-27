# 0.141.0 — 10 sections × 3 safe upgrades

## 1. Top navigation / collapsing header
1. Compact bar min-height + safe-area padding
2. Tighter expanded header padding
3. `role="banner"` on expanded sticky header

## 2. Bottom navigation
1. Prefetch primary tabs on `pointerdown` (`ghc:prefetch-tab`)
2. Active tab CSS pill indicator (`aria-current="page"`)
3. Touch-manipulation + reduced-motion respect

## 3. Feed
1. Prefetch-tab listener soft-revalidates home
2. Post error boundaries retained
3. LazyImage async decode retained

## 4. Profile
1. Section tabs sticky chrome retained
2. GreenHaven ID single source (hide on pioneer strip)
3. Empty states retained

## 5. Wallet
1. History sheet retained
2. Visibility-triggered wallet refresh event
3. Balance actions on card (prior)

## 6. Rewards
1. Daily claim open event from journey
2. Thin chrome retained
3. FAB body-portal (prior)

## 7. Marketplace
1. Visibility soft-refresh event
2. Busy/order paths retained
3. Card content-visibility CSS (prior)

## 8. Messages
1. Send lock retained
2. Messages tab prefetch soft-revalidate
3. Offline awareness retained

## 9. Notifications
1. Mark-all / filters retained
2. List render stability
3. Comment sheet list window (80)

## 10. Discover + communities
1. Discover prefetch-tab soft-revalidate
2. Communities visibility refresh
3. Discover grid content-visibility (prior)

Also: smooth scroll with reduced-motion fallback; bottom-nav tap highlight disabled.

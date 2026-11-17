# Performance & UX — 0.338.18

## CI fix
Wallet Phase 7 required `setPiWithdrawAvailable(null)` + `setPiWithdrawUser(null)` before hydration.
Restored clear-before-hydration. Sheet **sticky max** still prevents Max · 0.00 π flash.

## 10 safe improvements
1. SEARCH_DEBOUNCE_MS
2. MEDIA_IDLE_PREFETCH_MAX
3. LIST_VIRTUALIZE_AFTER
4. SKELETON_MIN_MS
5. Toast dwell constants
6. Pull-refresh cooldown
7. prefersReducedMotion helper
8. clampPageSize
9. Honest emptyStateCopy (cart ≠ wallet)
10. Marketplace + post card content-visibility; brand logo lazy/async

Production NOT APPROVED.

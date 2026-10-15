# Home / Feed surgical modernization (2026-10-11)

**Scope:** Home + Feed only. No ranking/algorithm changes. No invented posts or rewards.

## Five missing parts added

| # | Missing part | Implementation |
|--:|--------------|----------------|
| 1 | Offline awareness | Banner when `navigator.onLine` is false |
| 2 | Screen-reader refresh status | `role="status"` + `feedStatusMsg` |
| 3 | Filter keyboard navigation | Arrow/Home/End on feed mode tablist; roving `tabIndex` |
| 4 | Feed / post semantics | `role="feed"` on scroll list; `role="article"` on post cards |
| 5 | Empty For You create path | Secondary CTA "Create a post" opens real compose |

## Twenty maintenance areas addressed

1. Offline presentation (no fake content)
2. SR live status for refresh lifecycle
3. Error banner design tokens (destructive, not raw red-700)
4. Error retry control focusable card style
5. Filter tablist keyboard support
6. Filter focus-visible rings
7. Roving tabindex on selected filter
8. `aria-busy` includes refresh
9. `role="feed"` instead of generic main on list
10. Post `role="article"` + author label
11. Empty-state Create secondary for For You
12. End-of-feed CTAs use `--gh-green`
13. Home Photo/Video/Post/More aria-labels
14. Home create tiles focus rings
15. Liked-state residual pink → emerald on post card
16. Pull-to-refresh status messaging
17. Local vs durable refresh copy retained (honest)
18. No changes to ranking, attention, or ledger
19. Composer still real events only (`ghc:open-compose` / create-hub)
20. Documented in this file for audit trail

## Files touched

- `components/ghc/enhanced-feed-screen.tsx`
- `components/ghc/enhanced-post-card.tsx`
- `components/ghc/home-command-centre.tsx`

## Explicitly unchanged

- Feed ranking engine
- Post APIs / reactions / comments business logic
- Reward calculation
- Demo/seed post injection policy

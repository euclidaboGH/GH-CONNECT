# Feed section audit & repairs (2026-10-11)

## Issues found

1. End-of-feed markup had nested flex wrappers (broken layout)
2. No explicit **Load more** control (infinite scroll only)
3. Share sheet nested inside scroll body (works but noisy)
4. Post Heart likes conflicted with content vs profile engagement model
5. Dual card systems: `PostCard` (legacy) + `EnhancedPostCard` (canonical)
6. Ranking still over-weighted passive likes vs content upvotes
7. Profile peek sheet residual stone/purple tokens

## Fixes

- Repaired end-of-feed + explicit Load more button
- Ranking: saves + bookmarks for recent engagement; upvote/downvote in contribution score
- Legacy `PostCard` marked deprecated
- `onLike` / `isLiked` optional on EnhancedPostCard
- Profile peek chrome tokens + matching copy
- Infinite-scroll observer deps include `rankedPosts.length`

## Intentionally not invented

- Fake posts / balances / rewards
- New ranking algorithms beyond existing soft weights
- Client vote→mint

## Canonical surface

`EnhancedFeedScreen` + `EnhancedPostCard` + `HomeCommandCentre`

## Pass 2 — structure cleanup

- Removed dead inline comment composer state (`commentText`, `submitComment`, emoji picker state)
- Comments owned solely by `CommentSheet`
- Removed unused `EnhancedComment` import
- Moved `ShareSheet` outside the scroll feed body (overlay sibling)
- Braces balanced after relocation

Canonical: `EnhancedFeedScreen` + `EnhancedPostCard` + `CommentSheet` + `HomeCommandCentre`.

# Phase 1 — Feed ↔ Profile engagement unification (2026-10-15)

## Problem
Votes and comments on profile did not reflect on feed (and vice versa) because:
- Curation counts lived only in EnhancedPostCard local state
- Profile comments navigated to Home instead of opening CommentSheet
- Shared `posts[]` was not patched after curation/comment

## Changes
1. `enhanced-post-card.tsx` — on successful `socialSetCuration`, dispatch `ghc:post-engagement` with counts
2. `enhanced-post-card.tsx` — re-seed upvote/downvote from post props when context updates
3. `ghc-context.tsx` — listen for `ghc:post-engagement` and patch `posts[]`
4. `comment-sheet.tsx` — dispatch commentDelta +1 after successful addComment
5. `profile-screen.tsx` — in-place CommentSheet; stop Home redirect for comments

## Unchanged
- Ledger, auth, RLS, ranking RPCs
- Curation still server-authoritative via `/api/social/posts/:id/curation`
- OwnPostCard remains a thin wrapper over EnhancedPostCard

## Next phases (planned)
2 Moments circular + single story pipeline
3 Comment count/display hardening + realtime merge
4 Wallet ₲ / holds polish
5 Rewards claimed-day UI
6 Membership refresh pipeline
7 Header/nav density
8 Full regression package

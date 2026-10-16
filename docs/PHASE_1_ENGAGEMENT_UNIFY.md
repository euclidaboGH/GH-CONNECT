# Phase 1 — Unified post engagement (COMPLETE)

## Problem
Votes/comments on Home did not reliably appear on Profile for the same post — dual local state and no shared bus.

## Solution
1. `lib/engagement/post-engagement.ts` — `broadcastPostEngagement` + `normalizeEngagementMetrics`
2. `EnhancedPostCard` emits curation results through the bus (not ad-hoc only)
3. `ghc-context` listens on `POST_ENGAGEMENT_EVENT` and patches shared `posts[]`
4. `addComment` updates `engagement.comments` and broadcasts `commentDelta`
5. `socialSetCuration` no longer reports `ok: true` on pure network failure (no invented success)
6. Profile `OwnPostCard` → `EnhancedPostCard` reads the same `feed.posts` / context posts

## Verify after deploy
1. Open Home → upvote a post → note ↑ count
2. Open Profile → same post shows same ↑
3. Comment on Home → comment count moves on Profile after navigation
4. Offline vote shows error toast, does not invent a successful vote total

## Status: Complete

## Non-goals (later phases)
Media pipeline, daily claim timer, push notifications, messaging retries.

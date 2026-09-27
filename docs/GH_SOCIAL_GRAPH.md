# GH Social Graph — Phase 10

## Existing foundation (reused)

| Object | Role |
|--------|------|
| `gh_follows` | `(follower_id, following_id)` unique |
| `gh_follow_set` | Follow/unfollow; blocks checked |
| `gh_follow_list` | Lists for session user |
| `gh_follow_status` | Compact isFollowing + counts |
| `POST/GET /api/social/follows` | Session actor only |
| Profile preview Follow button | UI |
| Feed filter `following` | Client chronological filter of `gh_posts` by following IDs |

## Authority

- **Follower** = authenticated session `userId`
- Client `followerId` / `actorId` ignored
- Counts from server aggregates, not client

## Block compatibility

`gh_follow_set` rejects when either direction is blocked (`BLOCKED`).

## Feed

Following mode is **not** a second feed store. Same `gh_posts`, filtered by relationship IDs. Ordering chronological. No ranking by reputation, GHC, tips, or ads.

## Notifications

Follow notifications — **DEFERRED**.

## Financial isolation

Follow/unfollow has **zero** GHC/Pi/membership/withdrawal effect.

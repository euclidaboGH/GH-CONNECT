# Phase 1–14 API ↔ UI ↔ Server Contract Completion

## Prior fixes preserved
- Video + image upload → `/api/media`
- Browser `resolveApiBaseUrl()` → `/api`
- Economy HTTP `credentials: "include"`

## Defects fixed this pass

### HTTP repository path mismatches (lib/domains/http-repositories.ts)

With same-origin base `/api`, repository paths were still using non-existent routes:

| Old path | Actual API | Fix |
|----------|------------|-----|
| `/posts` | `/api/social/posts` | `/social/posts` |
| `/posts` hydrate | `/api/social/feed` | `/social/feed` + unwrap `{ posts }` |
| `/posts/:id` PATCH | `/api/social/posts/:id/edit` | `/social/posts/:id/edit` POST |
| `/conversations` | `/api/messaging/conversations` | `/messaging/conversations` + unwrap |
| `/conversations/:id/messages` | `/api/messaging/conversations/:id/messages` | messaging prefix + unwrap `{ messages }` |
| `/stories` | `/api/social/stories` | `/social/stories` + unwrap |
| `/profile` | `/api/profile/me` | `/profile/me` |

Economy paths (`/economy/transfers`, rewards, ledger) were already correct under `/api`.

### Soft-fail remaining
- `/social/snapshot` and `/social/edges` fireWrite targets have no dedicated routes; primary graph uses `/api/social/follows` via `lib/social/client.ts`. Soft-fail retained.

## Files changed
- `lib/domains/http-repositories.ts` only

## Migrations
54 unchanged. Phase 15 NOT STARTED.

# GreenHaven 0.113.0

## Reconnect flush coordinator
- `lib/offline/reconnect-flush.ts` — single-flight, throttled (8s)
- Flushes stories, listings, posts, deletes on online / visible
- Messages remain wired via ghc-context (needs domain send callback)

## Settings
- Compact headers across Settings main and legal subpages (more content space)

## Referral
- Share card reloads status on wallet sync/refresh events (settlement display stays server-authoritative)

## Prior waves retained
0.109–0.112 chrome polish, wallet claim revalidate, marketplace economy events, discovery exclusions, DM dedupe, feed soft revalidate

# Notifications & filters — overview, wiring & hardening 0.80.0

## Architecture overview

```
NotificationBell (panel)
├── Buckets: All | Social | Messages | GHC | Rewards | Requests | Community | Market | System
├── Read filter: All | Unread
├── Channel history threads (tap expands like DMs)
├── Mark one / mark all / delete (soft-dismiss)
└── Deep link → navigateNotificationDeepLink

Sources (merged, deduped by id)
├── Local notificationSystem (optimistic / offline)
├── /api/social/notifications (durable social)
├── /api/notifications (unified when configured)
├── /api/economy/notifications (wallet / rewards)
└── /api/system/announcements

Server emit
└── emitSocialNotification → gh_social_notification_create (dedupe_key)
```

## Cross-feature connections

| Feature | Notification path |
|---------|-------------------|
| Feed engagement | post_like, post_comment, curation, comment_reply → Social / Feed deep link |
| Connections | connection_request / accept → Matches / requests inbox |
| Messages | message types → Messages tab / open chat |
| GHC / rewards | economy events → GHC / Rewards buckets + wallet |
| Community | community bucket + open communities |
| Marketplace | Market bucket → open listing / orders |
| System | Security / verification → Settings only when explicit |

## Hardening in 0.80.0

1. **Marketplace deep links** open marketplace (not feed); order id can focus Orders.
2. **Mark read** hits `/api/social/notifications` **and** unified `/api/notifications` for durable social rows.
3. **Delete** records local deleted-id memory, marks read server-side so unread does not revive.
4. **Social open mapping** for likes/comments/curation → feed; marketplace types → market.
5. **SocialNotificationType** extended (marketplace + community variants).

## Filters

- **Bucket chips** with per-bucket unread counts  
- **Unread-only** toggle  
- **Channel history** when expanded (same actor/source thread)  
- Discover `filter-panel.tsx` is **matchmaking filters** (separate product surface)

## Env / Supabase

Uses existing:

- `gh_social_notifications` (+ type extensions)
- `ghc_notification_events` / realtime platform migrations

No new env required beyond session auth + Supabase service role for RPC emit.

## Verify

1. Like/comment on your post → Social notification → opens post  
2. Connection request → Requests / Matches  
3. Marketplace order event → Market bucket → marketplace  
4. Delete notification → stays gone after refresh (local memory + read)  
5. Mark all → unread badge clears  

Version **0.80.0**

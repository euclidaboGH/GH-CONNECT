# Notifications system audit (2026-10-11)

## Canonical pipeline

| Layer | Role |
|-------|------|
| `lib/notifications.ts` | Local persistence (`notificationSystem`) |
| `lib/domains/notification-domain.ts` | Event bridge → preferences → local |
| `/api/social/notifications` | Durable social notifications |
| `lib/notification-center.ts` | Buckets + deep-links |
| `notification-bell.tsx` | User-facing panel |
| `lib/smart-notifications.ts` | Priority helpers; **mirrors into notificationSystem** (no second store) |
| `notifications-provider.tsx` | Optional bucket context (bell keeps local bucket) |

## Fixes this pass

1. **Blocked/muted** passed into `getVisibleNotifications`
2. **Durable actor suppress** for blocked/muted `actorUserId`
3. **Optimistic mark read** on tap (UI + unread)
4. **Optimistic mark all**
5. Actor field includes `actorUserId` in local filter
6. Background reconcile after mark (no nav block)
7. Prior: offline, Escape, tab a11y, counts, durable fail banner

## Safety

- No fabricated notifications
- Server list authoritative when durable ok
- Suppress only by real blocked/muted ids

# GH-Connect Notifications & Activity Center

**Status:** REPOSITORY IMPLEMENTATION COMPLETE for durable social notifications  
**Migrations:** `20261003`, `20261006`, `20261021` (repository-only until Testnet)

## Architecture

```
Authoritative action succeeds
  → emitSocialNotification (server only)
  → gh_social_notification_create (service_role RPC)
  → gh_social_notifications (RLS deny-all clients)
  → GET /api/social/notifications (session recipient only)
  → NotificationBell (durable primary + optional local Studio items)
```

Clients **cannot** create notifications (`POST` without mark_read → 403).

## Types

| Type | When |
|------|------|
| follow | Successful follow |
| post_like | Successful like reaction (deduped per actor×post) |
| post_comment | Comment on post |
| comment_reply | Reply to comment |
| curation | Non-neutral community review (public wording only) |
| mention / share | When those flows emit |
| reputation_level_up | Server level increases |
| system | Reserved for operator/system |

## Security

- Recipient always = authenticated session user on read/mark-read
- Unique `(recipient_user_id, dedupe_key)`
- Self-notifications skipped except level-up/system
- Block checks between actor and recipient
- No JCS, integrity, weights, or GHC amounts in notification bodies
- No `ghc_execute_*` on notification path

## Economic firewall

Notifications are **informational only**. Tip settlement is deferred — do not emit "tip received" until settlement is implemented.

## UI

- Bell + unread badge (server count preferred)
- Panel with buckets, mark one / mark all
- Polling ~12s (realtime not required)
- Soft-deleted targets: author lookup returns null → no new notifs; deep-link must fail safe

## Status labels

| Area | Status |
|------|--------|
| Durable social notifications | REPOSITORY IMPLEMENTATION COMPLETE |
| Live multi-user IDOR on notifs | TESTNET VALIDATION REQUIRED |
| Preferences UI | DEFERRED (schema ready for later) |
| Realtime push | DEFERRED (polling sufficient) |
| Tip received notifications | FAIL-CLOSED / DEFERRED with tip settlement |

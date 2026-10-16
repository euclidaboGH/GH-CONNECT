# GH Social Notifications — Phase 11

## Authority

Table: `gh_social_notifications`  
Writes: service-role RPC only (`gh_social_notification_create`)  
Reads/mark-read: session recipient only via `/api/social/notifications`

Clients **cannot** create notifications or choose recipients.

## Types (allowlist)

| Type | Source action |
|------|----------------|
| `follow` | Successful follow |
| `post_like` | Active like reaction |
| `post_comment` | Comment create |
| `comment_reply` | Comment with parent |
| `curation` | Reserved (not auto-wired this phase) |
| `mention` | Reserved |

## Idempotency

| Event | dedupe_key |
|-------|------------|
| Follow | `follow:{actor}:{recipient}` |
| Like | `like:{actor}:{postId}` |
| Comment | `comment:{commentId}` |

Self-actions and blocked pairs are skipped.

## Separate from economy

`ghc_*` / economy notification events remain on the economy path.  
Social notifications never call ledger, Pi, membership, tips, or ads.

## UI

Existing `NotificationBell` merges local + durable social list.  
Push/email/SMS — **deferred**.

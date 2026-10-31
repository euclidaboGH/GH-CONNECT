# Messaging section — overview, wiring & hardening 0.79.0

## Architecture overview

```
MessageScreen (inbox + thread)
├── Filters: All | DMs | Unread | Communities
├── ConversationItem + ChatHeader + MessageBubble + MessageInput
├── Presence / typing (apiTouchConversationPresence)
├── Soft poll while thread open
└── Deep link: ghc:open-conversation

Domain (messaging-domain)
├── sendMessage → apiSendMessageWithRetry (server-first when online)
├── Permissions: block, whoCanMessage, community role
└── Offline → offline-message-flush

Server
├── /api/messaging/conversations
├── /api/messaging/conversations/:id/messages
├── read | presence | prefs | ensure-member | premium
└── message-store (durable + community membership)

Context
├── sendMessage (deduped — domain posts once)
├── sendMediaMessage (attachments, no blob/data)
└── loadConversationMessages (merge + fingerprint dedup)
```

## Cross-feature connections

| Feature | Connection |
|---------|------------|
| Profile / Discover | startConversation → DM |
| Community | conversation id = community id; Chat tab |
| Marketplace | Order → ghc:open-conversation + marketplace_order banner |
| Media | Durable URLs only; bubble LazyImage |
| Notifications | New message events / read receipts |
| Offline | Queue + flush on reconnect |

## Hardening in 0.79.0

1. **Bubble media** uses LazyImage (private bucket safe).
2. **Chat header avatar** uses LazyImage.
3. **Send lock** 900ms + identical-text block 1.2s (double-send protection).
4. **Reload merge** drops optimistic duplicates that match server fingerprints.
5. **Marketplace order** threads show context banner (messaging only; pay stays in Orders).

## Prior guarantees kept

- Domain online path posts once (no second context POST).
- Blob/data media rejected for cross-device send.
- Free messaging never gated by GHC/Pi balance.

## Env / Supabase

Messaging uses existing durable tables/migrations:

- `gh_messaging_durable`, presence/receipts, edit/pin prefs, messaging v2

No new env required beyond auth + Supabase service role for server routes.

## Verify

1. Send text once → single bubble, survives reload  
2. Attach photo → durable image in thread  
3. Open from marketplace order Chat → banner visible  
4. Community chat after join works  
5. Offline queue sends on reconnect  

Version **0.79.0**

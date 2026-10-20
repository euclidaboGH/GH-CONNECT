# Essential 20 — Durable DM media + production hardening (2026-10-20)

## Implemented this package

1. **Durable DM media API** — `appendMessage` accepts `mediaAttachments`; persisted in `meta.attachments`
2. **POST /messages** validates durable URLs only (rejects blob/data)
3. **Max 4 attachments** per message
4. **Empty text + media** allowed (server builds 📷/🎥/📎 preview)
5. **`apiSendMessage` client** can send attachments
6. **`sendMediaMessage`** uploads path: durable URL → server POST → status sent/failed
7. **No false durable claim** for local-only files
8. **`loadConversationMessages`** maps `mediaAttachments` for all members
9. **MessageInput attachment** picks file → `uploadDurableMedia` → `sendMediaMessage`
10. **Messaging context** exposes `sendMediaMessage`
11. **Correct senderId** (profile / IdentityService) — not `"current-user"`
12. **Upload progress toasts** while attaching in chat
13. **Error codes** in attach/upload toasts
14. **INVALID_ATTACHMENTS** fail-closed server response
15. **MessageBubble** already renders attachments (existing UI)
16. **Media health** `/api/media/health` (prior package, retained)
17. **Direct-to-storage** large file path for posts/stories/DM uploads (prior)
18. **Compose publish blocks** non-durable images (prior)
19. **Pi-style daily claim** + claimed notification (prior)
20. **Operator note** — meta-based media, no new migration tables required

## Intentionally deferred

- Comment thread media (separate schema + moderation)
- Multi-file picker in one send (API ready for up to 4; UI is single-file for safety)
- Real-time attachment push beyond hydrate-on-focus

## Safety

- No ledger/economy changes
- No RLS weakening
- Attachments must already be in storage; chat only stores URL references

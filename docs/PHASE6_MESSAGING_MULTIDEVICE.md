# Phase 6 — Messaging multi-device

- `startConversation` dual-writes via `apiCreateDirectConversation` (prefers server id)
- `sendMessage` dual-writes via `apiSendMessageWithRetry`; adopts server message id when durable
- `loadConversationMessages` hydrates thread when opened (message-screen)
- Offline flush prefers durable API, then domain send
- Conversation list hydrate already present (Phase prior)

Operator: messaging store must be durable (Supabase + env). Without it, messages remain device-local with honest queue behavior.

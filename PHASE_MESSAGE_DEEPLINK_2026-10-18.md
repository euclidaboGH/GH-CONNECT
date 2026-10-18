# Message notification deep-links (2026-10-18)

## Goal
Tapping a message notification opens the correct conversation (or peer thread) after the Messages tab mounts.

## Changes
- Bell maps `message` / `new_message` / `dm` / `chat` → type `message` with `conversationId`
- Deep-link extracts conversationId from metadata or entityType conversation/message
- `ghc:open-conversation` delayed 120ms after navigate; includes `peerUserId`
- `openChat(userId)` delayed fallback when no conversationId
- Message screen resolves peer → conversation; **pendingOpenRef** retries when list hydrates

## Tests
`npm run test:message-deeplink`
`npm run test:notification-deeplink`

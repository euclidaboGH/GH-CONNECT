# Messaging send — server-first (2026-10-18)

## Problem
`sendMessage` appended local optimistic messages and fire-and-forgot the durable API. When the API failed (or flag was off), the sender still saw "sent" while the recipient never received the message.

## Fix
- **Online:** await `apiSendMessageWithRetry` first; only then mark `sent` and append
- Failure throws → context shows error, returns false
- **Offline:** status `sending` + offline queue (unchanged)
- **createConversation (DM):** when online, require durable conversation id — no local-only chat ids

## Tests
`npm run test:messaging-server-first`

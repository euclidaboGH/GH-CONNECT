# Phase 6 — Messaging durability

## Done
- `lib/messaging/offline-message-flush.ts` processes `send_message` offline queue
- Flush on `online` event + short delay after mount
- Successful send emits `ghc:new-message` (for notification bell)
- Offline compose enabled; copy explains auto-queue
- Failed bubble retry re-invokes `sendMessage`
- Existing domain status transitions (sending → sent/delivered/failed) retained

## Not changed
- Server messaging schema / RLS
- Voice/attachment durable claims (still not claimed as durable)

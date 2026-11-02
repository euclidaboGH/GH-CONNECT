> Engineering note — 2026-11-02

# Phase 8 continuation: read-state reconciliation

## Scope

This continuation hardens optimistic read actions in the notification bell. A durable mark-read request can time out or return a non-success response after the row was optimistically shown as read. For individual social/unified, announcement, and economy notifications, failure now restores the prior row read flag, corrects the unread count for a previously unread item, displays a retry-oriented status, and requests a fresh server reconciliation. The `ghc:notifications-read` event is emitted only after a durable write is confirmed successful (social/unified writes succeed when at least one supported endpoint accepts the action).

## Safety boundaries

- No auth checks, row-level security, payment logic, or financial settlement behavior was changed.
- No schema migration was added.
- Requests remain session-bound, non-cacheable, and bounded by the existing 12-second timeout.
- A timeout is treated as an unknown write outcome, not proof that the server did not commit; the subsequent refresh is used to reconcile authoritative state.

## Verification

Run `node scripts/check-roadmap-phase8-notification-resilience.mjs` and `npm run verify:static`. This is static/contract verification only; live Supabase and Pi Browser behavior still needs environment-backed testing.

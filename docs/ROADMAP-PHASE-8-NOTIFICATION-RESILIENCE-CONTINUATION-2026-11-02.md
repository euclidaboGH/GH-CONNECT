> Engineering note — 2026-11-02

# Phase 8 continuation: bounded notification refresh and truthful partial recovery

This continuation hardens the notification bell without changing notification storage contracts or read/write authorization.

- Notification-source requests now have a finite 12-second timeout, so one hung endpoint cannot keep the refresh cycle pending indefinitely.
- A local notification cache exception no longer clears the currently displayed list or resets unread count to zero.
- Each durable notification records which source supplied it. If one source is unavailable while others respond, previously displayed rows from the failed source are retained without duplicating rows supplied by healthy sources.
- A partial outage is surfaced explicitly; a fully successful refresh clears the stale-source message.
- Regression checks cover timeout bounds, preservation under local cache errors, partial-source row retention, and truthful status messaging.

## Verification boundary

The focused Phase 8 source-level checks are the first gate. The full configured static suite must also pass on the packaged tree. These checks do not replace Node 24.15.0 typecheck/lint/build, browser tests, or live Supabase/notification integration tests.

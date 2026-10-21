# Phase 6 — Media, Messaging and Real-Time Source Hardening

**Scope:** source-only work on the GH-CONNECT archive. No Supabase, Vercel, Pi, storage provider, or other remote service was contacted. No deployment or remote migration was performed.

## Changes completed

- Added `scripts/test-phase6-media-messaging-realtime.mjs` and wired it into `package.json` and `ci:verify`.
- Tightened message attachment URL validation in both the HTTP API and durable message store: attachments must use HTTPS. `blob:` and `data:` URLs remain rejected, and attachment count is bounded.
- Added source-level regression coverage for authenticated message access, membership authorization, private media viewer authorization, short-lived signed URLs, trusted storage redirects, RLS-protected media/presence/receipt records, realtime financial-event trust boundaries, and offline message retry behavior.

## Source-level verification

The Phase 6 regression test is expected to pass 16 assertions. Existing targeted suites also cover messaging delivery/read receipts and presence privacy, realtime transport validation, private media/account authorization, media upload route hardening, and direct uploads. Record the actual command output from the current run rather than treating this document as evidence of live behavior.

## Important remaining gates

- The tests are source-contract checks, not authenticated multi-account browser tests.
- A clean dependency install, TypeScript, lint and production build still need to run under the project's declared Node runtime.
- Remote migration application/order, actual Storage bucket visibility/policies, signed upload and download behavior, live presence delivery, and multi-account attachment authorization remain unverified by design.
- Messaging is not represented as end-to-end encrypted. Transport/storage protections and access controls are not a substitute for E2EE.
- Durable attachment handling must continue to use stable media references where available; short-lived signed URLs should not be persisted as durable message references.
- Do not enable production messaging/media feature flags or claim launch readiness from these source tests alone.

## Exit decision

Phase 6 source hardening is recorded as implemented with external verification pending. Phase 7 can proceed against this source baseline; no remote rollout is authorized by this report.


## Superseding Phase 5–6 hardening addendum

See [`PHASE_5_6_MASSIVE_HARDENING.md`](./PHASE_5_6_MASSIVE_HARDENING.md). The current source uses owner-first media object paths that match the existing SQL ownership constraint, verifies direct-upload completion against Storage object metadata, pins signed upload URLs to the configured HTTPS Supabase origin, and refuses to bypass the media-asset RPC with direct service-role inserts. Production messaging no longer uses process-memory membership/conversation data when the durable store is missing or unavailable.

# Phase 5 — Messaging and Communication Architecture Audit

**Date:** 2026-11-09  
**Source baseline:** `gh-connect@0.338.13` (Phase 4 archive)  
**Status:** Partially complete — source-level regression fixed; runtime/database rehearsal and operator verification remain open.

## Scope reviewed

- Authenticated sender identity and conversation membership checks.
- Bounded JSON request parsing and message pagination/search inputs.
- Client-message idempotency and retry behavior.
- Owned-media attachment validation and private no-store responses.
- Rate limits for send, read, search, presence, and receipt operations.
- Notification fan-out after durable message acceptance.
- Existing source checks for composer, inbox, full-history search, shared media, community chat, and offline retry behavior.

## Confirmed issue and bounded fix

The message POST route previously accepted `clientMessageId` values up to 180 characters, while `appendMessage` normalized that value by truncating it to 80 characters. Distinct caller-provided keys sharing the same first 80 characters could collide and be treated as the same idempotent message.

The route now rejects client message IDs longer than 80 characters, matching the store's existing normalization contract. The existing bounded-JSON check and the Phase 5 messages/notifications gate now assert this alignment. The database schema and client message format were not changed.

## Existing safeguards observed

- Sender identity comes from the authenticated server session; client-supplied identity fields are ignored.
- Message listing and writes use conversation membership checks in the store.
- Production messaging fails closed when durable storage is unavailable.
- Message bodies and request payloads are bounded.
- Attachments are validated as owned, ready media; arbitrary client URLs are not trusted.
- Message writes support client-message idempotency; notification fan-out is skipped for idempotent retries.
- Message search is server-side, rate-limited, bounded, and rechecks actor/conversation membership in its RPC contract.
- Private messaging responses use `Cache-Control: no-store`.

These are source-level observations, not evidence of live Supabase policies or runtime behavior.

## Checks run

- `scripts/check-phase5-messages-notifications.mjs`
- `scripts/check-messaging-bounded-json.mjs`
- `scripts/check-priority9-messaging-composer.mjs`
- `scripts/check-priority9-message-search.mjs`
- `scripts/check-priority10-messenger-community.mjs`
- `scripts/check-phase6-messaging-inbox.mjs`
- `scripts/test-phase2-messaging-attachment-policy.mjs`

Results are recorded in the Phase 5 completion message. Re-run these commands in the pinned Node 24.15.x environment as part of release verification.

## Remaining gates

1. Run the full project typecheck, lint, and production build with Node 24.15.x and installed lockfile dependencies.
2. Test concurrent duplicate sends against disposable PostgreSQL/Supabase, including unique-index conflict handling and message receipt creation.
3. Test membership removal, blocking/privacy changes, and attachment visibility across multiple authenticated accounts.
4. Verify the actual Testnet and Mainnet migration histories separately; no database history was read or changed during this phase.
5. Verify cross-device delivery and notification behavior on real devices, including Pi Browser.
6. Review durable message receipt, read-state, and notification-fanout failure handling under injected network/database failures.

No migrations were applied, no remote database or environment variable was changed, and production remains not approved by this phase audit.

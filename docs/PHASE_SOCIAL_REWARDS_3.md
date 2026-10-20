# Phase 3 — Connection / match inbox end-to-end (2026-10-20)

## Flow
A sends request → durable `ghc_connection_request_upsert` → notification to B → B opens Matches → Requests → accept/decline → durable RPC → both inboxes rehydrate → friends list updates on acceptor.

## Fixes
1. **Decline is server-first** (same pattern as accept) so sender’s outgoing clears.
2. **Context listeners** on `ghc:connection-updated` / `ghc:connection-inbox-updated` patch `friends` + `friendRequests` and re-fetch inbox.
3. **Inbox optimistic remove** after accept/decline.
4. **GET inbox** accepts status `pending|open|requested`.
5. **Notifications** use type `connection` with clearer copy for request and accept.

## Operator
Requires migrations for `ghc_connection_requests` and RPCs `ghc_connection_request_upsert` / `accept` / decline. Without DB, APIs return non-durable and UI shows honest messaging.

## Safety
No economy/ledger changes. No invented relationships.

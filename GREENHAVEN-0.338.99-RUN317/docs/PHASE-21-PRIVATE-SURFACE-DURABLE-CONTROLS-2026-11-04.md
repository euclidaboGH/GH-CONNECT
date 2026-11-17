# Phase 21 — Private-surface durable abuse controls

**Release:** 0.307.0  
**Date:** 2026-11-04  
**Database migrations:** none added or applied

## Implemented

The following high-sensitivity API operations now await the shared database-backed rate limiter with `onUnavailable: "deny"`:

- Messaging: conversation message reads, sends, edits/pins and soft deletes (4 boundaries).
- Private media: signed URL issuance, direct-upload intent, media resolution and buffered upload (4 boundaries).
- Account privacy: account export reads and account lifecycle request intake (2 boundaries).

Quota exhaustion is returned as HTTP 429 (`RATE_LIMITED`); inability to enforce the durable limit is returned as HTTP 503 (`RATE_LIMIT_UNAVAILABLE`). Both responses include a bounded retry hint and no-store handling.

## Preserved authorities

- Conversation membership and message ownership remain enforced by the existing messaging store.
- Private-media access remains authorized against the authenticated viewer and current visibility policy.
- Message attachments still require durable first-party media IDs owned by the authenticated sender.
- Account export and lifecycle intake still require recent server-side step-up.
- Export still fails closed on incomplete source reads; deletion intake does not execute destructive deletion.
- No wallet, GHC, Pi, payout, treasury or settlement logic was changed.

## Repository integrity gate

`scripts/check-phase21-private-surface-durable-controls.mjs` is registered in both `prebuild` and `verify:static`. It verifies the ten expected durable boundaries, rejects process-local limiter imports in those routes, confirms 429/503 mapping, checks package/lockfile version parity, rejects duplicate migration numeric prefixes, and verifies every migration manifest filename and byte count against the 175 canonical SQL files.

## Verification boundary

The Phase 21 source gate and consolidated network/database-independent static suite are required. They do not prove the live Supabase durable-limit RPC is available or that provider, browser, deployment, or production-build acceptance has passed. Node 24.15.x is required by the project; the available environment may not satisfy that requirement.

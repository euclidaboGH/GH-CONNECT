# Phase 10 — Marketplace, orders and fulfilment integrity

## Scope

Phase 10 strengthens marketplace order lifecycle correctness without changing production data or inventing payment/refund/fulfilment evidence.

## Changes — v0.157.9 and v0.157.10 increments

- Marketplace order creation uses the shared streaming JSON reader with a 16 KiB hard limit; payment, transition, and commerce mutations use an 8 KiB limit.
- Invalid JSON, non-object bodies, malformed content lengths, and oversized streamed bodies are rejected before business logic proceeds.
- Order quantity is a strict JSON integer in the range 1–99. Invalid strings, fractions, booleans, zero, negatives, and values above the maximum are rejected rather than silently coerced to quantity 1.
- Listing identifiers are string-only, bounded to 160 characters, and reject control characters.
- Commerce action and note fields are string-only, avoiding unsafe coercion of unexpected objects or other values.
- Marketplace mutation responses use explicit `Cache-Control: no-store` headers for success and relevant errors.
- The generic public transition endpoint rejects malformed target types without coercion and cannot set `refunded` or mutate commerce-controlled fulfilment/completion/dispute states.
- Buyer confirmation now requires the durable order to be in `fulfilling` state with delivery marked `delivered` or a service marked `service_active`; the UI button is hidden until the same persisted state is hydrated.
- Added a forward migration that tightens the authoritative commerce RPC; this migration has not been applied or verified against a live database in this audit.


- Durable Supabase order state is authoritative for transitions when configured; the process cache is not used as the transition source in a multi-instance deployment.
- A shared timestamp parser handles epoch milliseconds, epoch seconds, and ISO timestamps. Missing timestamps remain `0`/unknown instead of becoming the current time, avoiding fabricated order history.
- The order cache is updated only after successful durable persistence, preventing failed writes from appearing committed in process memory.
- Added a source contract checker for idempotent order creation, server-derived listing economics, buyer/seller scoping, payment verification, and operator-controlled stale-claim recovery.

## Existing safeguards preserved

- Inventory reservation and idempotency are owned by database RPCs.
- Client-submitted price, currency, seller identity, and total are not authoritative.
- Public lifecycle transitions cannot assert payment verification or fabricate refund outcomes. Buyer completion is gated on persisted delivery/service activation.
- Paid cancellations cannot bypass an authoritative refund path.
- Payment success and order fulfilment remain separate states.
- Order detail and mutation routes remain authenticated and participant-scoped.

## Verification boundary

The Phase 10 checker is source-level only. It does not prove live database grants/RLS, RPC deployment, inventory concurrency, real provider settlement, shipping delivery, refund processing, or UI behavior. These require a disposable environment and browser/device acceptance. No production DB operation was executed.

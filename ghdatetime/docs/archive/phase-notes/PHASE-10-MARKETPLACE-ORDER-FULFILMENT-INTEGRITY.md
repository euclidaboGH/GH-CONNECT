# Phase 10 — Marketplace, orders and fulfilment integrity

## Scope

Phase 10 strengthens marketplace order lifecycle correctness without changing production data or inventing payment/refund/fulfilment evidence.

## Changes

- Durable Supabase order state is authoritative for transitions when configured; the process cache is not used as the transition source in a multi-instance deployment.
- A shared timestamp parser handles epoch milliseconds, epoch seconds, and ISO timestamps. Missing timestamps remain `0`/unknown instead of becoming the current time, avoiding fabricated order history.
- The order cache is updated only after successful durable persistence, preventing failed writes from appearing committed in process memory.
- Added a source contract checker for idempotent order creation, server-derived listing economics, buyer/seller scoping, payment verification, and operator-controlled stale-claim recovery.

## Existing safeguards preserved

- Inventory reservation and idempotency are owned by database RPCs.
- Client-submitted price, currency, seller identity, and total are not authoritative.
- Public lifecycle transitions cannot assert payment verification.
- Paid cancellations cannot bypass an authoritative refund path.
- Payment success and order fulfilment remain separate states.
- Order detail and mutation routes remain authenticated and participant-scoped.

## Verification boundary

The Phase 10 checker is source-level only. It does not prove live database grants/RLS, RPC deployment, inventory concurrency, real provider settlement, shipping delivery, refund processing, or UI behavior. These require a disposable environment and browser/device acceptance. No production DB operation was executed.

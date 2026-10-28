# GreenHaven v0.157.10 — Phase 10 follow-up worklog

Date: 2026-10-28

## Findings addressed

1. The generic order transition route accepted `refunded` after payment verification even though it did not execute or reconcile a refund. It also exposed transitions that have dedicated commerce RPC actions. It now rejects refund status mutation and directs fulfilment, completion and dispute state changes through the commerce action API. Target state values are validated as strings rather than coerced.
2. The commerce RPC previously allowed buyer confirmation from a merely `confirmed` order, before the seller marked delivery. The new forward migration requires `status = fulfilling` and `delivery_status` to be `delivered` or `service_active` before completion.
3. The marketplace orders UI now hydrates the authoritative delivery state and only displays “Confirm received” after delivery/service activation is persisted.

## Files changed

- `app/api/marketplace/orders/[orderId]/transition/route.ts`
- `components/ghc/marketplace-screen.tsx`
- `lib/domains/marketplace-domain.ts`
- `supabase/migrations/20261028160000_marketplace_buyer_confirmation_delivery_gate.sql`
- `scripts/check-phase10-marketplace-integrity.mjs`
- Version, manifest, README and acceptance documentation updated to `0.157.10`.

## Verification boundary

The new migration is forward-only and must be reconciled against the target migration history before application. No live database, Pi provider, GHC ledger, Vercel deployment, or production data was changed. Static contracts do not prove runtime type correctness, RPC deployment, transaction isolation, real inventory concurrency, or browser behavior. Node.js available for this audit is 22.16.0 while the project requires Node.js `^24.15.0`; dependencies are not installed here, so TypeScript, lint, and production build are not claimed.

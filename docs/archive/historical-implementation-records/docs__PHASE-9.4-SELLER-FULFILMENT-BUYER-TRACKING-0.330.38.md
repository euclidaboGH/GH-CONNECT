# Phase 9.4 — Seller fulfilment and buyer order tracking

**Release:** 0.330.38  
**Source baseline:** 0.330.37  
**Status:** Source implementation complete; database and provider acceptance remain open. **NOT APPROVED for production.**

## Delivered

- Extended durable marketplace order snapshots with fulfilment method, carrier, tracking number, HTTPS tracking URL, estimated delivery timestamp and dispatch timestamp.
- Added explicit seller fulfilment methods: shipping, pickup/meetup and digital product/service.
- Shipping fulfilment requires a carrier and tracking number before the seller can start fulfilment. The seller must explicitly mark the parcel dispatched before marking it delivered.
- Pickup and digital delivery do not fabricate carrier data. Digital fulfilment activates a service (`service_active`) rather than asserting physical parcel delivery.
- Buyer confirmation still requires verified payment, a fulfilling order and a persisted delivered/service-active state. Pre-Phase-9.4 orders already in fulfilment retain a clearly labelled legacy completion path without guessing their original delivery method.
- Added a database-enforced append-only order event journal. A trigger captures new order creation and subsequent payment-status, order-status and delivery-status changes, including changes made by existing payment RPCs. Fulfilment actions set the authenticated participant identity in a transaction-local context, and their state changes plus journal events commit in the same transaction under an order row lock. Existing audit JSON is imported as explicitly labelled system history without inventing buyer/seller actors.
- Added a participant-only timeline RPC and authenticated no-store timeline endpoint. Only the buyer and seller can read an order's event timeline; clients and the service role cannot directly read or write the event table; SECURITY DEFINER RPC/trigger paths are the controlled access boundary.
- Added a lazy-loaded order activity timeline to avoid issuing one timeline request per order during ordinary list rendering.
- Added bounded input parsing, HTTPS-only tracking links, URL credential rejection, bounded carrier/tracking/note values, and an estimated-delivery horizon of no more than 366 days.
- Preserved the existing payment, escrow, refund, seller proceeds, payout and inventory authorities. Phase 9.4 does not settle or release funds and does not modify stock.

## Migration

`supabase/migrations/20261107190001_marketplace_fulfilment_tracking_timeline.sql`

Classification: **REVIEW_REQUIRED**. The migration is additive and has not been applied. It adds order tracking columns, a deny-all and immutable event table, a trigger-backed event journal, service-role-only fulfilment and timeline RPCs, and extends the canonical order read snapshot/list contracts. Reconcile actual Testnet and Mainnet histories independently before application.

## Verification

- `scripts/test-phase94-marketplace-fulfilment.mjs`: **15/15 assertions passed**.
- `scripts/check-phase94-marketplace-fulfilment.mjs`: **28/28 source contracts passed**.
- Existing Phase 9.3 variant parser/runtime and contracts must continue to pass.
- These checks are source/helper checks, not PostgreSQL integration or real shipping-provider tests.

## Mandatory acceptance still open

1. Apply the migration to a disposable PostgreSQL instance matching the target major version. Verify SQL syntax, function signatures, function owner/search path, table privileges, RLS, constraints and PostgREST RPC exposure.
2. Verify row-lock behavior for simultaneous seller fulfilment/dispatch/delivery and buyer confirmation requests; duplicate/replayed actions must not create duplicate state transitions or duplicate timeline events.
3. Verify participant scoping against buyer, seller, unrelated user, anonymous and service-role callers.
4. Verify tracking URL display and navigation on Android, desktop browsers and Pi Browser. Tracking links are seller-supplied HTTPS links; GreenHaven does not claim carrier-side verification or parcel-delivery proof.
5. Verify seller and buyer timeline refresh across separate devices and Vercel instances.
6. Run Node 24.15.x locked install, TypeScript, ESLint and Next.js production build. Current authoring environment is Node 22.16.0 and has no `node_modules`.
7. Run end-to-end GHC/Pi Testnet payment and order lifecycle checks. No live payment, refund, escrow, payout, Supabase or shipping-provider operation was performed here.

## Known limitations

- Existing order audit JSON is imported into the timeline as system-attributed legacy history. New Phase 9.4 fulfilment events use authenticated buyer/seller actor identities; other state changes captured through older service RPCs are deliberately labelled system because those legacy paths do not pass a participant actor context.
- Carrier tracking URLs are syntax/security-validated as HTTPS, not fetched or verified by GreenHaven. Tracking number and carrier are seller-supplied.
- No carrier API, label purchase, shipping fee quote, address collection, delivery signature, geolocation proof, automated delivery webhook or carrier status polling is implemented in this increment.
- Disputes/refunds remain on their existing separately controlled operations workflow. A timeline event is not proof of a refund or financial settlement.
- Production remains **NOT APPROVED** until all external acceptance gates pass.

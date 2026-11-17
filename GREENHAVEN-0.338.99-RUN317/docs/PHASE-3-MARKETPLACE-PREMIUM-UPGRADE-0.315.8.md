# Phase 3 — Marketplace Premium Upgrade (0.315.8)

**Baseline:** GH-CONNECT 0.315.7  
**Release:** GH-CONNECT 0.315.8  
**Scope:** Marketplace browse/discovery, listing presentation, seller trust/report intake. Cart and checkout settlement remain in the separately scoped Phase 4 and existing financial authorities.

## Implemented

- Marketplace browse now filters by listing kind (product, service, opportunity) and delivery mode (meetup, shipping, digital, remote service), while retaining category and text search.
- A single clear-filters action resets query, category, kind and delivery facets.
- Seller Centre now shows active, paused and sold-out listing counts alongside open, attention and completed order counts; it masks incomplete metrics during loading.
- Seller inventory supports all/active/paused/sold-out/draft filters with accessible selected states and a clear recovery state when a filter has no matches.
- Browse empty states include all selected facets, and the listing result count is announced politely for assistive technology.
- Price sorting groups records by currency before sorting amounts. GHC and PI are never treated as one numeric price scale. UI option labels disclose that price order is per currency group.
- Listing cards improve title/price hierarchy, show listing condition and low-stock information when those source fields exist, derive a sold-out badge for active products with zero availability, and add keyboard focus/reduced-motion-aware interaction polish.
- Removed redundant duplicate community suggestion sorting.
- Listing reports now use an authenticated server route, bounded JSON, a fail-closed durable rate limit and a service-role-only RPC. Reporter identity is taken from the authenticated session; client-supplied seller/reporter IDs are ignored.
- Report intake is idempotent per reporter/listing and rejects self-reporting, removed/missing listings and unsupported reasons. UI success is shown only after the API confirms a durable database record.
- Added an operator-key-protected, durable-rate-limited report queue endpoint with open/reviewing/resolved/dismissed filtering and row-locked status transitions. Resolved/dismissed reports are terminal; repeated same-state close requests are idempotent.

## Database migration

`20261106150001_marketplace_listing_report_intake.sql`

Classification: **REVIEW_REQUIRED**. The migration adds a dedicated marketplace report table and an idempotent service-role-only RPC. Client RLS access is denied. The report record is not a payment, order, inventory, wallet or payout mutation. The operator queue API is a secure backend surface; it is not a new public moderation dashboard UI.

Before applying:
1. Reconcile Testnet and Mainnet migration histories independently.
2. Validate the migration against disposable PostgreSQL with the exact current marketplace schema.
3. Test listing-not-found, removed listing, self-report, duplicate retry, reason validation, note length, RLS denial and service-role grants.
4. Verify the existing durable rate-limit RPC is available; the route fails closed if the rate-limit control plane is unavailable.
5. Apply only this migration individually after explicit operator approval. Do not bulk-push.

## Verification

- `scripts/check-phase3-marketplace-premium.mjs`
- `scripts/test-phase3-marketplace-sort.mjs`
- Existing Pass 41/42 marketplace resilience and mapping gates.
- Existing cart, commerce, trust, payment binding, RPC transport, net proceeds, event journal and adjustment gates.

Static checks do not prove SQL execution, deployed RLS/grants, moderation operator workflow, browser/device UX, Node 24 typecheck, lint or production build. Those gates remain open until executed in the supported environment.

## Preserved boundaries

- GHC and PI remain distinct assets and payment rails.
- Client-submitted prices, seller IDs, payment IDs and payment status are not authority.
- Listing fees remain server-calculated and verified.
- Inventory reservation, order lifecycle, escrow, refunds, seller proceeds and payout allocation are unchanged.
- No GHC minting, wallet balance mutation, Pi payment completion or payout execution is added.
- No migration is applied by this source upgrade.

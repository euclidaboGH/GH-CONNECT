# Priority 10.2 — Shared filter state and server parity (0.330.40)

**Date:** 2026-11-08  
**Baseline:** GreenHaven 0.330.39  
**Status:** Source implementation increment delivered; database/browser/device acceptance remains open. Production is **NOT APPROVED**.

## 1. Audit and consumer findings

- The legacy `components/ghc/filter-panel.tsx` was not mounted by the current Discover screen. Repository-wide references were limited to the component itself and exports from `components/ghc/index.ts` and `components/ghc/discovery-components.tsx`. Those exports and the component were removed. Current Discovery connection-intent state remains canonical.
- Communities already had category, privacy, attention and sort controls; these are now persisted per account and server search/category requests use a bounded fallback with an explicit warning when the new RPC is not deployed.
- Rewards history already used authenticated keyset-paginated wallet transactions. Date bounds now pass to the server query while preserving account ownership and cursor ordering.
- Activity Center reads a small local domain snapshot, not the complete server ledger. It now labels this limitation, supports shared date/search/type filters and distinguishes empty, no-match and read-error states.
- Marketplace public listing search previously loaded a fixed public page and filtered it locally. The public listing endpoint now accepts bounded server filters for query, category, kind, currency-specific inclusive price range (GHC and PI are never compared on one numeric scale), inclusive UTC creation-date range and sort before pagination. Marketplace browse and Communities directory now expose load-more controls that use server page offsets; results append by stable ID. Delivery mode remains a client refinement because legacy `shippingInfo` is free-form text, not a canonical indexed field. Location radius is rejected because listing records do not yet carry verified coordinates. Delivery-mode refinement is still client-side over the returned page because legacy delivery instructions are free-form.

## 2. Shared contracts and state

- `lib/filtering/filter-contract.ts` defines validated date, numeric, category, coordinate/radius, sorting, limit/cursor parsing and URL serialization.
- Date bounds are inclusive UTC calendar days (`from` at 00:00:00.000Z; `to` through 23:59:59.999Z).
- Numeric ranges are inclusive and invalid/reversed ranges are rejected.
- Category matching is normalized exact matching; server-side category filters use the durable category field.
- A geographic radius requires a valid latitude, longitude and 1–500 km radius. `haversineDistanceKm` uses the mean Earth radius. It must not be applied to text labels. Marketplace explicitly returns 422 for radius filters until verified listing coordinates and a database geospatial query exist.
- `hooks/use-account-filter-state.ts` stores only non-sensitive filter preferences under `ghc.filters.v1.<surface>.<accountId>`. Anonymous/placeholder accounts are not persisted. A loaded-key fence prevents prior-account state from being written under a newly selected account key.
- Shared `FilterSummary` is now also used by Communities, Rewards history and Activity. `FilterResultState` provides accessible loading, error, empty and no-results variants.

## 3. Server-side filtering and pagination

### Marketplace

`listActiveListings` now applies PostgREST filters before the bounded page is fetched: active status, category, listing kind, AND-token title/description search, price min/max and created-at date bounds. It orders by a deterministic field plus ID and accepts a bounded offset. The API exposes `pagination.filtering = server-side`. Client-side delivery-mode refinement remains limited to the fetched page until delivery mode is normalized durably.

### Rewards / Wallet history

`GET /api/economy/wallet/[userId]` accepts validated `from` and `to` dates, checks the requested user against the authenticated session, and passes the bounds into the authoritative `ghc_transactions` query. The existing keyset cursor remains scoped to the same account and exact database timestamp ordering. The wallet snapshot remains independent of the history filter/page.

### Communities

Migration `20261108120001_gh_community_server_filter_search.sql` adds `gh_community_search_public`, full-text/category filtering, deterministic ordering, bounded limit/offset pagination and service-role-only execution. It returns only public communities; private/invite membership enrichment continues through the existing authenticated membership path. The API uses the new RPC when search/category/offset filters are requested, and the directory requests subsequent pages with a load-more action. If the migration is not present, the client falls back to a bounded 100-row directory and discloses that server filtering is unavailable. The migration is **REVIEW_REQUIRED and unapplied**.

## 4. Surface integration

- Communities: account-scoped search/category/privacy/sort/attention preferences, shared active chips, server-backed query/category request and disclosed bounded fallback.
- Rewards: account-scoped history search/status/date preferences, inclusive date controls, shared chips and date-filtered server history pages.
- Activity: account-scoped type/search/date filters, shared chips, accessible error/empty/no-results states and explicit bounded-local-snapshot wording.
- Marketplace: account-scoped query/category/type/delivery/price/date preferences, server query for supported fields, accessible server refresh status and active chips.
- Discovery: removed the obsolete unused Dating/Friendship/Networking `FilterPanel`; current connection intent model remains authoritative.

## 5. Verification

- Filter contract runtime tests: **28/28 passed**.
- Phase 10.2 integration source contracts: **34/34 passed**.
- Existing Phase 10.1 utility and surface contracts remain registered.
- Migration inventory: **196 SQL files**; `20261108120001_gh_community_server_filter_search.sql` is `REVIEW_REQUIRED` (75 held migrations total).

Not verified in this environment: PostgreSQL execution/query plans/RPC ACL behavior, live Supabase Testnet/Mainnet, Node 24.15.x dependency-backed TypeScript/lint/build, browser/Android/Pi Browser, mobile viewport, keyboard-only, screen-reader, cross-account device switching and real dataset pagination under concurrent inserts. Do not apply the migration until Testnet and Mainnet histories are independently reconciled and disposable PostgreSQL acceptance passes.

## 6. Remaining acceptance work

1. Execute the new Community search migration on disposable PostgreSQL; verify RLS, function ACL, full-text GIN index usage, category filtering, ordering, page boundaries and public-only visibility.
2. Verify Marketplace PostgREST filters against real seeded rows, including special-character search, JSON metadata category, decimals, UTC date boundaries, sort stability and concurrent catalog changes. Confirm whether offset pagination is adequate or replace with a keyset cursor for high-churn catalogs.
3. Confirm the wallet date-bound REST query and keyset cursor compose correctly in PostgreSQL, including same-timestamp rows and sub-millisecond values.
4. Add durable normalized delivery mode and geospatial coordinates before claiming global delivery/radius filter parity.
5. Browser/mobile acceptance: narrow widths, overflow, focus order, Escape behavior, visible focus, touch target sizes, keyboard chip removal, date input labels, screen-reader announcements and reduced motion.
6. Account-switch test with two authenticated users on one browser profile; verify no filter preference leakage.

**Release decision:** Phase 10.2 source increment delivered. Priority 10 remains open pending the above acceptance. Production remains **NOT APPROVED**.

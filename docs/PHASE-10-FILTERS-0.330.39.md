# Priority 10 — Consistent, intelligent filtering (0.330.39)

**Date:** 2026-11-07  
**Scope:** Feed, Discovery, Wallet, Messages, Marketplace and Notifications  
**Release status:** Source increment implemented; external acceptance outstanding. Production remains **NOT APPROVED**.

## 1. Audit findings

The pre-upgrade source already had useful filtering in several domains, but it was not a coherent product system:

- Feed maintained its own lane, location relevance, intention bias, focus mode and text search state.
- Discovery combined categories, connection intents, online-only presence and local search; its legacy `FilterPanel` is exported but not mounted by the current Discover screen.
- Wallet had separate GHC transaction and Pi intent filtering, with a GHC activity reset affordance but no common active-filter summary.
- Messages maintained independent inbox categories and debounced text search.
- Marketplace had category, listing type, delivery, seller status, order role and sort controls with its own clear-filter action.
- Notifications combined category buckets with all/unread/priority focus, persisting the focus choice in session storage.
- Search normalization and active-filter presentation differed by surface. The old generic location-radius helper used a random number as a stand-in for geographic distance; it was not a trustworthy geospatial filter and was not found in active callers.

## 2. Delivered source changes

1. Added `components/ghc/filtering/filter-summary.tsx`, a shared accessible active-filter summary with per-filter removal, count, clear-all action, truncation-safe labels and polite live announcements.
2. Integrated the shared summary into Feed, Discovery, Wallet, Messages, Marketplace and Notifications. Each surface removes the corresponding state value rather than only hiding a chip.
3. Added `lib/filtering/filter-utils.ts` for NFKC normalization, diacritic-insensitive matching, bounded query normalization and all-token matching across searchable fields.
4. Applied shared token matching to Feed post search, Discovery candidate search, Wallet GHC/Pi history search and Messages inbox search. GHC and Pi remain separate data rails; no filter merges or converts assets.
5. Removed the random-distance approximation from `lib/search-utils.ts`. The legacy helper now performs deterministic textual location-label matching only; it does not claim to calculate kilometres or geospatial radius. Trusted coordinates and a geospatial query are required before a real radius filter can be offered.
6. Added focused runtime tests and source contracts, registered in both `prebuild` and `verify:static`.

## 3. Product and security invariants

- Filters are presentation/query constraints, never authorization. Private records, blocked/muted identities and participant ownership remain enforced by their existing domain/API/database authorities.
- Filter chips are stateful controls: removing a chip changes the corresponding filter and results; Clear all restores the surface defaults.
- Wallet GHC ledger activity and Pi payment intents are not combined or summed.
- No server-side query contract, database schema, migration, payment authority, inventory authority, membership entitlement or notification delivery policy was changed.
- No geographic radius or distance is inferred from text labels.

## 4. Verification

- Shared filter utility tests: **14/14 passed**.
- Cross-surface source contracts: **17/17 passed**.
- The full repository `verify:static` suite passed after the Phase 10 checks were integrated.
- Node 24.15.x dependency-backed typecheck/lint/build, browser and device acceptance, keyboard/screen-reader testing, cross-account persistence testing, live Supabase/API query validation and production telemetry have not been completed in this environment.

## 5. Remaining Phase 10 work

This is the first coordinated foundation increment, not a claim that every product surface is fully unified. Remaining work includes a shared filter-state schema for persisted preferences, account-scoped persistence where appropriate, server-side query parity for large datasets, Communities and Rewards/Activity filter coverage, date/price/location range semantics, and browser-level verification of empty states and filter combinations. The legacy exported Discovery `FilterPanel` should be either migrated to the current connection-intent contract or retired after checking downstream consumers.

**Release decision:** Source implementation advanced; production remains **NOT APPROVED** until all runtime, accessibility, live data and regression gates pass.

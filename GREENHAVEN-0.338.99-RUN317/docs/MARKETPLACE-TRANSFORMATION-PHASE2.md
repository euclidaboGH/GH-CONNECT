# Marketplace transformation — Phase 2: Discovery & seller growth (source candidate)

Base: `0.338.86` + Phase 1. Scope: source-only, additive, no migration, no financial or provider change.

## Delivered
1. `search-ranking.ts` + "Best match" sort: ranks only the already-fetched, already-filtered page; never widens results; price domains stay separate.
2. `boost-disclosure.ts`: "Promoted" / "Featured · Promoted" label while a recorded promotion window is active; promoted listings capped at 25% of a page and spaced at least 3 apart; price sorts are never reordered.
3. `seller-insights.ts` in the Seller Centre: completed sales per currency (never summed across currencies), average hours to complete, best seller, restock and stale-listing counts.
4. `returns.ts` buyer "Returns & problems" guide on order cards (7-day window after delivery). Guidance only; it does not change an order.
5. "More from this seller" on listing detail and a "Recently viewed" strip (ids only, per account, bounded to 12, fails closed).
6. `seller-checklist.ts` (Phase 1 helper) is now wired into the create-listing form as a display-only, non-blocking "Listing checklist"; it never prevents publishing and shows required items as guidance.
7. `address-validation.ts`: validation and normalization only. Saving addresses needs an owner-only server table and is deferred to a reviewed migration in Phase 3.

## Verification
- `scripts/check-phase2-marketplace-discovery-seller.mjs` gate and `scripts/test-phase2-marketplace-discovery-seller.mjs` unit tests.
- The unit tests caught and fixed a real spacing bug in the promoted-placement helper before wiring.
- Edited files pass an esbuild/TypeScript syntax scan; `check-jsx-duplicate-props` (220 files) passes.

## Not claimed
Full dependency-backed typecheck/lint/build (Node 24.15.0), browser/device acceptance, live data. Production remains NOT APPROVED. No version bump, push or deployment.

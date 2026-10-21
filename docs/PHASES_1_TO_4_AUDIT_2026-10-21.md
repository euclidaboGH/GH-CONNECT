# Phases 1–4 audit (2026-10-21)

## Phase 1 — Dual-rail revenue
- Asset separation policy (no free FX)
- Two-asset wallet UI (GHC | π)
- Pack catalog UI + GH Pay focus
- Pilot fee settlement (community + listing)
- Status: **complete**

## Phase 2 — GHC utility
- Expanded spend catalog (boosts, tools)
- GET /api/economy/catalog, /supply
- POST /api/economy/utility
- Wallet “Spend GHC” panel
- Status: **complete**

## Phase 3 — Acquisition
- Shared ghc-pack-catalog
- GH Pay products for packs
- POST /api/economy/packs/intent
- purchase-ghc + fulfill credit path
- Daily pack caps
- Status: **complete**

## Phase 4 — Scale
- Commission bps + order pay recording
- Payout eligibility (hold, identity, caps)
- GET /api/economy/scale
- GET /api/admin/revenue-summary
- Refund policy helpers
- Status: **complete** (A2U execution remains admin-gated)

## Integration upgrades in final package
- Order pay returns commission split; PI fees → company revenue journal (best-effort)
- Wallet listens for `ghc:ghc-pack-intent` and scrolls to GH Pay
- Operator deployment doc with all env + migrations

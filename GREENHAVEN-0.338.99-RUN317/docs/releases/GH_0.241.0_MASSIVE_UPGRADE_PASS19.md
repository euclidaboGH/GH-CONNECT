> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.241.0 — Massive Upgrade Pass 19

## Marketplace, Services & Opportunity Outcomes

Pass 19 makes GreenHaven commerce easier to understand and act on without changing the authoritative payment or order boundaries.

### Product improvements
- Added a Marketplace Outcome Centre that turns real buyer, seller, cart and saved state into one useful next action.
- Seller orders requiring attention take priority and route directly to Seller Centre.
- Active buyer orders surface durable tracking instead of forcing users to rediscover their transaction state.
- Cart state becomes a clear protected-checkout continuation path.
- Saved listings remain a deliberate return path when no higher-priority commerce action exists.
- Marketplace results expose active orders, cart items and saved items without inventing sales, conversion or revenue metrics.
- Existing product, service and opportunity listing kinds remain intact.

### Boundaries preserved
- No Supabase migrations changed.
- Server-authoritative pricing, order creation, payment, fulfilment and inventory logic remain untouched.
- GHC and Pi payment rails remain distinct.
- Canonical app navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.

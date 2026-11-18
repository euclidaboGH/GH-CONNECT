> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.252.0 — Pass 30

## Unified Experience Quality

Pass 30 establishes a shared experience-state contract for loading, empty, error, success and offline conditions. The goal is consistent, calm, accessible feedback across the product rather than isolated one-off state treatments.

### Scope
- Added a reusable `ExperienceState` primitive and shared state copy.
- Added `LoadingState` and `ErrorState` helpers for feature surfaces.
- Improved `EmptyState` accessibility with polite status semantics and explicit action labels.
- Upgraded Marketplace loading states for listings, saved items and durable orders.
- Preserved server-authoritative financial, marketplace and identity boundaries.
- No Supabase migration files changed.
- Preserved the canonical navigation: Home, Messages, Communities, Cart, Profile.

### Verification
Static verification is performed by `scripts/check-pass30-experience-quality.mjs`. Full production build/typecheck requires the project's Node 24.15+ runtime and is not claimed in environments running an older Node version.

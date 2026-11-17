> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.243.0 — Massive Upgrade Pass 21

## Global Discovery, Search & Opportunity Intelligence

This release improves how GreenHaven helps a member understand what is relevant and what to do next without inventing recommendations, popularity, opportunity value or financial outcomes.

### Improvements
- Global Search now summarizes the real visible result set and exposes category counts as direct refinement actions.
- Search continues to span People, Creators, Public IDs, Posts, Videos, Communities, Events, Activities and Services.
- Empty search guidance explicitly preserves privacy and block enforcement.
- Discover now presents an outcome summary derived from the visible candidate set, selected connection intents, query state and online-only filter.
- Discovery guidance encourages purposeful connection intent instead of dating-style or popularity-first behavior.
- Existing privacy, block, request, match and connection boundaries remain authoritative.
- No Supabase migration was added or modified.
- No wallet, payment, reward, membership or marketplace authorization logic was changed.
- Canonical bottom navigation remains Home · Messages · Communities · Cart · Profile; Discovery remains secondary.

## Verification
Run `node scripts/check-pass21-discovery-intelligence.mjs` plus the existing release hygiene, dependency lock, regional context and JSX safety gates.

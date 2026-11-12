> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.237.0 — Massive Upgrade Pass 15

## Intelligent Action & Outcome Experience

Pass 15 makes Home more results-oriented without turning it into a noisy dashboard. GreenHaven now converts existing authoritative/session state into one clear **What matters now** action. The action follows the existing priority model: identity completion, conversations requiring attention, community participation, network discovery, then healthy ongoing participation.

### Product improvements
- Added a reusable Home Action Centre with one primary next move.
- Preserved the existing results strip so users can see progress before acting.
- Added urgency-aware presentation for high-attention work and a calm success state when the user is on track.
- Reused canonical profile, messages, communities, discovery and Home destinations.
- Kept Wallet outside bottom navigation and routed wallet actions through the existing overlay navigation contract.
- Removed the older conditional next-step card to avoid competing primary calls to action.
- Added accessible focus treatment and mobile-sized interaction targets.
- No fake outcome data and no new economy claims.

### Data and backend safety
No Supabase migration was added or modified. Payment, wallet, membership, rewards and marketplace authorization boundaries remain unchanged.

### Release gate
`scripts/check-pass15-intelligent-action.mjs` verifies the version, state-derived action model, single outcome surface, CTA hierarchy, canonical destinations, wallet overlay rule and absence of fabricated outcome data.

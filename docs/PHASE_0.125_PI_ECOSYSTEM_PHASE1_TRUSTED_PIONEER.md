# GreenHaven 0.125.0 — Phase 1 of 3 (Pi ecosystem)

## Phase plan

### Phase 1 (this release) — Trusted Pioneer + payment separation foundation
- Server-verified identity endpoint `GET /api/identity/me`
- `PiConnectedBadge` + `PioneerIdentityStrip` (badge only when serverVerified)
- Public GreenHaven ID ensured at Pi auth time
- Session payload includes non-secret identity fields
- Pi-only commerce (from 0.124) remains default: fees in π; GHC earn-only

### Phase 2 (next) — Anti-fraud readiness + payment lifecycle polish
- PiVerify eligibility research + consent UX scaffolding (no false KYC claims)
- Duplicate-account signals using durable pi_app_uid only
- Payment intent recover/fulfill regression for listing/community/membership π rails

### Phase 3 (later) — Optional Pi platform extras
- In-app notification scope investigation
- Staking as engagement signal only (already non-balance)
- Mainnet listing evidence pack

## Bottom line retained
Pi authentication + wallet + π payments + GreenHaven social DB.
Do not invent social graphs or private data from Pi.

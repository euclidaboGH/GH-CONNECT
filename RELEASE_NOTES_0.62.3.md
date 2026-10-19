# GH-CONNECT 0.62.3 — Phase 23

- Added structured screen-by-screen responsiveness and accessibility refinements for Feed, Discover, Profile, Messages, Communities, Marketplace, Wallet, Settings and onboarding.
- Added screen landmarks and forced-colors focus treatment.
- Replaced stale Settings version labels with the shared release version.
- Hardened Pi runtime to require successful official `Pi.init()` before any payment call and avoid duplicate SDK script injection during load races.
- U2A payment startup now fails closed on SDK initialization errors, validates positive finite amount/seven-decimal precision and memo length, and protects reserved metadata fields.
- Added `PI_CORE_TEAM_COMPLIANCE_REVIEW_2026-10-19.md` and `PHASE_23_SCREEN_BY_SCREEN_REVIEW_2026-10-19.md`.
- Verified the Pi Core Team `pi-apps/pi-nodejs` repository publishes the official `pi-backend@0.1.3` SDK; A2U remains gated because the dependency lock graph and live Testnet verification are still outstanding.

## Validation status

Static Phase 23 checks are available through `npm run test:phase23-pi-screen-review`. This release is not production-cleared: the dependency lock graph is incomplete, supported Node is unavailable in the workspace, and clean install/typecheck/lint/build, live Pi Browser/Testnet, Supabase concurrency, Paystack Test Mode, and real-device visual tests remain outstanding.

**Production status:** NOT APPROVED

# Current source increment — 0.338.85 (2026-11-15)

Current status:** **NOT APPROVED**

**Current source version:** `0.338.85`  
**Package identity:** `gh-connect@0.338.85`  
**Prior baseline:** `0.338.84` (feed / home / profile / community / post-card density improvements).

This increment enables and solidifies gated upgrades from the past 48 hours: Pi Browser runtime detection and auth honesty, reserved-π incomplete-withdrawal return path UX, release identity parity across package/lock/APP_RELEASE/VERIFIED_MANIFEST/PROJECT_TRUTH/SOURCE_OF_TRUTH, and retention of Phase 4 pagination, Pass 40 navigation, and Run 299/300/301 contracts. No new financial migrations. CALLS_PRODUCTION_ENABLED and REMOTE_PUSH_PRODUCTION_ENABLED remain fail-closed (require infrastructure + operator review).

**Phase 6 source gate and prior static suites retained.** Full static verification must re-run on supported Node 24.15.0 after deploy. Supported Node engine range is `^24.15.0`; Node.js 24.15.0 dependency-backed TypeScript, lint, and Next.js production build remain required. Source checks do not establish a successful supported-runtime build, real browser acceptance, live database readiness or production readiness; static verification does not establish runtime acceptance.

GHC and Pi pricing/settlement authorities remain separate. The source migration inventory is not evidence of applied migrations. No Supabase schema/data, wallet, GHC or Pi financial state was changed in this workspace. Production approval remains pending; production remains **NOT APPROVED**.

Production remains **NOT APPROVED**.

## Canonical navigation contract

Bottom navigation (five items): **Home · Messages · Communities · Cart · Profile**.

Wallet remains an overlay surface and is not a primary bottom-nav destination.


# GreenHaven / GH-CONNECT

**Current source version:** `0.274.3`

GreenHaven is a Next.js + Supabase application with Pi-integrated wallet, marketplace, social/community, messaging, economy, identity, media and related utility surfaces.

## Current release baseline

- Node: `24.15.0` / `^24.15.0`
- Supabase migrations: **176 canonical SQL files**
- Single consolidated source: `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql` (review-only; never execute as one script)
- Duplicate migration numeric prefixes: **0**
- Static/source audit: historical consolidated checks passed **57/57**; focused security, identity, media, messaging, wallet, marketplace and migration checks rerun for 0.274.3 (source-only; see current audit report)
- Pass 41: marketplace loaders now protect against stale responses and preserve last-known data on transient failures; feed requests use latest-request-wins cancellation
- Pass 42: marketplace API record normalization is centralized in runtime-tested domain mappers for listings, saved items and durable orders
- Phase 1 foundation pass: release-truth metadata, documentation hygiene, and the marketplace shared-mapper regression contract reconciled; see `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md`.
- Pass 43: Feed, Connections and Discovery read seams are connected to the policy-filtered GHC session; production discovery now requires explicit server-hydrated candidate provenance
- Pass 44: 10 high-impact financial/payment routes use awaited, fail-closed durable rate limits
- Pass 45: bounded retention for expired security-control-plane state, 90-day default security-event expiry, and strict limiter input/RPC response validation
- Pass 46: correct 429/503 durable-limiter failure semantics, fail-closed social mute/block writes, and app-wide keyboard/reduced-motion/mobile interaction polish; no Cloudflare/R2 integration
- Pass 47: global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root-level error diagnostics
- Phase 4: marketplace cart normalization, stable retry idempotency, durable listing preflight, stock/currency validation, and safer mixed GHC/Pi cart handoff; see `docs/PHASE-4-MARKETPLACE-CART-CHECKOUT-INTEGRITY-2026-11-01.md`
- Pass 48: inactive tab panels and hidden bottom navigation are made inert, preventing keyboard focus from entering visually hidden app surfaces
- Production status: **NOT APPROVED** until supported-runtime build, live backend/provider evidence and migration reconciliation are completed

## Source of truth

Read `docs/SOURCE_OF_TRUTH.md` before using project documentation for implementation decisions. It defines document precedence and prevents historical worklogs from being mistaken for current product requirements.

Use `docs/PROJECT_TRUTH.md` for the current release boundary and verification status. Use the current dated audit documents only for the feature they cover.

## Database installer safety

The one authoritative canonical migration count is **176 individual files** in `supabase/migrations/`. The consolidated bundle contains those same 176 sources in one review document. Counts of all `.sql` files include operator/validation/reset assets and the bundle, and are not migration counts. Historical software versions such as `0.184.0` or `0.187.0` are version labels, not counts of migrations.

`supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` is a stale generated artifact and omits 44 of the 176 canonical migrations. **Do not execute it.** Never bulk-apply the migration directory; reconcile target history and review every pending migration first.

## Important repository rule

The Next.js application must live at repository root. `app/`, `components/`, `features/`, `hooks/`, `lib/`, `public/`, `scripts/`, `supabase/` and `package.json` must be directly under the repository root. Do not wrap the project in an extra directory such as `ghdatetime/`.

## Verification boundary

Source checks prove source contracts only. They do not prove that Supabase migrations are applied, Pi/Testnet providers are live, realtime infrastructure is configured, or the Node 24 production build has passed in the target environment.

## Pi wallet repair status (2026-11-01)

Phase 1 adds a server-verified Pi identity reconnect action to the unified earnings dashboard. See `docs/PHASE-1-PI-IDENTITY-AND-AUTHORIZATION-RECONNECT-2026-11-01.md`. It does not enable A2U payout execution or imply production approval.

Phase 2 Pi wallet action and eligibility upgrade is documented in `docs/PHASE-2-PI-WALLET-ACTION-AND-ELIGIBILITY-UPGRADE-2026-11-02.md`. The wallet-card Pi actions now open dedicated identity, eligibility, or payout modules; payout safeguards and transaction history remain intact. This is not evidence of a live Testnet payout.

### PI wallet Phase 3 — withdrawal status and recovery hardening (2026-11-02)

Phase 3 adds a user-scoped, read-only withdrawal status endpoint and a visible request-status panel in the PI earnings dashboard. The client keeps its idempotency key through ambiguous network outcomes, refreshes status after a successful request or uncertain result, and blocks a new request while a recent request is reserved, processing, or uncertain. The withdrawal request, status, and execution routes now include final safe JSON error boundaries. These changes do not enable payouts, alter the database, or replace Testnet execution gates. See `docs/PHASE-3-PI-WITHDRAWAL-STATUS-RECOVERY-2026-11-02.md`.


### Roadmap implementation status
Phase 1 (Identity, onboarding and profile) is in progress. Implementation details, deliberate security deferrals, and validation limits are documented in `docs/ROADMAP-PHASE-1-IDENTITY-ONBOARDING-PROFILE-2026-11-02.md`.

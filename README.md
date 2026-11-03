# GreenHaven / GH-CONNECT

**Current source version:** `0.277.0`

GreenHaven is a Next.js + Supabase application with Pi-integrated wallet, marketplace, social/community, messaging, economy, identity, media and related utility surfaces.

## Current release baseline

- Node: `24.15.0` / `^24.15.0`
- Supabase migrations: **172 canonical SQL files**
- Duplicate migration numeric prefixes: **0**
- Static/source audit: **57/57** consolidated checks passing (2026-11-01; source-only)
- Pass 41: marketplace loaders now protect against stale responses and preserve last-known data on transient failures; feed requests use latest-request-wins cancellation
- Pass 42: marketplace API record normalization is centralized in runtime-tested domain mappers for listings, saved items and durable orders
- Phase 1 foundation pass: release-truth metadata, documentation hygiene, and the marketplace shared-mapper regression contract reconciled; see `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md`.
- Pass 43: Feed, Connections and Discovery read seams are connected to the policy-filtered GHC session; production discovery now requires explicit server-hydrated candidate provenance
- Pass 44: 10 high-impact financial/payment routes use awaited, fail-closed durable rate limits
- Pass 45: bounded retention for expired security-control-plane state, 90-day default security-event expiry, and strict limiter input/RPC response validation
- Pass 46: correct 429/503 durable-limiter failure semantics, fail-closed social mute/block writes, and app-wide keyboard/reduced-motion/mobile interaction polish; no Cloudflare/R2 integration
- Pass 47: global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root-level error diagnostics
- Pass 48: inactive tab panels and hidden bottom navigation are made inert, preventing keyboard focus from entering visually hidden app surfaces
- Production status: **NOT APPROVED** until supported-runtime build, live backend/provider evidence and migration reconciliation are completed

## Source of truth

Read `docs/SOURCE_OF_TRUTH.md` before using project documentation for implementation decisions. It defines document precedence and prevents historical worklogs from being mistaken for current product requirements.

Use `docs/PROJECT_TRUTH.md` for the current release boundary and verification status. Use the current dated audit documents only for the feature they cover.

## Important repository rule

The Next.js application must live at repository root. `app/`, `components/`, `features/`, `hooks/`, `lib/`, `public/`, `scripts/`, `supabase/` and `package.json` must be directly under the repository root. Do not wrap the project in an extra directory such as `ghdatetime/`.

## Verification boundary

Source checks prove source contracts only. They do not prove that Supabase migrations are applied, Pi/Testnet providers are live, realtime infrastructure is configured, or the Node 24 production build has passed in the target environment.

## Wallet & Rewards Roadmap — Phase 3 (Rewards Transparency)

This source update adds a Rewards Centre summary for available, pending, and locked GHC amounts. Values are displayed only from the existing server-authoritative `/api/social/economy/status` snapshot; an unknown value is shown as an em dash rather than a fabricated zero. The summary explains that pending and locked rewards are not spendable and links to the existing reward history tab. It does not mint, claim, unlock, or transfer funds.

Regression check: `npm run check:wallet-rewards-phase3`. This check is registered in both `prebuild` and `verify:static`. Targeted source checks do not replace the required Node-version-compatible build, TypeScript/lint suite, database/RLS verification, or end-to-end testnet financial reconciliation.

# GreenHaven / GH-CONNECT

**Current source version:** `0.222.0`

GreenHaven is a Next.js + Supabase application with Pi-integrated wallet, marketplace, social/community, messaging, economy, identity, media and related utility surfaces.

## Current release baseline

- Node: `24.15.0` / `^24.15.0`
- Supabase migrations: **170 canonical SQL files**
- Duplicate migration numeric prefixes: **0**
- Static/source audit: current release gates passing
- Production status: **NOT APPROVED** until supported-runtime build, live backend/provider evidence and migration reconciliation are completed

## Source of truth

Read `docs/SOURCE_OF_TRUTH.md` before using project documentation for implementation decisions. It defines document precedence and prevents historical worklogs from being mistaken for current product requirements.

Use `docs/PROJECT_TRUTH.md` for the current release boundary and verification status. Use the current dated audit documents only for the feature they cover.

## Important repository rule

The Next.js application must live at repository root. `app/`, `components/`, `features/`, `hooks/`, `lib/`, `public/`, `scripts/`, `supabase/` and `package.json` must be directly under the repository root. Do not wrap the project in an extra directory such as `ghdatetime/`.

## Verification boundary

Source checks prove source contracts only. They do not prove that Supabase migrations are applied, Pi/Testnet providers are live, realtime infrastructure is configured, or the Node 24 production build has passed in the target environment.

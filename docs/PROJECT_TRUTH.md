# GreenHaven — Project Truth

**Current source version:** `0.271.2`
**Current status:** **NOT APPROVED** for production release.

## Current authoritative metadata

- Package and lockfile version: `0.265.0`.
- Runtime: Node `24.15.0` / package engine `^24.15.0`.
- Canonical Supabase migrations: **172** SQL files.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with all 172 canonical migrations.
- No local secret `.env` file is included; `.env.example` is the only env template.

## Current source/audit status

The 2026-11-01 Phase 1 foundation pass reconciled release metadata and documentation hygiene, repaired the marketplace shared-mapper regression contract, and restored the missing source-only verification fixture. Pass 44 then moved 10 high-impact financial/payment routes to the existing Supabase-backed durable rate-limit control plane with fail-closed behavior when that service is unavailable. The complete network/database-independent static suite passed **57/57** after these changes. See `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md` and `docs/PASS-44-DURABLE-ABUSE-CONTROL-HARDENING-2026-11-01.md` for scope, evidence, and remaining runtime/operator gates. Pass 45 adds bounded, opportunistic cleanup for expired durable rate-limit buckets and explicitly expired security events, defaults new security events to a 90-day expiry, and validates limiter inputs and RPC result shapes before accepting decisions. Its new migration is `REVIEW_REQUIRED`; it must be reconciled and tested before application. See `docs/PASS-45-SECURITY-CONTROL-PLANE-RETENTION-2026-11-01.md`. Pass 46 distinguishes exhausted quotas (HTTP 429) from unavailable durable protection (HTTP 503), extends fail-closed handling to social mute/block writes, and adds a keyboard, reduced-motion and mobile interaction quality baseline. Pass 47 adds global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root error diagnostics. No Cloudflare/R2 integration was performed. See `docs/PASS-46-APP-EXPERIENCE-AND-SECURITY-RESILIENCE-2026-11-01.md` and `docs/PASS-47-APP-EXPERIENCE-COHESION-2026-11-01.md`. Pass 48 makes inactive primary-tab panels and hidden bottom navigation inert so keyboard focus cannot enter hidden surfaces. See `docs/PASS-48-ACCESSIBLE-NAVIGATION-2026-11-01.md`.


The current source tree has passed the repository-level contracts covering release hygiene, migration manifest synchronization, regional context, section refresh, shell/realtime/scroll behavior, post/curation production behavior, wallet/notification wiring, community governance, and residual technical-debt hardening. Pass 40 additionally centralizes feed replacement and pagination reconciliation in a shared, runtime-tested social-domain helper. Pass 41 hardens saved-listing, seller-listing, and durable-order hydration against stale responses and transient data loss, and adds latest-request-wins cancellation to feed refreshes. Pass 42 moves marketplace API record normalization out of the UI into shared, runtime-tested domain-boundary mappers for saved listings, seller/public listings, and durable orders, preserving explicit zero values and server-authoritative order/payment lifecycle fields. Pass 43 activates the Feed, Connections, and Discovery read seams against the current block/mute-filtered GHC session, excludes drafts and scheduled posts from the feed bridge, computes incoming request counts, and fails closed for production discovery candidates unless they are explicitly marked server-hydrated.

The corrected release archive must keep the Next.js application at repository root (`app/` directly under the repository root). Do not add an extra wrapper directory around the project.

## Navigation contract

- Canonical navigation: **Home · Messages · Communities · Cart · Profile**. Wallet remains an overlay; Discovery is secondary navigation.

## Release boundary

Static/source verification **does not establish** a supported-runtime production build, live Vercel behavior, applied Supabase migrations, live Pi authentication/payment/provider behavior, realtime deployment configuration, or operator approval.

Before release:
1. Use Node `24.15.x` or another supported Node 24 release.
2. Run the locked dependency install and the project's typecheck/lint/build gates.
3. Reconcile Testnet/Mainnet migration history before applying SQL.
4. Complete live/disposable Testnet and provider evidence for the relevant payment, identity, messaging, media, realtime and financial workflows.
5. Keep Mainnet changes separately approved; never infer approval from source-only checks.

## Documentation authority

Use `docs/SOURCE_OF_TRUTH.md` for prompt execution and document precedence. Old worklogs and historical phase documents are not current product authority. If a legacy verification fixture conflicts with executable source or current release documentation, the source/current release documentation wins and the fixture should be repaired rather than the product being regressed.

## Source-only evidence language

The **source migration inventory is not evidence of applied migrations**. It does NOT prove migrations are applied to any Supabase project.

The supported runtime is `^24.15.0`. **TypeScript, lint, and Next.js production build** must be executed with the supported Node 24 runtime and installed locked dependencies before production acceptance.

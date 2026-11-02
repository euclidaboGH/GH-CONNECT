# GreenHaven — Project Truth

**Current source version:** `0.274.3`
**Current status:** **NOT APPROVED** for production release.

## Current authoritative metadata

- Package and lockfile version: `0.274.3`.
- Runtime: Node `24.15.0` / package engine `^24.15.0`.
- Canonical Supabase migrations: **176** SQL files.
- The one authoritative canonical migration count is **176 individual files** in `supabase/migrations/`. The consolidated bundle contains those same 176 sources in one review document. Counts of all `.sql` files include operator/validation/reset assets and the bundle, and are not migration counts. Historical software versions such as `0.184.0` or `0.187.0` are version labels, not counts of migrations.
- Consolidated canonical migration source bundle: `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql` contains all 176 canonical migration sources with per-file SHA-256 and classifications for one-document review. It is explicitly **not executable as a monolithic installer**; reconcile target history and apply reviewed original files individually.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with all 176 canonical migrations.
- No local secret `.env` file is included; `.env.example` is the only env template.

## Current source/audit status

The 2026-11-01 Phase 1 foundation pass reconciled release metadata and documentation hygiene, repaired the marketplace shared-mapper regression contract, and restored the missing source-only verification fixture. Pass 44 then moved 10 high-impact financial/payment routes to the existing Supabase-backed durable rate-limit control plane with fail-closed behavior when that service is unavailable. The complete network/database-independent static suite passed **57/57** after these changes. See `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md` and `docs/PASS-44-DURABLE-ABUSE-CONTROL-HARDENING-2026-11-01.md` for scope, evidence, and remaining runtime/operator gates. Pass 45 adds bounded, opportunistic cleanup for expired durable rate-limit buckets and explicitly expired security events, defaults new security events to a 90-day expiry, and validates limiter inputs and RPC result shapes before accepting decisions. Its new migration is `REVIEW_REQUIRED`; it must be reconciled and tested before application. See `docs/PASS-45-SECURITY-CONTROL-PLANE-RETENTION-2026-11-01.md`. Pass 46 distinguishes exhausted quotas (HTTP 429) from unavailable durable protection (HTTP 503), extends fail-closed handling to social mute/block writes, and adds a keyboard, reduced-motion and mobile interaction quality baseline. Pass 47 adds global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root error diagnostics. No Cloudflare/R2 integration was performed. See `docs/PASS-46-APP-EXPERIENCE-AND-SECURITY-RESILIENCE-2026-11-01.md` and `docs/PASS-47-APP-EXPERIENCE-COHESION-2026-11-01.md`. Pass 48 makes inactive primary-tab panels and hidden bottom navigation inert so keyboard focus cannot enter hidden surfaces. See `docs/PASS-48-ACCESSIBLE-NAVIGATION-2026-11-01.md`.


Phase 4 hardens marketplace cart persistence and checkout retries: stable per-line idempotency keys, server-backed listing preflight, stock and currency checks, and safe retention of an outstanding Pi cart line. See `docs/PHASE-4-MARKETPLACE-CART-CHECKOUT-INTEGRITY-2026-11-01.md`. This remains source-only work; no live payment or database behavior is claimed.

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


## Additional audit finding (2026-11-01)

`supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` is a stale generated artifact: it includes 132 migration source markers while the canonical directory contains 176 migrations. Do not execute it. Reconcile and apply only individually reviewed migrations against the target project history.


## Current comprehensive audit

See `docs/COMPREHENSIVE-AUDIT-0.274.3-2026-11-01.md` for the full source/migration/security audit. The legacy canonical installer is stale and explicitly marked do-not-execute; live Testnet history, runtime build, and financial concurrency evidence remain release blockers.

## Pi wallet repair status (2026-11-01)

Phase 1 adds a server-verified Pi identity reconnect action to the unified earnings dashboard. See `docs/PHASE-1-PI-IDENTITY-AND-AUTHORIZATION-RECONNECT-2026-11-01.md`. It does not enable A2U payout execution or imply production approval.

## Pi wallet Phase 2 action wiring (2026-11-02)

The wallet-card Pi actions route to the authoritative earnings dashboard's identity, eligibility, and payout workflow. Eligibility failures are surfaced with server-provided reasons; withdrawal requests remain behind identity, consent, balance, and deployment gates. See `docs/PHASE-2-PI-WALLET-ACTION-AND-ELIGIBILITY-UPGRADE-2026-11-02.md`. Full runtime and Testnet validation remain required.

PI wallet Phase 3 (2026-11-02): added authenticated user-scoped withdrawal status/history, safe error boundaries for payout request/status/execution endpoints, ambiguous-outcome idempotency retention, and client-side blocking of overlapping unresolved requests. See `docs/PHASE-3-PI-WITHDRAWAL-STATUS-RECOVERY-2026-11-02.md`. This does not enable payout gates or constitute live Testnet proof.

## Pre-GitHub comprehensive audit (2026-11-02)

The Phase 3 wallet archive has been reviewed with a new read-only audit guard registered in `prebuild` and `verify:static`. The guard checks package/lock/runtime alignment, unique migration version naming, CI release gates, stale installer labeling, environment-file hygiene and core-domain presence. See `docs/PRE-GITHUB-COMPREHENSIVE-AUDIT-AND-100-FEATURE-ROADMAP-2026-11-02.md` for the inventory, static evidence, explicit unrun gates and staged 100-feature roadmap. This remains **NOT APPROVED** for release until Node 24.15.0 locked install, typecheck, lint, build, live migration-history reconciliation and relevant Testnet E2E tests are completed.


## Roadmap implementation status — 2026-11-02
Phase 1 of the ten-phase 100-feature roadmap has begun: identity/account status center, profile completeness checklist, explicit privacy-preview limitations, and authenticated profile/identity export are implemented. See `docs/ROADMAP-PHASE-1-IDENTITY-ONBOARDING-PROFILE-2026-11-02.md`. Focused checker and complete `npm run verify:static` pass. TypeScript, lint and production build still require Node 24.15.0 with dependencies installed.

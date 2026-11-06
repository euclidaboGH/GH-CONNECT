# GreenHaven / GH-CONNECT

**Current source version:** `0.329.0`
- Phase 23 (0.309.0): migration audit hardening separates reservation expiry cleanup from locked order snapshot reads. Application reads explicitly run cleanup and fail closed; transition RPC snapshots no longer sweep unrelated rows while holding an order lock. Added whole-migration SECURITY DEFINER search_path audit. No financial settlement behavior is added.

GreenHaven is a Next.js + Supabase application with Pi-integrated wallet, marketplace, social/community, messaging, economy, identity, media and related utility surfaces.

### 0.329.0 — Phase 10 privacy-safe caching and adaptive media loading
Restricts service-worker storage to an explicit allowlist of public static assets. Navigation documents, authenticated pages, Next.js RSC responses, all API routes and private media are network-only; the previous broad same-origin cache path and cached-homepage fallback are removed. Feed and Story media prefetch now respects device-local reduced-data preference, browser Data Saver and constrained network signals, rechecks eligibility immediately before work, and caps speculative media work. Reconnect feedback clears its timer on unmount. Added executable service-worker policy tests and 15 source resilience checks. Phase 9 acceptance remains open; no migration or financial operation is authorized.

### 0.328.0 — Phase 10 Settings and platform performance
Adds a dedicated Performance & data area in Settings with browser-reported device capability diagnostics, network and reduced-motion signals, and a device-local reduced-data preference. The preference suppresses optional prefetching; system Data Saver and constrained connections take priority. Shared async memoization now has bounded LRU eviction, TTL expiry and concurrent request deduplication. The UI explicitly avoids synthetic benchmark claims and does not change account, privacy, Pi, GHC, payment or entitlement authority. Phase 9 acceptance gates remain open; no production migration or financial operation is authorized.

## Current release baseline

- Node: `24.15.0` / `^24.15.0`
- Supabase migrations: **189 canonical SQL files**
- Duplicate migration numeric prefixes: **0**
- Phase 1 deep completion (0.315.6): canonical curation visibility, serialized daily vote limits, mandatory activity auditing, deterministic community pagination, and resilient community-board publishing; three related SQL migrations remain REVIEW_REQUIRED.
- Phase 2 Stories (0.315.7): creator-grouped story sequences, server-confirmed seen-state hydration, account-scoped local preferences, pause/resume and reduced-motion playback, video end progression, and database-enforced audience/block checks for story views. One additive Stories migration is REVIEW_REQUIRED; see `docs/PHASE-2-STORIES-PREMIUM-REBUILD-0.315.7.md`.
- Phase 3 Marketplace (0.315.8): product-type and delivery filters, currency-safe GHC/PI price sorting, upgraded listing cards, seller-centre inventory/status management, and authenticated durable listing-report intake. One additive report migration is REVIEW_REQUIRED; see `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`.
- Phase 4 Cart/Checkout (0.315.9): strict bounded cart-cache normalization, cross-tab synchronization, checkout edit locking and selective reserved-line cleanup. Server order/payment authority remains unchanged; see `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`.
- Phase 5 Discovery (0.316.0): batch-prepared ranking indexes, deterministic duplicate suppression, consistent activity-recency scoring, and accessible independent profile/follow actions. No database migration or financial authority change; see `docs/PHASE-5-DISCOVERY-PERFORMANCE-UPGRADE-0.316.0.md`.
- Phase 6 Profile and Identity (0.318.0): per-domain relationship indexes, batch hydration, block-first safety, account-switch cache isolation and stale-response protection. Phase 7 (0.319.0) adds an editable creator/business identity and portfolio showcase, richer server-hydrated achievements, privacy-filtered professional discovery, HTTPS-only visual portfolio previews and project links, and server-side rejection of client-forged verification flags. Consolidated static checks pass 57/57; Node 24.15.0 typecheck, lint and production build remain pending. No migration or financial-authority change. Phase 7 Wallet source implementation is closed in 0.320.0; Node 24.15.x build, browser/device and live Pi Testnet acceptance remain production release blockers. Phase 8 Rewards (0.323.0) completes the source implementation with server-verified, idempotent non-financial mission achievements, authenticated GHC ledger history, daily-claim integrity and abuse-protection gates. Mission GHC issuance remains disabled by policy; the additive mission-verification migration requires operator-reviewed Testnet validation before production approval.
- Static/source audit: **57/57** consolidated checks passing; dedicated i18n engine gate **11/11** and social localisation gate **12/12** (source-only; 2026-11-03)
- Pass 41: marketplace loaders now protect against stale responses and preserve last-known data on transient failures; feed requests use latest-request-wins cancellation
- Pass 42: marketplace API record normalization is centralized in runtime-tested domain mappers for listings, saved items and durable orders
- Phase 1 foundation pass: release-truth metadata, documentation hygiene, and the marketplace shared-mapper regression contract reconciled; see `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md`.
- Pass 43: Feed, Connections and Discovery read seams are connected to the policy-filtered GHC session; production discovery now requires explicit server-hydrated candidate provenance
- Pass 44: 10 high-impact financial/payment routes use awaited, fail-closed durable rate limits
- Pass 45: bounded retention for expired security-control-plane state, 90-day default security-event expiry, and strict limiter input/RPC response validation
- Pass 46: correct 429/503 durable-limiter failure semantics, fail-closed social mute/block writes, and app-wide keyboard/reduced-motion/mobile interaction polish; no Cloudflare/R2 integration
- Pass 47: global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root-level error diagnostics
- Pass 48: inactive tab panels and hidden bottom navigation are made inert, preventing keyboard focus from entering visually hidden app surfaces
- Global Internationalisation Engine (0.289.0): persistent locale selection, BCP 47 canonicalisation, locale-aware number/date/currency/list formatting, RTL document direction, API locale headers and explicit English fallback and per-locale translation coverage disclosure.
- Global Language Foundation (0.288.0): canonical catalog expanded to 60 countries (10 per continent), 240 country-language recommendations added, locale/script direction metadata validated, and location entry now supports countries without seeded subdivision data
- Phase 3 language packs (0.290.0): partial Hausa, Igbo, Yoruba and Nigerian Pidgin translations for persistent navigation and essential language-status messages, with English fallback and explicit incomplete-coverage disclosure.
- 0.294.0 Phase 7 social-surface localisation: notification-centre chrome and GH Pulse short-video controls, accessible labels, loading/empty/offline states now follow the selected locale. All four Nigerian packs remain partial pending native-speaker review.
- 0.293.0 Phase 6 workflow localisation and native-review governance: adds preview translations for post creation, profile editing, community-board guidance, marketplace listing forms and wallet transaction-history labels, plus a version-bound native-speaker approval gate. All Nigerian locale packs remain partial pending review.
- 0.292.0 Phase 5 experience localisation: adds preview translations for feed filters and personalisation, discovery categories/search/offline states, and localised home greetings across Hausa, Igbo, Yoruba and Nigerian Pidgin. All packs remain partial pending native-speaker review.
- Phase 9 (0.296.0): RTL-safe logical layout, localized keyboard skip navigation, bidirectional number isolation, and high-contrast/forced-colors support.
- Phase 10 (0.297.0): shared accessible live-status primitive, localized main landmark and navigation announcements, 44px interactive target baseline, consistent focus visibility, reduced-motion handling, and forced-colors validation.
- Phase 12 (0.298.0): resilient locale preference lifecycle for restricted embedded browsers and cross-tab changes, defensive Intl unit/plural fallbacks, and a global-locale integration gate. Preview packs remain pending native review.
- Phase 13 (0.299.0): simplified social Stories cards, full-screen profile/cover photo previews, and viewer-authorized private Story media rendering.
- Phase 14 (0.300.0): full-screen pre-publish image gallery previews, inline video playback previews, and private-media-aware Story previews.
- Phase 16 (0.302.0): comment photo/video attachments open in a full-size viewer/player with explicit download controls; comment loading has an announced skeleton state; the comments dialog traps keyboard focus and restores focus/scroll; post curation labels are simplified. Existing server-owned reactions, comments, sharing, moderation and media authorization remain authoritative.
- Phase 18 (0.304.0): private-media signed URL cache is bound to the viewer identity epoch; account export and strongly confirmed deletion-request intake are integrated into Privacy & Safety.
- Phase 19 (0.305.0): creator tip idempotency supports safe retries and distinct repeat tips; Creator Studio now fails closed on incomplete earnings sources and discloses per-source data quality.
- Phase 20 (0.306.0): all seller payout intake/history, bank beneficiary, bank resolution, provider execution, PI/GHC/bank reconciliation and operator transition routes now use the shared database-backed rate limiter with fail-closed behavior when the control plane is unavailable. Settlement, treasury, provider verification and payout state-machine contracts are unchanged.
- Phase 21 (0.307.0): private messaging read/send/edit/delete, private-media signed URL resolution and upload/resolution, and account export/deletion-request intake now use awaited database-backed rate limits with deny-on-unavailable semantics. Existing membership, media authorization, step-up and ownership checks remain authoritative. A repository-integrity gate verifies all 10 boundaries, pipeline registration, package/lockfile parity, migration-prefix uniqueness and exact migration-manifest byte synchronization. No migration was added; the canonical inventory remains 175.
- Phase 22 (0.308.0): durable marketplace order transitions now execute through a service-role-only row-locking RPC. Concurrent status changes are serialized against one database state; RPC failure is fail-closed; the canonical order read includes commerce fields. No wallet, GHC, Pi, refund, payout or ledger settlement logic is added. One migration is added for operator review; it is not applied.
- Phase 23 (0.309.0): migration-wide integrity checks cover 177 canonical SQL migrations and SECURITY DEFINER search_path declarations. Marketplace reservation expiry cleanup is moved outside the locked order-snapshot transaction; application reads fail closed if cleanup is unavailable. The additive migration remains REVIEW_REQUIRED and unapplied.
- Phase 24 (0.310.0): final source review reconciles migration classifications across the canonical CSV, generated checklist, verified manifest and Testnet operator guide. The guide now lists every migration in canonical order with explicit hold/review actions; a regression gate prevents classification or apply-guide drift. This does not apply migrations or certify live database/provider behavior.
- Production status: **NOT APPROVED** until supported-runtime build, live backend/provider evidence and migration reconciliation are completed

- Phase 26 (0.313.0): premium active-asset wallet hero, bounded/cancellable ledger reads, latest-request-wins refreshes, honest server-confirmed balance labels and a canonical current build context. Pi and GHC remain separate; no financial mutation authority or migration changed.

## Source of truth

Read `docs/CURRENT_BUILD_CONTEXT.md` first for every new implementation prompt, then `docs/SOURCE_OF_TRUTH.md` for document precedence and release boundaries. It defines document precedence and prevents historical worklogs from being mistaken for current product requirements.

Use `docs/PROJECT_TRUTH.md` for the current release boundary and verification status. Use the current dated audit documents only for the feature they cover.

## Important repository rule

The Next.js application must live at repository root. `app/`, `components/`, `features/`, `hooks/`, `lib/`, `public/`, `scripts/`, `supabase/` and `package.json` must be directly under the repository root. Do not wrap the project in an extra directory such as `ghdatetime/`.

## Verification boundary

Source checks prove source contracts only. They do not prove that Supabase migrations are applied, Pi/Testnet providers are live, realtime infrastructure is configured, or the Node 24 production build has passed in the target environment.

## Wallet & Rewards Roadmap — Phase 3 (Rewards Transparency)

This source update adds a Rewards Centre summary for available, pending, and locked GHC amounts. Values are displayed only from the existing server-authoritative `/api/social/economy/status` snapshot; an unknown value is shown as an em dash rather than a fabricated zero. The summary explains that pending and locked rewards are not spendable and links to the existing reward history tab. It does not mint, claim, unlock, or transfer funds.

Regression check: `npm run check:wallet-rewards-phase3`. This check is registered in both `prebuild` and `verify:static`. Targeted source checks do not replace the required Node-version-compatible build, TypeScript/lint suite, database/RLS verification, or end-to-end testnet financial reconciliation.


### 0.295.0 — Phase 8 locale presentation

Shared locale-aware formatting now covers compact numbers, percentages, measurement units, relative time, plural selection and text collation. Regional context exposes the active locale presentation metadata (direction, numbering system, calendar and hour cycle). Formatting is display-only: canonical values, currency codes, wallet amounts and transaction records are not modified.


### 0.296.0 — Phase 9 RTL and accessibility foundation

Added a locale-aware keyboard skip link, shared RTL-safe logical CSS primitives, explicit bidirectional isolation for notification counts, contrast/forced-colors enhancements, and responsive readable-copy utilities. Locale direction remains derived from the canonical locale registry; mixed-script text and numeric display are isolated without changing stored values. Translation catalog version 6 requires renewed review. No database, authentication, wallet, Pi payment or financial logic changes.


### 0.297.0 — Phase 10 accessible interaction system

Added a reusable accessible status primitive for loading and feedback, localized screen-reader announcements and main landmark naming, minimum 44px interactive target sizing, consistent keyboard focus indicators, reduced-motion handling, and forced-colors error affordances. Catalog version 7 requires fresh review. No domain, database, authentication, wallet or payment logic changes.


### 0.298.0 — Phase 12 global locale integration

Explicit locale selections now survive blocked browser storage for the active session, persisted selections are retained as an in-memory fallback, and cross-tab updates/reset behavior remain coherent. Locale-aware unit and plural formatters fail safely when Intl implementations reject runtime inputs. A dedicated source contract is part of prebuild and static verification. No database, authentication, wallet, Pi payment or financial logic changed.

### 0.300.0 — Phase 13 social Stories and profile media

Stories now use a compact, familiar horizontal card rail. Profile and cover images open in a full-screen viewer instead of immediately launching upload actions. Story media uses the viewer-authorized URL resolver so private media references can be displayed safely. See `docs/SOCIAL_STORY_PROFILE_MEDIA_PHASE13_0.300.0.md`.


### 0.300.0 — Phase 14 creator media preview

Post attachments now open in the shared full-screen gallery before publishing; attached videos can be played inline before publishing. Story image previews open full-screen and Story video previews use the viewer-authorized durable-video resolver. Upload and publish ownership remain in the existing server-backed compose pipeline. No database, authentication, wallet, Pi payment, GHC ledger or financial contracts changed.


### 0.301.0 — Phase 15 feed experience refinement

The feed/profile composer now uses a simpler neutral layout with a single text entry and focused photo/video shortcuts. Discovery prompts are less frequent and are hidden in focus mode and non-personalized feed filters. Feed ranking, canonical publishing and server-owned data contracts remain unchanged.


### 0.302.0 — Phase 16 post interaction experience

Comment photo attachments now open in a full-size, proportion-preserving viewer; video attachments open in an accessible playback surface, with download kept as a separate action. The comments sheet has a truthful loading skeleton, keyboard focus containment, body-scroll locking and focus restoration. Curation copy is more concise without changing vote semantics. No database, authentication, wallet, Pi, GHC or financial contracts changed.

- Phase 27 (0.313.0): corrected nested-scroll direction detection and true in-flow bottom-navigation collapse; curation analytics now open in an accessible portal sheet and fetch lazily with bounded, cancellable, latest-request-wins requests. No financial or migration authority changed.



### 0.327.0 — Phase 9 Membership Pi intent integrity

Completed-payment membership grants and recovery now require exact durable Pi provider, PI currency, membership purpose, non-empty provider payment ID and COMPLETED/FULFILLED state. Missing or mismatched rail discriminators fail closed across activation, completion, fulfillment, recovery and history reconciliation. Production Pi grants use the row-locked idempotent renewal RPC and authoritative post-write confirmation; pending activation returns retryable status. Both generic and dedicated utility spend routes block boosts/tools until durable activation exists. An additive service-role-only SQL renewal guard is REVIEW_REQUIRED and unapplied. GHC/Pi separation and existing catalog/product/amount checks remain unchanged. See `docs/PHASE-9-MEMBERSHIP-PI-INTENT-SECURITY-0.327.0.md`.

### 0.326.0 — Phase 9 Membership lifecycle and access control

Membership status presentation now uses authoritative server state; protected premium messaging products enforce required VIP/VVIP entitlements before GHC debit; verified Pi renewal derives calendar duration and bonus month from the durable catalog-bound payment intent; a 72-hour renewal-continuity window does not grant access during expiry gaps; and authenticated lifecycle history plus operator-only expiry controls are included. Plans remain prepaid/non-recurring. The additive migration is REVIEW_REQUIRED and unapplied; Node 24.15.x build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain required.

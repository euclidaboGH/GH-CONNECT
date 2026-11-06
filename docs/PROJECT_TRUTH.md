# GreenHaven — Project Truth

**Current source version:** `0.330.1`
**Current status:** **NOT APPROVED** for production release.

## 0.330.1 — Phase 10 CI regression-contract repair

The release retains the 0.330.0 Settings/media/navigation work and corrects stale regression contracts: PI wallet action validation matches the implemented dedicated Withdraw action, Stories own-story ring validation matches the actual emerald treatment, and the legacy Phase 5 release-readiness check dynamically validates the current package/manifest versions rather than hardcoding 0.312.0. Generic image URL mutation is removed to preserve signed storage/CDN URLs and private media facade identifiers. Infinite-scroll locks now span asynchronous page loads, preventing duplicate pagination requests; older embedded WebViews without IntersectionObserver receive visible content. The 0.329.0 public-static service-worker policy and reduced-data prefetch controls remain in force. This is a source-level UX/performance increment only; no database migration, Pi payment, GHC ledger, entitlement, or production authority is changed. Phase 9 Membership acceptance remains open, and the release remains NOT APPROVED until supported-runtime, database, Testnet, browser/device and operator gates pass.

## Current authoritative metadata

- Package and lockfile version: `0.330.1`.
- Runtime: Node `24.15.0` / package engine `^24.15.0`.
- Canonical Supabase migrations: **189** SQL files.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with all 189 canonical migrations.
- No local secret `.env` file is included; `.env.example` is the only env template.

## Current source/audit status

The 0.319.0 increment adds editable professional/creator/business identity, a public portfolio and experience showcase, account-scoped server achievements, explainable discovery relevance from professional interests, and privacy-filtered public identity projections. The 0.320.0 Phase 7 Wallet source implementation is closed: its Pi withdrawable snapshot read is abortable, time-bounded and strictly validated. External Node 24.15.x typecheck/lint/build, browser/device acceptance and live Pi Testnet reconciliation remain production release blockers. Phase 8 Rewards source implementation is closed in 0.323.0: premium account-scoped Rewards hydration, server-authoritative daily claims, authenticated cross-device GHC ledger history/search/filtering, and seven durable server-verified idempotent mission achievement unlocks. Mission achievements are non-financial; GHC activity issuance remains disabled by the current policy. The new additive mission-verification migration is REVIEW_REQUIRED and not applied. Node 24 build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain outstanding. No GHC/Pi financial execution authority changed.


The 0.289.0 internationalisation engine builds on the 0.288.0 Global Language Foundation. Locale preferences are saved locally and reflected in document language/direction and regional API headers; formatters use Intl APIs. At v0.289.0, English was the only complete UI translation catalog; the v0.292.0 preview packs are separately identified as partial and are not represented as complete translations. No automatic content translation or database migration was added.

The 0.290.0 Phase 3 language pack adds preview translations for persistent navigation and essential language-status copy in Hausa, Igbo, Yoruba and Nigerian Pidgin. Navigation labels and accessible names follow the selected locale. Translation coverage is intentionally reported as partial: the wider application remains English until each feature area is translated and native reviewers approve terminology. English remains the safe fallback for unsupported locales. User-generated content is not machine-translated, and no database migration or financial/authentication change was introduced.


The 0.292.0 Phase 5 experience-localisation increment extends the preview catalogs into feed filters, feed search and personalisation controls, discovery categories and accessibility/offline states, and time-of-day home greetings. Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial preview packs; missing strings fall back to English. No user-authored content, private messages, legal text, identity/security instructions, wallet balances, payment states or transaction rules are translated. No database, authentication or financial logic was changed.

The 0.288.0 Global Language Foundation retains all 36 previously catalogued countries and adds 24 approved country records, resulting in ten countries per continent. It introduces 240 country-language recommendations (four per country), standardized locale tags, native display names where confidently available, script direction metadata and a fail-closed validation gate. All recommendations remain pending human review; no translations are claimed complete. The location picker supports manual region and locality entry where verified subdivision seeds are not yet available. No database migration or existing user-location rewrite was required.


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

The 0.292.0 Phase 4 product-surface localisation extends preview strings to messaging inbox headings/filters, community discovery labels/search, marketplace navigation/search and settings discovery. The four Nigerian locale packs remain partial and require native-speaker review. English remains the fallback for untranslated keys and unsupported locales. No user-authored content translation, database migration, authentication change, wallet change or financial logic change was introduced.


## 0.293.0 Phase 6 — workflow localisation and review governance
The phase adds typed preview translations to the post composer, profile editor, community-board explanation, marketplace listing form and wallet transaction-history heading. It introduces a native-speaker review gate requiring reviewer identity, review timestamp, exact catalog version and product-owner approval. All Hausa, Igbo, Yoruba and Nigerian Pidgin packs remain partial and pending review. User-generated content, private messages, profile-authored text, listing descriptions, financial amounts, currency codes, fees, payment states and transaction identifiers are not automatically translated or recalculated. No database, authentication, wallet-ledger or payment logic changes are included.


## 0.294.0 Phase 7 — social-surface localisation
The notification centre and GH Pulse short-video experience now consume a typed social-message catalog for Hausa, Igbo, Yoruba and Nigerian Pidgin preview packs. Core notification controls, accessibility names, offline/unavailable feedback, empty states, video modes and playback controls follow the selected regional language. Locale changes update short-video labels without remounting the experience. Server-authored notification content, user posts, captions and author names remain untouched. The catalog version is 4 and the native-review gate is version-bound; all four packs remain partial and pending review. No database, authentication, wallet, payment or financial logic changed. The social translation regression gate passes 13/13.


## 0.295.0 Phase 8 — locale presentation and formatting

Added a shared formatting toolkit for compact numeric display, percentages, measurement units, relative time, plural forms, and locale-aware text comparison. Regional context exposes locale presentation metadata including text direction, numbering system, calendar and hour cycle. These functions are display-only and do not mutate canonical identifiers, amounts, currency codes, ledger records or payment state. Catalog version 5 is pending native-speaker/product-owner review; no preview locale is promoted to complete.


## 0.296.0 Phase 9 — RTL and accessibility foundation

The app already applies canonical locale direction to the document root. This phase strengthens that foundation with logical-property styling primitives, a locale-aware keyboard skip link, bidi-isolated notification count values, high-contrast and forced-colors support, and readable-copy/reflow utilities. Directional icon flipping is opt-in through `.gh-directional-icon`; non-directional icons are never globally mirrored. Numeric notification counts use isolated LTR rendering while their surrounding labels inherit the selected locale direction. Translation catalog version 6 must be reviewed before any preview language can be approved. No database, auth, wallet, payment or financial logic was changed.


## 0.297.0 Phase 10 — accessible interaction system

Shared status semantics now cover lazy-screen loading, navigation announcements and localized main landmark naming. Interactive controls receive a 44px minimum target baseline, focus-visible indicators are consistent, reduced-motion preferences suppress nonessential animation, and forced-colors mode retains focus/error affordances. Catalog version 7 is pending renewed review. Source checks do not replace browser/screen-reader validation.


## 0.298.0 Phase 12 — global locale integration

Explicit locale choices now survive localStorage failures for the active session, including later visibility/language refreshes. Cross-tab preference changes and reset behavior synchronize the in-memory fallback. Unit and plural formatters have defensive fallback behavior. The Phase 12 source gate covers locale lifecycle, document metadata, regional headers, preview translation governance and financial-display boundaries. This does not promote preview packs or replace browser/native-speaker acceptance.


## 0.300.0 Phase 13 — social Stories and profile media

The Stories rail is now a restrained horizontal strip of compact vertical cards. Existing profile and cover photos open in the shared full-screen media viewer; editing is a separate action. Story image/video viewing resolves private-media facade references through the viewer-authorized URL path. Existing story audience, publishing, reply, reaction, and viewer contracts remain in place. The Phase 13 source UX gate passes 13/13; device and production acceptance remain pending.


## 0.300.0 Phase 14 — creator media preview

The post composer now provides full-screen previews for selected image attachments and inline playback for attached videos. Story images can be opened in the shared full-screen media viewer; Story videos use the private-media-aware DurableVideo component. Preview and removal are distinct actions. Uploading and publishing remain owned by the existing compose pipeline. The Phase 14 source gate validates these boundaries; browser/device acceptance remains pending. No database, authentication, wallet, Pi, GHC or financial contracts changed.


## 0.302.0 Phase 16 — post interaction experience

Comment image attachments open in a full-size proportion-preserving viewer; video attachments open in a dedicated playback preview, with download actions kept separate. The comments dialog now provides an announced loading skeleton, traps keyboard focus, locks background scrolling and restores focus on close. Post curation language is simplified without changing curation weights, vote persistence, server authorization, comments, reactions, sharing or moderation. The Phase 16 source gate validates these UI and accessibility contracts; browser/device acceptance remains pending. No database, authentication, wallet, Pi, GHC or financial logic changed.

## 0.301.0 Phase 15 — feed experience refinement

The shared feed/profile composer has been simplified into one clear text-entry action with two focused media shortcuts (photo and video). Decorative gradients and the redundant feeling shortcut were removed. Feed discovery prompts now appear at a lower cadence (once per twelve displayed posts), use a compact inline presentation for people discovery, and are suppressed in focus mode and non-personalized feed filters. The canonical create hub, feed ranking, server hydration, post actions, media authorization and domain contracts are unchanged. Phase 15 source checks cover the presentation and boundary contracts; device/browser acceptance remains outstanding. No database, authentication, wallet, Pi, GHC or financial logic changed.


## 0.304.0 Phase 18 — private-media session isolation and account privacy controls

The browser-side signed-media cache is scoped to the active GreenHaven identity/authentication epoch. Identity changes clear cached/in-flight resolutions and notify mounted image/video surfaces to discard prior playback URLs and resolve again under the new session. Settings → Privacy & Safety now exposes a downloadable JSON account export and a typed-confirmation deletion request. Both actions require the existing server-side recent step-up contract. Export remains an explicit allowlist of supported GreenHaven records and fails closed rather than returning a partial export. Deletion intake records a request only; no destructive deletion, wallet forfeiture, payment, or settlement is performed by the request endpoint. No migration was added or applied.

Verification: Phase 18 source contract 18/18; the consolidated static suite is rerun and tracked in the current release worklog. Supported-runtime Node 24.15.x typecheck, lint, production build, browser/device verification and live provider/database checks remain separate release gates.


## 0.305.0 Phase 19 — creator economy and engagement integrity

Creator tip idempotency now follows a user-action key when supplied through `Idempotency-Key` or the bounded request body. Reusing a key is retry-safe; a fresh key enables a distinct later tip to the same creator at the same amount. Legacy clients retain the prior deterministic fallback. Creator economy summaries now require all four contributing data sources (PI tips, GHC tips, post rewards and creator ledger) to return valid collection payloads before publishing combined totals. Creator post reads reject malformed upstream shapes, the creator endpoint exposes per-source health, and Creator Studio suppresses unknown totals rather than rendering fabricated zeros.

Verification: Phase 19 creator commerce integrity source contract 15/15; tip idempotency runtime checks cover stable retries, distinct repeat tips, legacy fallback and invalid-key rejection. No migration was added; the canonical migration count remains 175. This source-only evidence does not establish live provider, database, payout, TypeScript, lint, browser or production-build acceptance.


## 0.306.0 Phase 20 — durable seller payout abuse controls

All twelve seller payout and banking API routes now use the shared database-backed rate limiter with an explicit deny-on-unavailable policy. This removes process-local limiter dependence from payout request intake/history, bank directory/account resolution, beneficiary create/disable, bank transfer execution, PI/GHC/bank reconciliation, operator transitions and exception resolution. Rate-limit storage outages now return the control-plane unavailable response rather than silently falling back to per-instance counters. Existing recent-step-up checks, operator secrets, payout idempotency, provider amount/recipient/reference verification, treasury funding checks and atomic settlement RPCs remain authoritative. No migration was added; the canonical migration inventory remains 175.

Verification: `check:phase20-payout-durable-limits` validates all 12 route contracts, fail-closed behavior, durable status/error mapping, and migration inventory uniqueness. This is source-level verification only; it does not prove live Supabase RPC availability or provider settlement.


## 0.307.0 Phase 21 — private-surface durable abuse controls

Private messaging reads, sends, edits and deletes; private-media signed URL issuance, media resolution, direct-upload intent and buffered upload; and account export/deletion-request intake now use the shared database-backed rate-limit control plane. Each boundary awaits the limiter and denies the request with the explicit 503 unavailable contract if durable enforcement cannot be reached; exhausted quotas remain 429. This replaces process-local counters for these high-sensitivity surfaces without changing conversation membership, media viewer authorization, owned-attachment validation, recent-step-up requirements, account export completeness or deletion-request semantics.

A Phase 21 repository-integrity gate is registered in both `prebuild` and `verify:static`. It validates the ten durable boundaries, pipeline registration, package/lockfile version parity, migration-prefix uniqueness, and exact synchronization of the 175-file migration source manifest including byte counts. No database migration was added or applied. Verification remains source-level; supported-runtime typecheck, lint, production build, browser/device checks, live Supabase and provider acceptance are outstanding.


## 0.308.0 Phase 22 — atomic marketplace order transitions

Durable order-state changes now use `gh_marketplace_order_transition`, a service-role-only PostgreSQL function that locks the target order row with `FOR UPDATE`, validates the existing state transition matrix, records an audit event and returns the refreshed canonical order. The application no longer performs a database-backed read/modify/upsert for these transitions. If the RPC is unavailable or returns an invalid payload, the request fails closed; it does not fall back to process memory. The canonical order-read RPC now includes the commerce/delivery fields already present in the schema. Payment verification remains downstream of authoritative payment settlement; this RPC does not create GHC/Pi payments, refunds, escrow releases, wallet entries, ledger entries or payouts.

Verification: Phase 22 source gate checks row locking, service-role ACLs, fail-closed transport, canonical response use, pipeline registration, package/lockfile parity and migration uniqueness. The new migration is classified `REVIEW_REQUIRED`; it has not been applied. PostgreSQL execution/concurrency tests, migration-history reconciliation, Node 24 typecheck/lint/build, live Supabase/provider checks and browser/device acceptance remain outstanding. Production remains **NOT APPROVED**.


## 0.309.0 Phase 23 — migration and order-read integrity
- Added a source migration that makes the canonical marketplace order snapshot read side-effect free.
- Application order reads explicitly run reservation expiry cleanup before snapshot retrieval and fail closed if cleanup cannot be confirmed.
- Atomic transition and commerce RPCs can return order snapshots without running a global expiry sweep while holding an order-row lock, reducing cross-order lock contention/deadlock risk.
- Static migration audit checks canonical filenames, unique versions, non-empty files, and fixed search_path on every SECURITY DEFINER function definition.
- Migration remains REVIEW_REQUIRED; no database was connected or modified.


## 0.310.0 Phase 24 — final source and migration-operator review

The migration classification source is now synchronized across `MIGRATION-SOURCE-MANIFEST.csv`, `docs/MIGRATION_CHECKLIST.md`, `VERIFIED_MANIFEST.txt`, and the generated `supabase/TESTNET_APPLY_ORDER.md`. The previous hand-maintained Testnet apply sequence is replaced with a complete 177-entry review inventory, sorted by canonical migration identifier and explicitly distinguishing review, approval, validation hold, and proposal/no-apply states. A regression gate checks the classifications, guide rows, generated inventory, release version and critical phase-gate registration.

This is a source/documentation integrity completion only. It does not prove that any migration has been applied, that the target schema is compatible, or that PostgreSQL concurrency, Pi/Paystack providers, Testnet, Mainnet, browser/device journeys, or production build have passed. The 58 `REVIEW_REQUIRED`, 1 `REQUIRES_APPROVAL`, and 2 `PROPOSAL` classifications remain held. Production remains **NOT APPROVED**.


## 0.313.1 Final polish

Toast clearance, capped toast stack, version/docs sync. No financial authority changes.

## 0.313.0 Product UX track Phases 1–5 (trust → release)

Media facade story publish, Discover CTA/presence honesty, Communities My membership enrichment, feed soft-refresh + composer/stories polish, aggregated release gate. **SOURCE VERIFIED only** — Testnet migration `20261104180001` and A2U funding remain operator-owned.

## 0.312.0 Phase 26 — wallet ledger resilience and premium wallet experience

Wallet summary and Pi earnings reads are bounded, superseded requests are cancelled, timeout resources are cleaned up, and the PI dashboard uses latest-request-wins refresh sequencing. The wallet hero presents the selected asset rail and separates available, pending, locked, withdrawable and reserved figures. GHC is described as server-confirmed only when the validated snapshot is ready and server-sourced. `docs/CURRENT_BUILD_CONTEXT.md` is now the canonical concise brief for future build prompts; older worklogs and visual references are historical only. No SQL migration or financial mutation authority changed. Typecheck, lint, production build, live database/provider and device acceptance remain outstanding. Production remains **NOT APPROVED**.

## 0.312.0 Phase 27 — scroll immersion and creator analytics

- Bottom navigation now hides on upward content movement and returns on downward content movement, resolving the actual nested scroll owner rather than the tab wrapper. The hidden in-flow bar collapses fully and releases its reserved content inset.
- Curation and post insights are presented in an accessible modal sheet, not an inline expanding accordion. Analytics load only when opened, with a 10-second abort boundary and stale-response fencing.
- No SQL migration, GHC minting, vote economics, Pi settlement or wallet authority changed.


## 0.315.4 — Curation intelligence refresh recovery (source-only)

The curation intelligence refresh function in the prior source attempted to return a nonexistent `id` column from `gh_reputation_intelligence`; it also allowed missing reputation/calibration rows to overwrite initialized defaults with NULL. The additive correction removes the invalid return target and uses aggregate reads that always return a row with safe defaults. It preserves service-role-only execution, stored server-authoritative curation power, existing risk controls, atomic vote/reward/GHPV boundaries, and does not mutate GHC or wallet balances. The migration is `REVIEW_REQUIRED` and has not been applied. Testnet history reconciliation and disposable PostgreSQL validation are mandatory before application.

The full source-only verification suite passes on Node 22.16.0, but the project requires Node `^24.15.0`; TypeScript, lint, and production build remain unverified here. Live Supabase RPC behavior, snapshot creation, voting, curation rosters, and Testnet two-account behavior remain operator gates.


## 0.315.5 — Phase 1 social foundation (source-only)

Phase 1 revisits the social posting, voting, curation and community-board foundation. It adds a member-authorized, viewer-aware `gh_community_post_list` RPC and authenticated `/api/communities/[id]/posts` read endpoint. The RPC scopes records to the requested community, excludes deleted/archived posts, reuses canonical post-visibility enforcement, returns server-owned vote aggregates, reaction counts, saved state and the viewer's own curation/reaction choices, supports stable keyset pagination, and is executable only by `service_role`. The matching community client helper hydrates the hub from canonical social posts. Canonical community cards now reuse `EnhancedPostCard`, the same interaction component used by Feed/Profile, so voting, reactions, saving, comments and sharing use existing durable social endpoints. Legacy local-only `bpost_` / `local_` rows are explicitly read-only; they no longer display controls that imply durable voting. They must be republished by their authors to enter the canonical social ledger; the system does not impersonate authors or silently convert local data.

The existing curation intelligence refresh correction remains additive and `REVIEW_REQUIRED`. The new community-feed migration `20261106090001_gh_community_post_feed_canonical.sql` is also `REVIEW_REQUIRED`; it depends on the previously defined community role and canonical post visibility functions. Neither migration has been applied to Testnet or Mainnet. Reconcile each remote migration history, validate both migrations and query plans on disposable PostgreSQL, then run member/non-member, block, deleted-post, cursor, curation and two-account Testnet checks before application.

Verification completed for the 0.315.5 source baseline: full `npm run verify:static` passed, including the Phase 1 community/social contract (12/12), curation-intelligence recovery contract (10/10), existing post/curation production contract (12/12), and community global-standard contract (11/11). Migration inventory was 183 files at that release. TypeScript, ESLint, production build, live Supabase RPC behavior, and Testnet two-account/device acceptance were not certified.


## 0.315.6 — Phase 1 deep completion and reconciliation (source-only)

The Phase 1 deep pass aligns curation preflight with the canonical post-visibility function, so block, follower, mutual-follow, and active community-membership policy is consistent between reads and writes. It consistently denies self-curation, serializes the per-user daily curation cap across concurrent post votes, and makes activity-audit persistence mandatory in the same transaction as the vote and GHPV state update. The community-feed cursor now sorts on the same millisecond/id key it filters on. The community board preserves its last known-good canonical posts when a refresh fails, fences stale requests, and only clears a new-post draft after the parent confirms success.

The additive migration `20261106110001_phase1_curation_community_guard_reconciliation.sql` is `REVIEW_REQUIRED`. Together with `20261106080001_gh_reputation_intelligence_refresh_recovery.sql` and `20261106090001_gh_community_post_feed_canonical.sql`, it must be reconciled against Testnet and Mainnet migration histories independently and validated on disposable PostgreSQL before any application. No GHC issuance, Pi payment, wallet balance, payout, or financial settlement authority is changed.

Source verification: full `npm run verify:static` passed on the available Node 22.16.0 runtime; the consolidated static suite reported 57/57 and all registered targeted checks passed, including Phase 1 deep completion (16/16). Migration inventory is synchronized at 184 files with duplicate numeric prefixes 0. TypeScript, ESLint and production build remain unverified because Node 24.15.0 and installed dependencies are unavailable in this environment. Live PostgreSQL, Supabase RPC, Testnet concurrency, two-account access and device acceptance remain open. Production remains **NOT APPROVED**.


## 0.315.7 — Phase 2 Stories premium rebuild (source-only)

Stories now group multiple active stories by creator and play each creator's sequence chronologically. Story-seen state is account-scoped locally and hydrated from the durable server view ledger; successful durable empty-list responses clear stale cached stories. The viewer adds pause/resume, reduced-motion-aware progression, and video end progression. The story creator duplicate close control was removed. Story hydration now preserves server reaction counts and viewer reaction state.

The additive migration `20261106130001_gh_story_view_privacy_and_read_performance.sql` hardens direct story-view writes with the same audience and bidirectional-block policy as story reads, excludes author self-views, adds a viewer lookup index, returns server-confirmed seen state, and removes expiry mutation from the active-story read RPC. It is classified REVIEW_REQUIRED. Validate on disposable PostgreSQL, reconcile Testnet and Mainnet histories independently, and apply only after explicit operator approval. No live database operation was performed.

Source regression gate: `scripts/check-phase2-stories-premium-upgrade.mjs` (23/23), existing story rail gate (9/9), story/profile media gate (13/13), Phase 4 story shell gate (12/12). Full static verification still requires the remaining release-truth fixtures and supported-runtime checks to pass; TypeScript, lint, production build and live browser/database acceptance are not claimed here.


## 0.315.9 — Phase 4 Cart and Checkout premium upgrade (source-only)

The local marketplace cart now validates and bounds cached rows, consolidates duplicate listing IDs, synchronizes across tabs, and locks cart editing during checkout. Successful checkout removes only lines whose orders were durably reserved, preserving unrelated cart entries. Server-side order reservation and GHC/Pi payment authority remain unchanged. No SQL migration was added or applied. Static cart contract: 10/10; runtime cart assertions: 8/8. Supported-runtime build, live payment, Testnet and operator acceptance remain open.

## 0.315.8 — Phase 3 Marketplace premium upgrade (source-only)

Marketplace browse now supports product/service/opportunity and delivery-mode filters with a one-action reset. Price sorting keeps GHC and PI in separate currency groups rather than comparing nominal amounts across assets. Listing cards improve condition, availability and keyboard/reduced-motion feedback. Marketplace listing reports now submit through an authenticated, bounded, fail-closed server route using the durable rate-limit control plane and a service-role-only idempotent SQL RPC; the client confirms success only when the API reports a durable record. The additive migration `20261106150001_marketplace_listing_report_intake.sql` is REVIEW_REQUIRED and must be tested on disposable PostgreSQL and reconciled against Testnet/Mainnet histories independently before application. No order, inventory, payment, wallet, GHC, Pi, payout or settlement authority is changed.

Source regression gate: `scripts/check-phase3-marketplace-premium.mjs` plus currency-aware sorting runtime tests. Node 24.15.0 TypeScript, ESLint and production build gates, disposable PostgreSQL execution, Testnet moderation-queue review, and browser/device acceptance remain required; source checks do not establish production readiness.

## 0.319.0 Phase 6 completion and Phase 7 premium profile experience

Profile relationship state uses per-domain derived indexes over canonical social graph arrays; indexes are independently invalidated and batch-hydrated. Discovery cards consume prepared relationship states. Account switches abort stale profile pagination and identity hydration, clear previous-account counters, and reject late responses. Block-first safety and private financial-data boundaries remain intact. Phase 7 adds accessible reputation progress, localized number formatting, announced loading states and last-known-good recovery. No migration, identity authority, wallet, Pi, GHC or financial-authority change. Dedicated Phase 6/7 runtime and source checks pass; supported Node 24.15.x typecheck, lint, production build and browser/device acceptance remain pending.


## 0.322.0 Phase 8 — Rewards premium experience and ledger history

Rewards Centre snapshot reads are now bounded, abortable, authenticated and account-scoped. Invalid/null amounts remain unknown rather than becoming false zeroes, optional returned user identity is checked, and the UI exposes confirmed/loading/refreshing/unavailable states. Daily claim amount messaging accepts only a finite non-negative server-reported amount; it does not substitute local streak estimates. A failed daily claim cannot show a success flash. Reward issuance, idempotency, maturity and ledger authority remain server-side. No migration or financial authority changed.


## 0.323.0 Phase 8 Rewards source completion

The mission completion endpoint now derives the actor from verified server authentication, applies durable fail-closed rate limiting, parses a bounded request and ignores client metadata. Its service-role-only SQL verifier checks the seven supported mission proofs against durable membership, post, comment, profile and connection-request rows; advisory locking plus the existing unique achievement key make unlocks idempotent. It unlocks non-financial achievements only and always reports zero GHC. Migration `20261106170001_phase8_verified_mission_achievements.sql` is REVIEW_REQUIRED and unapplied. Phase 8 source work is closed; production approval remains pending Node 24.15.x build, disposable PostgreSQL/Testnet, browser/device and operator acceptance.


## 0.325.0 Phase 9 Membership foundation

Phase 9 begins with strict parsing of privileged membership entitlement rows, authenticated row identity checks, tier/source/period/active/timestamp validation, paid-expiry fail-closed rules (except explicit comp entitlements), expired/inactive paid normalization, bounded server/client status reads and rejection of conflicting purchase-duration inputs. GHC and Pi pricing/settlement authorities remain separate and server-owned. No migration or financial execution authority changed. Phase 9 remains active; Node 24.15.x, dependency-backed typecheck/lint/build, browser/device, disposable database/Testnet and operator acceptance remain outstanding.


## 0.326.0 Phase 9 Membership lifecycle and access control

Server-authoritative membership tier checks now protect catalog features before GHC debit. Premium membership presentation is based only on server status and includes authenticated read-only lifecycle history. The operator renewal workflow verifies the durable completed/fulfilled PI intent owner, provider, currency, purpose, canonical product and catalog amount; SQL derives the calendar access period including the bonus month, serializes renewal and enforces idempotency. A 72-hour continuity-only window preserves term alignment without granting access after expiry. Prepaid plans do not auto-renew; no recurring billing or refund authority was added. The lifecycle migration is REVIEW_REQUIRED and unapplied. Node 24.15.x typecheck/lint/build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain outstanding.


## Phase 9 current increment (0.327.0)

Strict Pi intent discrimination now protects activation, payment completion, fulfillment, recovery and payment-history reconciliation. Exact provider/currency/purpose/non-empty provider payment ID/completed state are required. Production Pi grants use the row-locked idempotent RPC with post-write confirmation; payment/fulfillment returns retryable pending status if entitlement is not confirmed. The generic GHC ledger-spend route also blocks premium boost/tool purposes until durable effects exist. The follow-up SQL renewal guard is REVIEW_REQUIRED and unapplied. Phase 9 source implementation is complete; external acceptance remains pending and no production approval is implied.



## 0.330.1 — Phase 10 navigation and media reliability
- Settings security/compliance/Pi capability/passkey/account-data panels are lazy-loaded with section-specific accessible fallbacks.
- Generic image URL mutation is removed so signed storage/CDN URLs and private media facade identifiers are preserved exactly.
- Infinite-scroll locks span the asynchronous page load; older WebViews without IntersectionObserver show content rather than leaving it deferred indefinitely.
- Focused navigation/media source gate: 9/9; runtime media/pagination tests: 7/7.
- No migration, Pi transaction, GHC debit, entitlement issuance or financial-authority change. Node 24.15.x build and browser/device acceptance remain outstanding. Production remains NOT APPROVED.

## 0.329.0 — Phase 10 resilience and media efficiency
- Service worker caches only explicitly allowlisted public static assets; navigations, API, media facades and personalized responses are network-only.
- Feed and Story prefetch respects reduced-data/Data Saver and constrained network conditions, rechecks at execution time and caps speculative work.
- Reconnect status timer is cleaned up on unmount.
- Added 17 static resilience assertions and 11 executable service-worker policy tests.
- No production migration, Pi transaction, GHC debit or entitlement issuance. Phase 9 external acceptance remains open.

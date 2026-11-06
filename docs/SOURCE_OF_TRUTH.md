# GreenHaven — Source of Truth & Prompt Execution Rules

**Current source version:** `0.330.1`
**Status:** source-audited; NOT APPROVED as a production release until the explicit runtime, database, provider and operator gates are completed.

## Authority order

Read `docs/CURRENT_BUILD_CONTEXT.md` first for the current concise product/build brief. It supersedes older prompt notes and historical worklogs as the active implementation context.

When documents disagree, use this order and stop to reconcile conflicts rather than guessing:

1. **Executable source code** (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `supabase/migrations/`).
2. **Current package/runtime metadata**: `package.json`, `package-lock.json`, `.nvmrc`, `vercel.json`.
3. **`docs/SOURCE_OF_TRUTH.md`** for project-wide release boundaries and prompt execution rules.
4. **`docs/PROJECT_TRUTH.md`** for current release metadata and verification limits.
5. **Current dated release/audit documents** (including the Phase 1 foundation audit) for the specific feature they cover.
6. **Referenced legacy verification documents** exist only because older regression scripts still validate them. They are historical fixtures, not current design authority.

## Prompt execution rule

Do **not** use an old worklog, phase note, archive note, or historical release document as the basis for changing current behavior when executable source disagrees with it.

For implementation prompts:
- inspect current source first;
- inspect the relevant current audit/release document second;
- treat legacy documents as background only;
- never resurrect a removed UI, route, migration, architecture, or product rule solely because an old document mentions it;
- if two current sources conflict, report the conflict before making a broad change.

## Current release facts

- Current source release: `0.330.1`.
- Canonical build prompt context: `docs/CURRENT_BUILD_CONTEXT.md`.

- Package version: `0.330.1`.
- Global i18n: `lib/i18n/index.ts`; locale preferences are device-persisted, formatting uses Intl, RTL is locale/script-driven, and English is the only approved UI translation bundle at this release.
- Node requirement: `^24.15.0`; `.nvmrc` is `24.15.0`.
- 0.295.0 includes partial Hausa, Igbo, Yoruba and Nigerian Pidgin preview translations across navigation, messaging inbox chrome, community discovery, marketplace navigation/search, settings discovery, feed filters/personalisation, discovery categories/offline states and home greetings. It does not claim full application translation or native-speaker approval.
- Canonical Supabase migrations: **189 SQL files**.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with the canonical directory.
- The latest repository archive was corrected to place the Next.js `app/` directory at repository root after a Vercel packaging failure caused by an extra wrapper directory.
- Static/source checks can pass without proving a Node 24 production build or live Supabase/Pi/Vercel behavior.
- Migrations are not considered applied merely because they exist in the repository. The curation-intelligence recovery, Phase 1 canonical community-feed, Phase 1 guard-reconciliation, and Phase 2 story-view privacy/read-performance migrations are REVIEW_REQUIRED and need independent Testnet/Mainnet history reconciliation plus disposable PostgreSQL validation.

- Phase 3 (0.315.8): Marketplace discovery filters, currency-safe price sorting, premium listing-card information hierarchy, seller-centre inventory/status management, and authenticated durable listing-report intake. The new report migration is REVIEW_REQUIRED; no commerce/payment/financial authority changes. See `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`.
- Phase 4 (0.315.9): Cart cache validation/bounds, cross-tab synchronization, checkout interaction locking and selective cleanup after durable order reservation. No database migration or payment authority change. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`.

## Current feature authorities

- Wallet / notification / premium UI: use the current feature audit documents and executable wallet/notification source.
- Feed / post / curation / comments: use `docs/PHASE-1-SOCIAL-FOUNDATION-0.315.5.md` and `docs/PHASE-1-DEEP-COMPLETION-0.315.6.md`, the current post-curation production document, and executable social source. Community canonical cards reuse the same EnhancedPostCard as Feed/Profile; local-only legacy community posts remain read-only until author republish.
- Community + Chat: Community membership and Chat membership are separate states; owner-controlled chat creation and approval ordering are authoritative in the current migrations/source.
- Regional context: server timestamps remain authoritative; viewer locale/timezone formats presentation; precise location is explicit opt-in and feature-scoped.
- Realtime/refresh: use the shared refresh coordinator and current shell/realtime implementation; do not restore removed polling merely because an old worklog used it.
- Economy/rewards: server-authoritative; no client minting and no GHC-per-view logic.

## Verification boundary

A passing static audit means source contracts are internally consistent. It does **not** mean:
- the 189 migrations are applied to Testnet/Mainnet;
- Pi provider payments/authentication work live;
- realtime infrastructure is configured in deployment;
- Node 24 `npm ci` + TypeScript + lint + Next production build has passed in the target environment;
- financial/payout/operator workflows are approved for Mainnet.

## Documentation hygiene

The repository intentionally keeps only current operational documents plus legacy documents that are still required by executable regression gates. New historical worklogs should not be added unless they are required as a test fixture. Feature truth belongs in current source and current canonical documentation, not an ever-growing chain of release notes.

- 0.293.0 extends preview localisation into post creation, profile editing, community-board guidance, marketplace listing forms and the wallet transaction-history label. Native approval requires reviewer, timestamp, catalog-version match and product-owner approval. All four Nigerian language packs remain pending; user-authored content and financial data remain unchanged.


- 0.294.0 Phase 7 extends partial preview localisation to notification-centre chrome and GH Pulse short-video controls/states. Locale-aware strings do not rewrite notification payloads, user-generated content, captions, profile names, financial values or payment states. Catalog version 4 must be reviewed before approval; all Nigerian preview packs remain pending native-speaker and product-owner review.

- 0.295.0 Phase 8 adds locale-aware presentation helpers through regional context. Display formatting must never be used to parse, persist, calculate or reconcile wallet/economy values; canonical numeric values and ISO currency codes remain authoritative. Translation catalog version 5 requires renewed review before any locale approval.

- 0.296.0 Phase 9 adds keyboard-first skip navigation translated across the four preview language packs, RTL-safe logical styling primitives, bidirectional isolation for notification counts, and high-contrast/forced-colors support. Catalog version 6 is pending renewed native-speaker and product-owner review.

- 0.297.0 Phase 10 adds shared accessible live-status semantics, localized main landmark and section announcements, minimum interactive target sizing, consistent focus visibility, reduced-motion handling and forced-colors error affordances. Catalog version 7 is pending renewed native-speaker and product-owner review.


- 0.298.0 Phase 12 hardens locale preference continuity when embedded-browser storage is unavailable, synchronizes cross-tab/reset behavior, and adds defensive Intl unit/plural fallbacks. Preview translations remain pending review; user content and financial semantics remain unchanged.

- 0.300.0 Phase 13 simplifies the Stories rail, adds full-size profile and cover previews, and resolves private Story media through viewer authorization. No database, wallet, Pi, GHC, or payment contracts changed.

- 0.300.0 Phase 14 adds full-screen pre-publish image previews, inline video preview and viewer-authorized Story media previews. Existing upload/publish ownership and all database, authentication, wallet, Pi, GHC and payment contracts remain unchanged.


- 0.301.0 Phase 15 refines the feed entry and discovery presentation: the composer has one primary text entry plus photo/video shortcuts; between-post discovery prompts are less frequent and do not interrupt focus mode or other feed filters. The canonical creator and server-owned feed pipeline are preserved. No database, authentication, wallet, Pi, GHC or financial contracts changed.

- 0.302.0 Phase 16 improves comment attachment viewing, loading feedback and dialog accessibility. Image/video viewing is distinct from downloading; comment/reaction/share and media authorization contracts remain unchanged. No database, wallet, Pi, GHC or financial changes.


- 0.304.0 Phase 18 routes dynamic user-generated image/video surfaces through shared session-aware media primitives, binds the in-memory private-media signed-URL cache to the active identity epoch, and invalidates mounted media on account/session changes. Privacy settings now expose an owner-facing JSON export download and a strongly confirmed deletion-request intake. Export and deletion remain protected by server-side recent step-up; deletion is a review workflow, not immediate erasure. No database migration, wallet, GHC, Pi, payment or settlement behavior changed.


- 0.305.0 Phase 19 strengthens creator-economy integrity: tip idempotency is scoped to a single client action (same key recovers the original intent; a fresh key permits a later tip), while legacy clients retain deterministic retry behavior. Creator Studio now distinguishes incomplete source reads from verified zero values, rejects malformed upstream collections, reports independent source completeness, and skips post-reward aggregation when the authoritative post list is unavailable. No database migration or wallet, GHC, Pi, payment, payout or settlement contract changed.


- 0.306.0 Phase 20 strengthens seller payout abuse controls: payout request/history, bank beneficiary, bank account resolution, bank directory, provider execution, PI/GHC/bank reconciliation, and operator transition/exception routes use the shared durable security control plane with fail-closed behavior when durable storage is unavailable. This does not alter payout eligibility, provider verification, treasury authority, settlement RPCs, payout states, or the GHC/PI separation. No migration was added.


## Current marketplace transaction boundary — 0.309.0

Durable marketplace order status transitions must go through `gh_marketplace_order_transition`; do not reintroduce application-side read/modify/upsert for durable orders. The RPC serializes state transitions with a row lock and is service-role only. It is not a payment, refund, escrow, payout or wallet settlement function. All payment verification still requires the existing authoritative payment flow and ledger/provider evidence. The new migration is review-required and must be reconciled against each target database before application.


## Phase 23 migration safety note
Order snapshot reads no longer perform global reservation cleanup inside row-locked transition transactions. The application performs cleanup as a separate, fail-closed RPC before ordinary order reads. The new migration is review-only until disposable PostgreSQL and target Testnet history/concurrency validation are complete.

- Phase 27: current scroll-immersion behavior and modal-based creator analytics are documented in the 0.312.0 release worklog.

- Phase 5 Discovery (0.316.0): batch-prepared ranking indexes, deterministic duplicate suppression and accessible profile/follow actions. No migration or financial authority change.
- Phase 6 Profile and Identity (0.318.0): per-domain cached relationship indexes, independently invalidated derived sets, deduplicated batch hydration in Discovery people cards and preserved block-first safety. No migration or financial authority change.
- Phase 7 Wallet (0.320.0): abortable/time-bounded Pi withdrawable-snapshot read, strict response/value/identity validation and stale-state clearing. No consent, quote, withdrawal execution, GHC ledger or provider authority change.


- Phase 7 Wallet source implementation is closed in 0.320.0; Node 24.15.x build, browser/device and live Pi Testnet acceptance remain release blockers.
- Phase 8 Rewards (0.323.0): source implementation closed with seven server-verified, idempotent non-financial mission achievements, bounded account-scoped hydration, authenticated GHC ledger history/search/filtering, daily claim integrity and protection gates. Mission GHC issuance remains disabled. The additive verifier migration is REVIEW_REQUIRED and unapplied; Node 24, Testnet, browser/device and operator acceptance remain mandatory. Phase 9 Membership subsequently began in 0.325.0; see the current Phase 9 foundation entry below.


- Phase 8 Rewards (0.323.0): source implementation closed with authenticated durable mission verification and idempotent non-financial achievement unlocks, daily claim integrity, cross-device GHC ledger history and protection gates. The mission migration is REVIEW_REQUIRED and unapplied; generic GHC activity issuance remains disabled. Node 24.15.x, Testnet/database, browser/device and operator acceptance remain required. Phase 9 Membership subsequently began in 0.325.0; see the current Phase 9 foundation entry below.


- Phase 9 Membership foundation (0.325.0): strict server entitlement parsing and paid-expiry validation, bounded authoritative reads, conflict-safe plan selection and preserved GHC/Pi payment boundaries. No migration or financial execution authority changed; Phase 9 remains active and external acceptance is pending.


- Phase 9 Membership (0.327.0): server-authoritative tier gating before protected GHC spends; membership lifecycle history; catalog-bound, idempotent PI renewal with SQL-derived calendar duration; 72-hour continuity-only renewal boundary; and operator-only expiry sweep. Prepaid membership has no auto-renew or recurring charge. The new migration is REVIEW_REQUIRED and unapplied; runtime/database/Testnet/browser/device/operator acceptance is pending.


## Phase 9 current increment (0.327.0)

Use `docs/PHASE-9-MEMBERSHIP-PI-INTENT-SECURITY-0.327.0.md` as the current Membership payment-rail change record. All completed-payment membership grant/recovery paths require exact Pi provider, PI currency, membership purpose, non-empty provider payment ID and completed/fulfilled status. Production Pi grants use the row-locked idempotent renewal RPC with authoritative post-write confirmation; pending entitlements return retryable 503 responses. Both utility-spend routes fail closed for boost/tool effects until durable activation exists. The follow-up SQL migration remains REVIEW_REQUIRED and unapplied.

## Phase 10 current increment (0.330.1)

Use `docs/PHASE-10-NAVIGATION-MEDIA-RELIABILITY-0.330.1.md` for the current increment. Settings security, compliance, Pi capability, passkey and account-data subsections are lazy-loaded. Generic image URL mutation is removed to preserve signed storage/CDN URLs and private media facade identifiers; pagination locks span the complete asynchronous load; older embedded WebViews without IntersectionObserver receive visible content. The 0.329.0 public-static service-worker policy and reduced-data prefetch controls remain in force. No financial authority or migration behavior changes. Phase 9 Membership source implementation is complete; external acceptance remains open.


## Phase 10 current increment (0.330.1)

Service-worker caching is restricted to explicitly allowlisted public static assets. Navigations, authenticated documents, Next.js RSC responses, all API paths and private media remain network-only. Feed and Story speculative media loading now observes device/browser reduced-data signals, rechecks before execution and enforces small limits. Offline reconnect feedback timer cleanup is covered. Executable policy tests and static resilience checks are wired into prebuild and static verification. Phase 9 Membership remains source-complete but awaits external acceptance.

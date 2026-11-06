# CURRENT BUILD CONTEXT — GREENHAVEN / GH CONNECT

**Canonical implementation context. Read this before every new build prompt or engineering task.**

## CURRENT BUILD CONTEXT

- Current source release: **0.330.1**.
- Current baseline: the complete repository root in release 0.323.0 as upgraded through 0.330.0; this latest complete project tree supersedes older archives, worklogs, mock-ups and copied third-party screens.
- Product: GreenHaven ecosystem and GH Connect social platform. Keep the existing product identity, routes, data contracts and security boundaries unless a reviewed implementation explicitly changes them.
- Visual direction: premium, modern, calm and accessible; deep emerald / teal / navy with restrained gold accents; light-mode-first. Screenshots are design references, not sources of banking features, balances, licenses, logos or provider capabilities.
- Wallet: GHC and Pi are separate assets and separate ledgers. Never add them together, convert one into the other for display, fabricate balances, or treat local cache as financial authority. Server-confirmed balances must be clearly distinguished from stale, pending, locked and unavailable data.
- Financial authority: server-side APIs, database RPCs and existing ledger/settlement authorities. Never add client-side minting, transfers, payout execution, refunds, escrow release, treasury movement or payment completion.
- Security: preserve session identity, ownership, step-up, idempotency, rate limits, RLS, service-role boundaries and fail-closed behavior.
- Database: do not apply migrations from source review alone. Reconcile target history, classify, inspect dependencies and obtain approval before applying held migrations.

## PHASE 8 REWARDS SOURCE COMPLETION (0.323.0)

- 0.319.0: Added an editable owner and public read-only professional/business identity showcase with services, skills, experience and selected portfolio items.
- Portfolio links are HTTPS-only and reject URL credentials.
- Added authenticated, account-scoped achievement hydration with request cancellation and duplicate suppression. Achievement unlock remains server-only.
- Public professional interests now participate in explainable discovery relevance.
- 0.320.0: Pi withdrawable-snapshot hydration now aborts on sheet close/unmount, times out after eight seconds, clears prior-session values and accepts only explicit successful responses with finite non-negative values and validated linked identity. This is a read-only snapshot improvement; Pi consent, quote, withdrawal execution, GHC ledger, payout, checkout and settlement authorities remain unchanged.
- Phase 7 Wallet source implementation is closed in 0.320.0. Its Node 24.15.x typecheck/lint/build, browser/device acceptance and live Pi Testnet reconciliation remain explicit production release blockers; Mainnet execution remains gated.
- 0.321.0–0.322.0 established bounded account-scoped Rewards snapshots, strict server amount parsing, honest claim states and authenticated same-user GHC ledger history with search/status filters. Local activity remains supplemental, never ledger authority.
- 0.323.0 completes the Rewards source implementation: seven mission types are verified against durable server records inside a service-role-only SQL function; achievements unlock idempotently using advisory locking and the canonical unique key. The route uses authenticated identity, bounded JSON and durable fail-closed rate limiting. Mission completion unlocks non-financial achievements only; generic GHC activity issuance remains disabled by policy.
- The additive migration `20261106170001_phase8_verified_mission_achievements.sql` is REVIEW_REQUIRED and has not been applied. Phase 8 source implementation is closed, but Testnet migration validation, Node 24.15.x build gates, browser/device and operator acceptance remain required before production approval.
- Product roadmap and phase boundaries are recorded in `docs/PRODUCT-ROADMAP.md`.
- No database migration was applied; no GHC mission issuance, Pi payout, wallet or settlement authority changed.
- Phase 8 contracts include `scripts/check-phase8-verified-missions.mjs`, `scripts/check-phase8-rewards-entry.mjs`, `scripts/check-phase8-rewards-history.mjs` and `scripts/check-phase8-rewards-release-gate.mjs`. Phase 9 Membership source implementation is complete in 0.327.0; its external acceptance gates remain open.

## ACTIVE IMPLEMENTATION TRACK

- Phase 1 (0.315.6): posting, voting, curation and community-board foundation. Community posts now hydrate from the canonical social ledger and reuse the Feed/Profile post card. See `docs/PHASE-1-SOCIAL-FOUNDATION-0.315.5.md` and `docs/PHASE-1-DEEP-COMPLETION-0.315.6.md`.
- Curation-intelligence recovery, community-post feed, and Phase 1 guard-reconciliation migrations are REVIEW_REQUIRED; do not apply without independent remote-history reconciliation and disposable PostgreSQL/Testnet evidence.
- Phase 2 (0.315.7): Stories experience and privacy/read-path hardening. See `docs/PHASE-2-STORIES-PREMIUM-REBUILD-0.315.7.md`. Creator-grouped sequences, account-scoped seen preferences, durable viewer-state hydration, playback controls and an additive audience-authorization migration are included. Migration remains REVIEW_REQUIRED pending disposable PostgreSQL and remote-history validation.
- Phase 3 (0.315.8): Marketplace discovery, product presentation, seller workflow and durable listing-report intake. See `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`. Its new SQL migration remains REVIEW_REQUIRED.
- Phase 4 (0.315.9): Cart/Checkout cache integrity, cross-tab synchronization, in-flight interaction locking and selective cleanup of reserved lines. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`. No migration or financial authority change.
- Phase 5 (0.316.0): Discovery ranking now prepares normalized relationship/interest indexes once per batch, uses a consistent recency clock, suppresses duplicate identities, and provides accessible independent profile/follow controls. No migration or financial authority change; runtime/build acceptance remains open.
- Phase 6 (0.319.0): Profile and Identity now derive reusable relationship indexes from canonical social arrays, invalidate each derived set independently on immutable array replacement, and batch-hydrate unique profile IDs from one snapshot; Discovery people cards consume the prepared batch results. Block-first safety and private financial-data boundaries remain unchanged. No migration or financial authority change.
- Phase 4 (0.315.9): Cart/Checkout cache integrity, cross-tab synchronization, checkout interaction locking and selective cleanup of successfully reserved lines. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`. No migration or financial-authority change.
- Product source phases 1–8 are implemented. Phase 7 Wallet and Phase 8 Rewards source closures are recorded in the approved roadmap; their external acceptance gates remain open. Phase 9 Membership source implementation is complete in 0.327.0; its external acceptance gates remain open. Phase 10 Settings/platform performance is active in 0.330.0, now includes device capability diagnostics, device-local reduced-data controls, bounded/deduplicated async memoization, privacy-safe static caching, adaptive media prefetch, Settings code splitting, signed-media URL preservation, async pagination locking and legacy WebView fallbacks. External acceptance remains open.
- Current roadmap position: Phase 7 Wallet source implementation closed (external acceptance pending); Phase 8 Rewards source implementation closed in 0.323.0 (migration/Testnet and runtime acceptance pending); Phase 9 Membership source implementation is complete (external acceptance pending); Phase 10 Settings/platform performance is active in 0.330.0, now includes device capability diagnostics, device-local reduced-data controls, bounded/deduplicated async memoization, privacy-safe static caching, adaptive media prefetch, Settings code splitting, signed-media URL preservation, async pagination locking and legacy WebView fallbacks. External acceptance remains open. Track source delivery separately from Testnet/Mainnet and browser/device acceptance.

## DOCUMENT PRECEDENCE

1. Current executable source and current database migration files.
2. `package.json`, `package-lock.json`, `.nvmrc` and deployment configuration.
3. `docs/CURRENT_BUILD_CONTEXT.md` for current product and engineering constraints.
4. `docs/PROJECT_TRUTH.md` and `docs/SOURCE_OF_TRUTH.md` for release facts and verification boundaries.
5. The current release worklog and the feature-specific current audit.
6. All older versioned worklogs, old prompt notes, archived docs, screenshots and videos are **historical context only**. They do not authorize restoring old behavior or supersede current source.

## BUILD RULES

- Start from the latest complete repository ZIP/source tree only.
- Inspect actual implementation before proposing or editing; avoid duplicate components, routes, RPCs, tables, migrations and settlement authorities.
- Prefer extending existing domain boundaries over creating parallel systems.
- Preserve existing design language while making purposeful product-level improvements.
- Do not delete migrations, audit evidence, legal/compliance records or historical release fixtures to make the repository look newer. Archive genuinely obsolete operator material only after checking references and regression gates.
- Every change needs a targeted regression check and must be registered in `prebuild` and `verify:static` where appropriate.
- Report exactly what was changed, what passed, what did not run, and what still requires live infrastructure. Never call source checks production acceptance.

## CURRENT WALLET CHANGE (0.313.1)

The wallet now has bounded server-summary and Pi earnings reads, latest-request-wins cancellation, timeout cleanup and explicit unavailable feedback. The premium wallet hero displays one selected asset rail at a time and only calls GHC balance server-confirmed when the validated snapshot is server-sourced. No financial mutation path or SQL migration is added in this phase.


## PI PAYOUT AUTHORIZATION CHANGE (0.313.1)

- Explicit user consent is required before a Pi earnings withdrawal request is reserved and is independently rechecked by the A2U execution worker immediately before transfer.
- The wallet UI confirms authorization using a fresh server read and requires the active authorization to match the linked Pi app UID.
- Authorization failures expose safe HTTP/error codes; server diagnostics never log service-role credentials or raw upstream SQL messages.
- Keep `PI_A2U_ENABLED`, `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED`, and `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED` operator-controlled. Mainnet remains disabled. No migration is applied by source review.

## CURRENT EXPERIENCE CHANGE (0.313.1)
- Bottom navigation collapses completely during upward feed scrolling and reappears when the user scrolls downward; the scroll owner is resolved from nested scroll surfaces.
- Curation analytics are opened as an accessible modal sheet and fetched on demand with timeout, cancellation and stale-response protection.
- Do not restore the old inline accordion or fetch analytics on every post card mount.


## PHASE 9 MEMBERSHIP FOUNDATION (0.325.0)

- Phase 8 Rewards source implementation remains closed in 0.323.0; its migration/Testnet and external acceptance remain outstanding.
- Phase 9 is active. Release 0.325.0 adds strict server entitlement-row parsing, identity/tier/source/period/timestamp validation, rejects missing/malformed paid expiry except explicitly complimentary membership, normalizes expired/inactive paid records to Free, bounds authoritative DB and client status reads, and rejects conflicting duration aliases before purchase.
- Existing catalog-derived GHC pricing, durable completed Pi intent, exact product binding and authenticated ownership remain unchanged. GHC and Pi remain separate. No migration or financial execution authority changed.
- Next: premium membership home/tier comparison, entitlement-driven feature gates, payment lifecycle visibility/recovery, renewal/expiry lifecycle and operational reconciliation.
- Phase 9 source foundation is not production approval; Node 24.15.x build, browser/device, Testnet/database and operator acceptance remain required.


## PHASE 9 MEMBERSHIP LIFECYCLE AND ACCESS CONTROL (0.326.0)

- Premium Membership Home now renders active status from the authoritative server response only and displays authenticated read-only lifecycle events. Lifecycle read failures do not alter entitlement state.
- `checkMembershipTierAccess` is the server-only membership gate; the messaging premium purchase route checks catalog `requiresTier` before any GHC spend. Client `hasEntitlement` remains a presentation hint only.
- Renewal workflow now loads the durable payment intent, verifies owner/provider/currency/purpose/completion/catalog product/catalog amount, and does not accept client duration or period. The new SQL RPC derives the paid duration plus bonus month from the canonical product ID and serializes idempotent renewals.
- A 72-hour continuity-only renewal window preserves the previous prepaid term boundary but never grants access after expiry. Membership is prepaid and non-recurring; no auto-renew or recurring charge exists to cancel.
- Added authenticated read-only lifecycle history and operator-key-protected bounded expiry sweep. Migration `20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql` is REVIEW_REQUIRED and unapplied.
- Static and runtime source checks are registered in `prebuild` and `verify:static`. Node 24.15.x, dependencies, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain outstanding.


## PHASE 9 MEMBERSHIP PAYMENT-RAIL INTEGRITY (0.327.0)

- Membership grant and recovery paths now require exact durable `provider=pi`, `currency=PI`, `purpose=membership`, a non-empty `providerPaymentId`, and COMPLETED/FULFILLED status. Missing discriminators cannot be inferred from metadata or amount.
- Payment completion, fulfillment and recovery callers forward the provider discriminator; all production Pi grants use the row-locked, idempotent renewal RPC and are re-read before success. Payment completion/fulfillment returns retryable 503 when payment is complete but entitlement is pending; no generic upsert fallback exists.
- Premium consumer audit confirms messaging tier checks before debit and both generic/dedicated utility spend routes block boost/creator/community effects until durable activation exists.
- SQL renewal follow-up `20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql` is REVIEW_REQUIRED and unapplied.
- Contracts: `scripts/check-phase9-pi-intent-security.mjs` and `scripts/test-phase9-pi-intent-contract.mjs` are registered in `prebuild` and `verify:static`.
- No live database, Pi payment, GHC spend or Mainnet operation was performed. Node 24.15.x build and external acceptance remain pending.

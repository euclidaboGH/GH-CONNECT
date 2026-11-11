# GreenHaven / GH-CONNECT — Source of Truth

**Current source baseline archive:** `GREENHAVEN-0.338.55-RUN292-MOBILE-WALLET-AUDIT.zip`
**Current working candidate:** `0.338.55`
**Current source version:** `0.338.55`
**Package identity:** `gh-connect@0.338.55`
**Active development branch:** not yet created; GitHub branch creation returned HTTP 403 (`Resource not accessible by integration`). No remote refs or commits were changed. The 0.338.54 source bundle is available for review/import.

## Current implementation authority — 0.338.55 / Run #292

Run #292 adds a mobile-first content recovery pass for Marketplace, Communities, Discovery and Messages, reducing oversized header/summary height while preserving controls and domain behavior. Live Testnet inspection confirms `gh_pi_wallet_authorization_confirm_provider_address(text,text,text,text)` is absent and its source migration is not recorded in the inspected history. The migration also changes payout and wallet authorization schema and must not be applied in isolation while the source/live migration sequence is unreconciled. Three uncertain requests totalling 3.00 π remain reserved; no release, settlement, retry or replacement payment was made. No live migration or production deployment was performed. Node 24.15.0 build and visual acceptance remain pending.

## Historical implementation authority — 0.338.40

Run #278 adds a complete server-backed direct-call transport: authenticated call configuration, short-lived TURN REST credentials, canonical call start/transition/signal RPC routes, incoming-call polling, WebRTC offer/answer/ICE exchange, remote media binding, microphone/camera controls, call teardown and bounded timeout recovery. Calls remain fail-closed until the operator configures TURN URLs/shared secret and explicitly enables `GH_CALLS_ENABLED`; no client-side secret or fake connected state is used. Discovery now uses the canonical privacy-aware `gh_discovery_candidates` RPC with bounded search and keyset pagination. Discovery, follow, match and inbox reads use durable fail-closed rate limiting; connection mutation throttling fails closed. Three latest call migrations were restored verbatim from active Testnet migration history into source files; 16 additional applied Testnet social/call migration records remain absent from this archive and must be reconciled before any clean-database rehearsal or migration push. The Vercel project build command was synchronized to run `scripts/prepare-vercel-build.mjs` before `next build`, correcting the dashboard override that bypassed stale Webpack cache cleanup and caused OOM/SIGKILL. Run #278 communications regression gate passes 31/31; full Node 24 dependency install/typecheck/lint/production build, TURN configuration, two-account call acceptance and migration-history restoration remain outstanding. No Supabase migration was applied in this run. See `docs/UPGRADE-WORKLOG-0.338.40.md` and `docs/RUN278-SUPABASE-SOURCE-DRIFT-2026-11-11.md`.

The current source archive is `GREENHAVEN-0.338.39-RUN278-RELEASE-RESERVED-30.zip`; this derived 0.338.40 working tree supersedes it for implementation only after review. Earlier archives are historical and must not replace the 0.338.39 baseline.

## Current implementation authority — 0.338.33

Run #272 advances Run #271 with 30 Feed/Profile/post-card/comment-thread improvements: canonical identity subscriptions, account-scoped feed preferences/hidden-post/draft state and identity-fenced saved-post hydration; shared feed-state clearing on owner changes; reduced-data and online-aware feed work; safe profile timeline identity transitions, abortable/locked pagination and safe errors; durable profile-media update/remove confirmation; blocked comment-descendant filtering; and deterministic cycle-safe comment trees. Testnet migration `20261110193134_social_feed_profile_rpc_search_path_hardening` pins the two remaining active social read RPC search paths while preserving service-role-only grants. Vercel build cleanup now removes stale oversized Webpack cache packs and disables persistent production Webpack caching. The latest Vercel failure was confirmed as OOM/SIGKILL during Next.js production compilation; this source fix has not yet been deployed. Testnet has 19 generated migration records versus 216 canonical source files; do not bulk apply, repair or replay history. Mainnet remains untouched; production remains NOT APPROVED. See `docs/RUN272-FEED-PROFILE-30-POINT-AUDIT.md`.

Run #261 is the historical working source increment (0.338.27), derived from the user's authoritative 0.338.23 archive through 0.338.26. It adds an operator-only Testnet A2U qualification register for five distinct fully KYC-passed Pioneer recipients and provider-verified, developer-completed A2U payments. KYC is an operator attestation based on the official Pi KYC app because this integration has no verified KYC status endpoint; only non-sensitive evidence references are stored. The qualification migration is REVIEW_REQUIRED and unapplied; no actual A2U qualification transaction is claimed. It addresses the live Pi earnings withdrawal incident with stage-specific, sanitized Pi Platform diagnostics; a direct read-only incomplete-A2U lookup (the official SDK masks those errors as `unknown_error`); a one-active-withdrawal-per-user database guard; and a Pi `wallet_address` scope binding tied to the same server-verified app-specific Pi UID, with a mandatory comparison against Pi PaymentDTO `to_address` before submission and settlement. The Wallet UI masks the address by default and supports explicit copy. Its additive migration `20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql` is REVIEW_REQUIRED and unapplied; it must be reviewed and applied to Testnet only after the new source is deployed and target history reconciled. The current Vercel Testnet Preview deployment is 0.338.25, READY, commit `237070b2817680933b82994ca72737bd1e90d505`; its live payout request still returned 503 `PI_PROVIDER_OUTCOME_UNCERTAIN`. Three user requests remain uncertain/reserved without provider payment IDs or txids. Mainnet is untouched. Production remains NOT APPROVED.

The current working source baseline is `GREENHAVEN-0.338.33-RUN272-FEED-PROFILE-30-POINT-UPGRADE.zip`. Run #272 extends Run #271 with account-safe feed/profile state, comment-tree moderation and cycle handling, safe profile-media persistence, a Testnet-only social RPC search-path hardening migration, and Vercel Webpack cache/OOM mitigation. The Testnet migration is `20261110193134`; generated history now has 19 records against 216 canonical source migrations. Do not bulk apply, repair or replay history. Mainnet remains untouched; Run #272 has not been built by Vercel. Full Node 24.15.0 build, browser/device acceptance and migration reconciliation remain outstanding; production NOT APPROVED.

Run #271 historical baseline: `GREENHAVEN-0.338.32-RUN271-POST-COMPOSER-STORIES-30-POINT-UPGRADE.zip`. It advanced Run #270 / 0.338.31; Run #272 is the current implementation authority above. Run #256 adds durable operator review for unrelated incomplete Pi A2U payments, read-only Testnet provider inspection in the operator treasury summary, sanitized execution diagnostics, and clearer user messaging. Run #257 adds marketplace reservation/payment/fulfilment source contracts and the live Testnet economy/marketplace reconciliation snapshot. Neither run bypasses Pi's single incomplete-payment sequencing rule, cancels an unrelated payment, marks a payout paid, releases a reservation, or enables Mainnet. The controlling Testnet reconciliation and remaining financial/provider gates are in `docs/TESTNET-RECONCILIATION-2026-11-10.md` and `docs/PI-EARNINGS-WITHDRAWAL-INCIDENT-2026-11-10.md`.


## 2026-11-09 responsive experience and navigation refinement (0.338.9)

- Reduced the shared expanded/compact application header height and removed duplicated compact subtitle text. Inactive compact and collapsed expanded header controls are inert so hidden duplicate actions cannot retain keyboard focus.
- Refined Marketplace browse/detail header rhythm and increased responsive content gutters, section breathing room and safe-area bottom clearance for Marketplace and Community surfaces. Existing responsive listing breakpoints and currency-safe filtering remain intact.
- Replaced inline-style-dependent active-tab scroll reset with explicit `data-gh-tab-panel` identity and computed scroll-owner detection. The six inactive primary-tab panels remain inert and the bottom navigation retains its accessible current-page state and safe-area touch targets.
- Hardened `/` and `c` shortcuts against editable fields, modal workflows, modifier keys, repeated keys and IME composition. Search focus no longer forces an unexpected page scroll.
- Added `scripts/check-ui-navigation-responsive-audit-20261109.mjs` with 31 source-level UI/navigation/responsive assertions, registered in both prebuild and static verification. The earlier independent Marketplace/Community API audit remains 42/42 controls (22 Marketplace + 20 Community); these are control assertions, not 42 newly fixed defects.
- No database migrations, ledger authority, payment execution, inventory authority, payout behavior or provider configuration changed. Node 24.15.0 typecheck/build, browser/device visual acceptance, live PostgreSQL/Supabase and Testnet verification remain outstanding; production remains NOT APPROVED. See `docs/UI-NAVIGATION-RESPONSIVE-AUDIT-2026-11-09.md`.

## 2026-11-09 independent marketplace, community and financial follow-up (0.338.9)

- Marketplace and community API audit adds 42 independent source-contract assertions (22 Marketplace, 20 Communities). Marketplace order creation and saved-listing read/write routes now use durable fail-closed user mutation limits rather than instance-local in-memory counters; saved-listing RPC transport has an eight-second timeout. Community create/join/leave, role changes, join-request decisions, platform moderation and chat mutations now use durable fail-closed throttling; moderation decision input must be an explicit boolean; community, target-member and applicant identifiers are bounded/sanitized.
- No SQL migration was added or applied. Existing marketplace payment authority, GHC/Pi separation, idempotent checkout, server-derived order totals, durable inventory reservation, delivery-gated buyer confirmation, participant-only timeline, and seller commission/reconciliation boundaries are preserved. Community membership and governance remain server-RPC authoritative.
- Targeted marketplace/community static contracts and runtime parser/mapper/cart/discovery tests are documented in `docs/INDEPENDENT-MARKETPLACE-COMMUNITY-FINANCIAL-AUDIT-2026-11-09.md`. These checks do not prove PostgreSQL concurrency, live provider settlement, RLS deployment, browser/device behavior or production readiness.
- Typecheck remains BLOCKED in this environment: the project requires Node `24.15.0`, but the available runtime is `22.16.0`; dependency installation timed out and required type packages are incomplete. Do not claim a successful TypeScript check or production build until the supported runtime and full lockfile install are available.

## Run #265 — isolated Pi earnings payout recovery simulation

- Added `scripts/test-run265-payout-recovery-simulation.mjs`, a deterministic in-memory test fixture for payout reservation, exact provider reconciliation, safe release, verified settlement and idempotent retries. It makes no Pi SDK/network/Supabase calls and does not touch any live wallet or ledger.
- The fixture asserts that an uncertain payout with an execution attempt can never be released merely because a lookup is empty; recovery requires an exact provider/request/UID/amount/network match; settlement requires a verified and developer-completed receipt with destination confirmation; duplicate release/settlement cannot append a second ledger effect.
- The 13 scenario tests are registered in `test:pi-earnings-recovery-simulation`, `prebuild:checks`, and `verify:static`.
- This is simulation coverage, not a live provider acceptance test and not a change to the live three uncertain reservations.
- The wallet-address migration remains unapplied until Run #264 source is deployed and the target migration history is reconciled. The separate Run #261 A2U qualification migration is not required for withdrawals and remains unapplied; it requires its own operator/KYC review.

## Run #264 — Pi Browser and wallet-consent reliability follow-up

Run #264 is a source-level follow-up to Run #263 / 0.338.27. It recognizes Pi Browser from the user-agent before `window.Pi` is injected, uses the shared single-flight Pi SDK initializer for initial authentication, and prevents a slow initial handshake from being mislabeled as an unsupported browser. Browser detection is never authentication evidence.

Wallet consent now permits a fresh Pi access token to be verified by the server even when the SDK response omits `user.wallet_address`; a valid address returned by Pi Platform `/v2/me` is the only fallback. If both sources provide an address, they must match. If neither source provides a valid address, authorization remains blocked. The checkbox has a 24px control and a minimum 48px clickable row.

The Testnet wallet-address migration remains REVIEW_REQUIRED and unapplied until the new source is deployed and target migration history reconciled. No uncertain payout, reservation, wallet balance, ledger row, or Mainnet data is changed. Pi Browser device acceptance and the full Node 24.15.0 build remain release gates; production is NOT APPROVED.

## Run #266 — unified social post experience (0.338.28)

- Feed, Profile and canonical Community posts explicitly identify their rendering surface while continuing to share `EnhancedPostCard`; the legacy `PostCard` remains outside these canonical surfaces for compatibility only.
- The canonical post surface now uses semantic `<article>` markup, consistent responsive author metadata, clearer content rhythm and media framing, and a pointer cursor only where opening the post is actually supported. Existing media URL validation, safe linked-text rendering, visibility rules, moderation actions and post APIs remain unchanged.
- The engagement dock now separates quality votes from the primary Comment / Save / Share actions. On narrow phones the three primary actions use a predictable equal-width row with readable labels and minimum 44px targets; on larger screens they remain a compact right-aligned action group.
- Share feedback now reports that share options opened rather than claiming the content was sent. The single `UnifiedCompose` implementation remains the only post composer.
- Added `scripts/check-run266-social-post-experience.mjs` with 14 source-contract assertions, registered in `prebuild:checks` and `verify:static`. Changed TSX files passed TypeScript transpilation/syntax checks. Full Node 24.15.0 dependency-backed typecheck, lint, production build and browser/device/screen-reader/two-account acceptance remain outstanding. No database migration, social API contract, ledger, token reward, or financial behavior changed. Production remains NOT APPROVED.

## Run #270 — Community, group, chat and platform maintenance (0.338.31)

Run #270 upgrades the Community surface and its related API/database boundaries. The community directory card is now semantic and keyboard-operable without nested interactive controls; per-card minute timers were removed and activity labels use the viewer locale. The shared collapsing header uses a native header element instead of a nested banner landmark; hidden duplicate controls and the global bottom navigation retain inert, safe-area, active-page and scroll hide/reveal behavior. Community chat now requires an authoritative active chat membership, not just ordinary community membership. Chat state is cleared while revalidating and stale responses are fenced. Chat GET/POST, community post reads and community platform writes now validate IDs, action/decision enums, text sizes, date ordering, HTTPS URLs, report payloads and member targets before privileged RPC calls.

On active GH Connect Testnet only, migration `20261110182120_community_chat_membership_revocation_and_reconciliation.sql` was applied under generated history version `20261110182120`. It serializes community membership transitions, atomically revokes the separate conversation membership on leave/removal/ban, cancels or declines pending/approved chat requests, requires active community membership in the chat-state RPC, and reconciles stale active community-chat grants. The preflight found one stale active chat membership without an active community membership; postflight confirms zero. Conversation/message history was preserved. Mainnet and Vercel production settings were not changed.

The original source migration `20261108120001_gh_community_server_filter_search.sql` remains a historical REVIEW_REQUIRED entry; equivalent public-search RPC/index logic is installed on Testnet through Run #270 migration `20261110183004` and smoke-tested for server-side filtering/pagination. Testnet now has 15 generated history records versus 212 canonical source migrations. Do not run `supabase db push`, repair history or bulk replay until a full source/remote reconciliation is completed. The latest Vercel Testnet deployment still builds old GitHub commit `14112a3a9a16ee345f42750de3dcf2fe9f1769c3` with package `0.338.29` and fails at the stale visual-cohesion check; Run #270 source has not been pushed/deployed. Node 24.15.0 typecheck/lint/build, real two-account chat-revocation/rejoin tests, browser/device acceptance and successful preview deployment remain open. Production NOT APPROVED.

## Run #269 — 30-point audit, Testnet ACL hardening and prebuild repair (0.338.30)

Run #269 applies the corrected Run #268 archive as the source baseline. It repairs the stale prebuild visual-cohesion and social-loop assertions, mirrors both in `verify:static`, makes the Run #267 release contract version-aware, and adds an ACL regression gate. On active GH Connect Testnet only, migration `20261110174922_revoke_client_table_write_and_sequence_privileges.sql` removes direct table mutation/DDL-adjacent privileges from `anon` and `authenticated` across the public schema, removes client sequence privileges, and removes postgres-owned default grants for future public tables/sequences. Postflight confirms zero client write privileges on all 140 public tables and zero client privileges on all nine public sequences; existing SELECT/RLS and service-role access are preserved. No business data or financial records changed. The Testnet Vercel prebuild failures were stale source assertions, not a current OOM; a new successful preview build is still required. Mainnet remains inactive and untouched; the production Vercel project maps to that inactive Mainnet project and must not be promoted or unpaused without explicit operator approval. Three uncertain payout requests and two APPROVED membership intents remain blocked on provider evidence. At the end of Run #269, the remote Testnet history contained 13 generated records while the source inventory contained 210 canonical files; do not bulk-apply, repair or replay migration history. Node 24.15.0 dependency-backed typecheck/lint/build, provider reconciliation, PostgreSQL rehearsal and browser/device acceptance remain open. Production NOT APPROVED.

## Run #268 — Vercel release-version gate repair (0.338.29)

The consolidated Phase 1 audit register now identifies `gh-connect@0.338.29` and Runs #250–267 as the current derivative while preserving the earlier 0.338.18 and 0.338.27 audit snapshots as historical references. This resolves the reproducible Phase 1 P1-A mismatch without weakening the gate. The targeted Phase 1–10 pack passes 20/20 and Run #267 wallet/header checks pass 12/12. The supported Node 24.15.0 full prebuild/build remains outstanding; no database, payout, provider or deployment action was performed. See `docs/RUN268-VERCEL-RELEASE-GATE-FIX.md`.

## Run #267 — compact global headers and Pi wallet-consent correction (0.338.29)

- Applied a final shared chrome layer to slim Discovery, Community, Marketplace, collapsing app headers and other section toolbars. Header titles are smaller, vertical padding is reduced, surfaces are brighter and quieter, and mobile horizontal toolbars remain scrollable with consistent keyboard focus and safe-area handling.
- Pi wallet authorization now requests only the `wallet_address` scope for the explicit wallet-consent action. Pi's app-local UID is available without a scope; the server still verifies the fresh token with Pi `/v2/me` and matches the UID against both directions of the durable GreenHaven identity mapping.
- Normalized documented `user.wallet_address` and defensive camelCase/top-level response variants in both SDK and Platform API adapters. Missing scope now explains how to review GreenHaven permissions in Pi Browser. No address can be typed or substituted; authorization remains fail-closed if Pi returns no valid address or the SDK and server disagree.
- Added `scripts/check-run267-header-wallet-auth.mjs` with 12 source-contract assertions and registered it in prebuild/static verification. Updated the Phase 28 consent contract to assert the minimal wallet scope. Existing Phase 28 checks pass 46/46 and runtime proof tests pass 13/13.
- No Supabase migration, live authorization, ledger, payout, balance, Pi transfer or Vercel deployment was performed. Pi SDK scope acceptance must still be tested in the registered Pi Browser Testnet app. Full Node 24.15.0 typecheck/lint/production build and visual device acceptance remain outstanding. Production remains NOT APPROVED.

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

- Current source release: `0.338.33`; derived from Run #271 / 0.338.32. Testnet database reconciliation is documented in `docs/TESTNET-RECONCILIATION-2026-11-10.md`. The 216-file migration inventory is source-only and does not prove full remote migration history; do not bulk-apply or replay manually applied migrations. The Pi earnings A2U path remains Testnet-only and provider-gated; unresolved global incomplete payments must be reconciled by their owning domain before another A2U transfer. Marketplace SKU variant and fulfilment migrations remain REVIEW_REQUIRED pending disposable PostgreSQL and transaction concurrency tests. Node 24.15.0 typecheck/lint/build, Pi provider receipts, marketplace end-to-end acceptance, browser/device and independent Mainnet review remain open. Production remains NOT APPROVED.
- Priority 11 remote push and privacy hardening (0.330.46): standards-based Web Push/VAPID protocol; authenticated/rate-limited subscription API; AES-256-GCM encryption for endpoint and subscription key material; cryptographic VAPID keypair validation; ciphertext-only outbox claims; generic privacy-safe notification payloads; opaque per-notification tags; and explicit provider-accepted (not device-delivered) outcome semantics. SQL proposal is not applied. Vetted sender, deployment keys, scheduled worker and real provider/device acceptance remain outstanding; remote delivery stays disabled.
- Priority 11 preferences (0.330.44): account-level in-app choices use authenticated `/api/notifications/preferences` and the existing profile-payload store; browser-alert choices are kept in a separate account + browser-device local key. Permission is an independent browser gate, not a user preference. The account endpoint uses profile read/merge/upsert, not an atomic dedicated preferences table; concurrent profile payload writes can be last-write-wins. No migration was added. Remote Web Push remains NOT CONFIGURED.
- Cross-cutting invariants remain unchanged: public identity is sourced through privacy-projected profile APIs; private wallet, membership and balance data are not exposed publicly; GHC and Pi remain separate catalog prices and payment rails; VIP/VVIP remain prepaid, non-recurring terms. Marketplace Phase 9.4 does not settle payments, release escrow, issue refunds, pay out sellers, or mutate inventory. Priority 10.2 adds account-scoped filter preferences for Communities, Rewards history and Activity; canonical date/number/category/location-range parsing; Postgres-side Marketplace category/kind/currency-specific price/date/text filters; authenticated date/status/kind/search-filtered wallet history; and a service-role-only public Community search RPC migration originally held REVIEW_REQUIRED; equivalent function/index logic is now installed on Testnet under Run #270 generated migration `20261110183004`, while the original source migration remains REVIEW_REQUIRED pending history reconciliation. The Discovery legacy FilterPanel was unused by the current screen and removed from both public barrels after a repository-wide consumer check. These filters do not change authorization or financial authority. Notification priority is presentation guidance; local caches and preferences are identity-scoped; durable notification reads remain server-authorized. The new priority model does not change push-provider guarantees.

- Historical source release reference: `0.330.32`.
- Canonical build prompt context: `docs/CURRENT_BUILD_CONTEXT.md`.

- Historical package version reference: `0.330.31`.
- Global i18n: `lib/i18n/index.ts`; locale preferences are device-persisted, formatting uses Intl, RTL is locale/script-driven, and English is the only approved UI translation bundle at this release.
- Node requirement: `^24.15.0`; `.nvmrc` is `24.15.0`.
- 0.295.0 includes partial Hausa, Igbo, Yoruba and Nigerian Pidgin preview translations across navigation, messaging inbox chrome, community discovery, marketplace navigation/search, settings discovery, feed filters/personalisation, discovery categories/offline states and home greetings. It does not claim full application translation or native-speaker approval.
- Canonical Supabase migrations: **198 SQL files** (including Phase 9.3 SKU inventory, Phase 9.4 fulfilment timeline and Phase 10.2 Community search migrations as REVIEW_REQUIRED/unapplied).
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with the canonical directory.
- The latest repository archive was corrected to place the Next.js `app/` directory at repository root after a Vercel packaging failure caused by an extra wrapper directory.
- Static/source checks can pass without proving a Node 24 production build or live Supabase/Pi/Vercel behavior.
- Migrations are not considered applied merely because they exist in the repository. The curation-intelligence recovery, Phase 1 canonical community-feed, Phase 1 guard-reconciliation, and Phase 2 story-view privacy/read-performance migrations are REVIEW_REQUIRED and need independent Testnet/Mainnet history reconciliation plus disposable PostgreSQL validation.

- Phase 3 (0.315.8): Marketplace discovery filters, currency-safe price sorting, premium listing-card information hierarchy, seller-centre inventory/status management, and authenticated durable listing-report intake. The new report migration is REVIEW_REQUIRED; no commerce/payment/financial authority changes. See `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`.
- Phase 4 (0.315.9): Cart cache validation/bounds, cross-tab synchronization, checkout interaction locking and selective cleanup after durable order reservation. No database migration or payment authority change. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`.

- Priority 11 current delivery truth (0.330.46): authenticated unified inbox is server-backed; browser alerts are local-only; account-level in-app preferences sync through the authenticated profile payload store when durable storage is configured; browser-alert choices are account + device scoped. Profile payload read/merge/upsert is not an atomic dedicated preferences store and can be last-write-wins under concurrent profile writes. Browser permission is an independent platform gate. The service worker has a privacy-safe generic receiver; subscription APIs and hardened encrypted-storage schema proposal are present, but the proposal is unapplied. VAPID keypair validation and an operator key-generation script are in source; no deployment keys, vetted `web-push` sender or dispatch worker are configured. Remote Web Push is DISABLED. Do not claim offline delivery.


## Current ten-phase completion programme

The controlling Phase 1 audit and implementation register for source release 0.338.13 is `docs/PHASE-1-CONSOLIDATED-AUDIT-AND-IMPLEMENTATION-REGISTER-2026-11-09.md`. It records current inventory counts, test evidence, blockers and phase traceability. Source checks are not live database or production certification.


## Run #262 — Vercel build memory remediation (2026-11-10)

- Vercel deployment logs for the 0.338.27 Testnet Preview builds explicitly reported an Out Of Memory event and `Next.js build worker exited ... SIGKILL` during optimized production compilation, after all 289 prebuild checks passed.
- Bound Next.js build concurrency to one worker and enabled webpack memory optimizations. TypeScript and ESLint build gates remain enabled. Added `scripts/check-run262-build-memory-budget.mjs` to enforce these constraints.
- This is a source-level mitigation; a clean Node 24.15.0 Vercel rebuild is still required to prove the OOM is resolved.

## Run #263 — Connected infrastructure hardening (2026-11-10)

See `docs/RUN263-20-ESSENTIAL-HARDENING-AUDIT.md` for the 20-control evidence register, live Vercel configuration updates, Supabase Testnet audit findings, and remaining release gates. Run #263 adds 20 source/CI assertions to the sequential prebuild suite. No Supabase schema, financial rows, provider state, or Mainnet resources were modified.

Run #285 evidence: `docs/UPGRADE-WORKLOG-0.338.49.md`, `docs/RUN284-TESTNET-MIGRATION-SOURCE-RECONCILIATION.md`, and `docs/RUN284-TESTNET-APPLIED-MIGRATIONS.json`. The live applied migration list is not interchangeable with the local migration manifest.
Run #285 30-point scope and completion states: `docs/RUN284-30-UPGRADE-REGISTER.md`.

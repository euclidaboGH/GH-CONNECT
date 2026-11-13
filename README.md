# GreenHaven

**Current source version:** `0.338.64`

Production status: **NOT APPROVED** — supported Node 24.15.0 dependency-backed typecheck/lint/build, browser/device, live database/provider and operator acceptance remain outstanding.

This repository is the canonical GreenHaven source tree. See `docs/SOURCE_OF_TRUTH.md` and `docs/CURRENT_BUILD_CONTEXT.md` before implementation or release work.

## Latest implementation — Run #299 / 0.338.64

Run #299 corrects the Profile screen to consume the canonical `useGHCProfile()` return type rather than maintaining an incompatible local cast (`updateProfile` is `Promise<boolean>`), removes the stale `no-console` ESLint suppression, and adds 20 focused build/release regression guards. No dependency versions were changed because the supplied failure is a source type-contract error, not evidence of an incompatible package. Node 24.15.0 dependency-backed typecheck/lint/build and a fresh Vercel Preview remain required. No database migration, financial/provider operation, GitHub push or deployment was performed. Production remains NOT APPROVED.

## Candidate addition — Run #297 (stale-hold release)

Automatic 24-hour release of never-started Pi earnings reservations and unsettled GHC withdrawal locks, with provider-uncertain items reported rather than released. Review-required migration, `CRON_SECRET`-protected cron route, daily Vercel cron. See `RUN297-STALE-HOLD-RELEASE-DELIVERY.md`. Unapplied; production NOT APPROVED.

## Latest implementation candidate — 0.338.56 / Run #296

Run #296 fixes incomplete onboarding/profile registration by requiring explicit, valid details, confirming every step is durably saved, uploading profile photos to durable storage, and rejecting server-side completion while any required field is missing. See `RUN296-ONBOARDING-REGISTRATION-DELIVERY.md`.


## Previous baseline — Run #292 / 0.338.55

Run #292 adds a mobile-first content recovery pass across Marketplace, Communities, Discovery and Messages, reducing oversized header and summary regions without removing controls or changing domain logic. It also records the live Testnet wallet-schema drift: a required wallet-address confirmation RPC is absent, and its source migration is not in the inspected migration history. That migration is not safe to apply in isolation because source/live migration history is unreconciled. The three uncertain Pi payouts remain reserved pending authoritative provider reconciliation. No database migration, ledger mutation, provider transfer, GitHub push or Vercel deployment was performed. Production remains NOT APPROVED; full Node 24.15.0 typecheck/lint/build and visual device acceptance remain outstanding.

Run #283 adds 55 tested helper capabilities across all 11 Active modules, fills Matching, Connections, Orders, GHC and Pi Payments feature entry points, and registers focused tests in the static/prebuild gates. The 220-target register is explicit: five helper capabilities per module are implemented in this tranche; 165 deeper UI/API/database feature targets remain. Static verification passes; Node 24.15.0 runtime/build and browser/device acceptance remain outstanding. No SQL, Testnet financial mutation, GitHub push, Vercel deployment or Mainnet operation was performed.

Run #285 continues from the uploaded 0.338.47 baseline. It adds a response-level Discovery opt-out/privacy fallback, filters blocked peers and hidden/no-one/matches-only profiles from the match inbox, and removes a duplicate direct-message POST so the domain's idempotent server send remains the single write owner. Run #285 adds 30 focused regression assertions; the full static suite passes 3,619/3,619 with zero failures. The connected Testnet audit found 39 applied migration records; only 10 exact `(version, name)` sources are present and 29 are missing or version-mismatched in this archive; no further migration was applied. Vercel's dashboard build command was synchronized with the repository cache-cleanup command after the latest deployment was OOM-killed. GitHub's `testnet` branch remains at 0.338.31 and is not safe to overwrite from this archive without a deliberate source sync. Full Node 24.15.0 typecheck/build and browser/device acceptance remain outstanding.

Derived from the 0.338.43 ecosystem candidate through Runs #279–281. Preserves all 41 ecosystem services (11 Active, 30 Coming Soon) and every release boundary. Wallet withdrawal snapshot isolation and least-privilege wallet_address consent are hardened; the obsolete non-signaling call-intent endpoint is retired. Prepared prelaunch screens now exist for Events, Charity & Impact, Services, and Creator Tools. Events discovery uses canonical community event/RSVP records with server-side public/private membership filtering; Charity displays only the authenticated user's recorded segregated contributions using exact atomic PI formatting; Services reads only durable active service listings from Marketplace; Creator Tools uses the existing creator API and shows data-source health without initiating tips or payouts. New Events and Charity APIs fail closed while their services remain Coming Soon; all four screens remain unwired into the ecosystem directory. Seller Centre functionality already exists inside Marketplace. The 41-service registry test confirms 11 Active / 30 Coming Soon across nine categories. Full static verification and the consolidated static runner pass; Node 24.15.0 dependency-backed typecheck/lint/build, browser/device acceptance and live service acceptance remain open because this workspace is on Node 22.16.0 with no dependencies installed. Live Testnet migration history is not fully reconciled to source; do not apply or replay migrations. Mainnet is untouched and production remains NOT APPROVED.

## Historical latest release — 0.338.33 / Run #272

Delivers 30 focused Feed, Profile, post-card and comment-thread improvements: account-scoped feed preferences and hidden-post state, identity-safe saved-post hydration, reduced-data-aware prefetch, online-only background refresh, duplicate-save protection, account-fenced profile timelines, abortable/locked pagination, safe user-facing timeline errors, awaited profile-media updates/removals, and blocked-comment descendant filtering with cycle-safe deterministic thread construction. Testnet migration `20261110193134_social_feed_profile_rpc_search_path_hardening` pins the search path of the feed-engagement and comment-reaction service-only RPCs without changing grants or rows. The Vercel build pipeline now removes stale multi-gigabyte Webpack cache packs before compilation and disables persistent production Webpack caching while retaining the single-worker memory settings. Exact-version install-script approvals are recorded for the two reviewed native dependencies. The live Vercel OOM root cause was identified from build events; Run #272 source is not yet deployed, so a successful new build is still required. Mainnet is untouched and production remains NOT APPROVED. See `docs/RUN272-FEED-PROFILE-30-POINT-AUDIT.md`.

## Previous release — 0.338.32 / Run #271

Repairs the social publishing hand-off across the composer, Feed, Stories and media authorization. First-party durable media-facade URLs are accepted by the post API and asset IDs—including video and PDF—are linked through the existing owner-checking attachment RPC. Post drafts are account-scoped and preserve media, audience, community target and a stable publish request ID. Story creation uses stable request IDs, server-derived profile identity, owner-verified media and strict audience/content validation. Three narrow Run #271 migrations were applied to Testnet only. Mainnet remains untouched. See `docs/RUN271-POST-COMPOSER-STORIES-30-POINT-AUDIT.md`.

## Previous release — 0.338.31 / Run #270

Upgrades the Community experience and its access-control boundary. Community cards now use semantic, keyboard-operable controls; the shared collapsing header and bottom navigation preserve accessible hide/reveal behavior; chat access requires explicit server-confirmed chat membership; community leave and moderator removal revoke the separate realtime chat membership atomically; stale Testnet chat grants were reconciled without deleting messages. Public community discovery now uses a server-side full-text/category search RPC with bounded pagination. Community chat, post and platform APIs validate IDs, action names, moderation payloads, dates, enums and safe HTTPS/relative resource links before privileged RPC calls. Both Run #270 Testnet-only migrations were applied and postflight-verified; Mainnet and Vercel production settings were not changed. The full Node 24.15.0 dependency-backed typecheck/lint/build, browser/device acceptance, complete migration-history reconciliation and provider release gates remain outstanding; production remains NOT APPROVED. See `docs/RUN270-COMMUNITY-30-POINT-AUDIT.md`.

## Previous release — 0.338.30 / Run #269

Hardens the active Testnet database by removing direct table-write and sequence privileges from `anon` and `authenticated`, while preserving RLS-governed reads and server-side service-role access. Adds fail-closed default privileges for future tables and sequences created by the migration owner. Repairs stale prebuild UI regression contracts, brings those checks into static verification, and adds a regression gate for client-role ACLs. The Testnet migration was applied and postflight-verified; Mainnet remains untouched. Three uncertain Pi earnings requests and two approved-but-unfulfilled membership intents remain held for provider reconciliation. Node 24.15.0 dependency-backed typecheck/lint/build and browser/device acceptance remain outstanding; production remains NOT APPROVED.

## Previous release — 0.338.28 / Run #266

Unifies the canonical post-card experience across Feed, Profile and Community, with semantic article structure, cleaner author metadata and media framing, and a stable mobile-first Comment / Save / Share action dock. Share feedback accurately reports that options opened rather than claiming content was sent. Run #266 source checks passed 14/14.

## Historical release — 0.338.27 / Run #261

Adds an operator-only Pi A2U ecosystem qualification register: full-KYC recipient attestations are bound to GreenHaven Pi UID mappings, and only independently provider-verified, developer-completed Testnet A2U settlements to five distinct recipients count. The register never creates or retries payments. The additive migration is REVIEW_REQUIRED and unapplied pending Testnet source deployment and migration-history review. Targets the live Pi earnings withdrawal failure with actionable provider-stage diagnostics, a read-only Pi incomplete-A2U health probe, a one-active-withdrawal-per-user guard, and safe Pi wallet-address binding/display. The wallet address is obtained from Pi's `wallet_address` permission and bound to the same server-verified app-specific Pi UID; the provider's actual `to_address` must match before any A2U payment is submitted or settled. A2U transfers still route by Pi UID, not a browser-supplied address. The new additive Testnet migration is REVIEW_REQUIRED and unapplied pending deployment/history review. Existing uncertain reservations are not force-released or blindly retried; users can explicitly reconcile an existing request against an exact Pi incomplete payment. See `docs/UPGRADE-WORKLOG-0.338.27.md` and `docs/PI-EARNINGS-WITHDRAWAL-INCIDENT-2026-11-10.md`.

The deployment and withdrawal observations in the following paragraphs are historical Run #261 context, not a statement that Run #266 is deployed. Run #266 is source-only and has not been pushed or deployed. Production remains NOT APPROVED.

The preceding Run #259 added the credential-free `.env.example` template and retained the Run #258 Testnet Marketplace order-list RPC repair. See `docs/UPGRADE-WORKLOG-0.338.25.md`.

## Last documented hardening notes — 0.330.49 (baseline for 0.338.9)

The 0.330.48 maintenance increment begins controlled Feed reliability work: client reconciliation now matches the canonical database keyset order (`created_at DESC, id DESC`) so equal-timestamp posts produce the correct next-page cursor. Runtime and source regression checks cover the ordering contract. The 15-section / 150-essential maintenance register remains the programme-wide target; its items are not represented as completed merely because they are registered. The latest notification baseline remains Phase 11.2.5, with remote Web Push disabled pending vetted sender integration, deployment secrets, approved database schema, scheduled worker and real device/provider acceptance. Production approval remains pending Node 24.15.x dependency-backed build, PostgreSQL/Testnet/Mainnet reconciliation and browser/mobile/two-account acceptance.
The 0.330.49 Phase 3 hardening increment closes wallet reservation transparency and recovery, makes GHC membership purchase preflight/debit serial per account, makes reward claim replay idempotent for reward-ID aliases, and verifies Pi payment identity/network/amount/transaction before binding or completing a recovered payment. The new SQL migration is REVIEW_REQUIRED and must be validated/applied by an operator after target database history reconciliation. Authenticated Testnet execution, PostgreSQL concurrency, Node 24.15.0 dependency-backed build and browser/device acceptance remain outstanding.



## 0.338.9 experience refinement

This release tightens the shared header, gives Marketplace and Community content more responsive breathing room, makes active-tab scroll reset deterministic, and prevents global keyboard shortcuts from interfering with editing or modal workflows. The 31-check UI/navigation audit is part of prebuild and static verification. Financial and database authority is unchanged; the project remains NOT APPROVED for production until Node 24.15.0, database, provider and browser/device acceptance gates pass.


## 0.338.10 — Messaging and Community transformation

This release adds a responsive multi-line message composer, bounded recent-message search inside conversations, keyboard-safe search/emoji dismissal, and safer offline/error handling for community join and invitation actions. No database migrations or financial-authority changes were introduced. See [`docs/PRIORITY_9_MESSAGING_COMMUNITY_TRANSFORMATION.md`](docs/PRIORITY_9_MESSAGING_COMMUNITY_TRANSFORMATION.md) for implementation scope and verification limits.


## 0.338.13 — Phase 1 messaging contracts

Adds durable conversation nicknames, quick-reaction/read-receipt preferences, read-receipt opt-out semantics, and GIN-indexed server-side full-history message search. Migration `20261109100001_gh_messaging_phase1_controls_search.sql` is REVIEW_REQUIRED and unapplied. See `docs/UPGRADE-WORKLOG-0.338.13.md`; Phase 1 cannot advance until remote history reconciliation, operator approval, Testnet PostgreSQL and two-account verification, plus contact-share/group-create acceptance.

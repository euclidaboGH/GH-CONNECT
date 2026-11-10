# GreenHaven

**Current source version:** `0.338.31`

Production status: **NOT APPROVED** — supported Node 24.15.0 dependency-backed typecheck/lint/build, browser/device, live database/provider and operator acceptance remain outstanding.

This repository is the canonical GreenHaven source tree. See `docs/SOURCE_OF_TRUTH.md` and `docs/CURRENT_BUILD_CONTEXT.md` before implementation or release work.


## Latest release — 0.338.31 / Run #270

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

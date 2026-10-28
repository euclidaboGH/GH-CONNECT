## v0.157.3 — Phase 4 recovery and identity integration hardening

Restore evidence validation now opens the evidence file with no-follow protection where supported, verifies the opened descriptor's file identity before reading, checks the size on the opened descriptor, and closes it in a `finally` block. Phase 4 source contracts now cover these guarantees and child-process timeouts. This is defense-in-depth for evidence handling, not proof of a successful restore or operational independence. The real disposable PostgreSQL restore drill, migration reconciliation, supported-runtime checks, browser journeys, and live Testnet acceptance remain outstanding.

## v0.157.2 — Phase 3 public identity hydration hardening

- Canonical public identity RPCs now use bounded network timeouts and strict response validation.
- Added explicit active/suspended/deleted identity lifecycle semantics and same-user ensure serialization in a new additive migration.
- Inactive identities do not resolve and cannot be silently recreated through the ensure API.
- The migration is not applied to any live database; see `docs/PHASE-02-CANONICAL-IDENTITY-HARDENING.md` for deployment gates.

## v0.150.9 Phase 11 — wallet cross-feature reconciliation

- The read-only Pi reconciliation response discloses the payment-intent store's 100-record cap and marks reports as potentially truncated at the limit.
- The wallet visibly warns that a capped result is not a complete lifetime reconciliation.
- GHC ledger transfers remain separate from Pi payment intents; unsupported mappings remain unverified.
- Run `npm run check:phase11-wallet-reconciliation`; operational and supported-runtime build verification remain open.

## v0.150.8 Phase 10 — marketplace, orders and fulfilment integrity

- Durable marketplace order reads are authoritative whenever Supabase is configured; stale process-local snapshots cannot drive lifecycle transitions.
- Persisted timestamps accept epoch milliseconds/seconds and ISO timestamps; missing timestamps remain unknown rather than being fabricated as the current time.
- Marketplace order cache updates happen only after durable writes succeed.
- Buyer/seller authorization, payment verification, inventory reservation, and payment/fulfilment separation remain enforced.

## v0.150.8 Phase 9 — canonical transaction integration

Pi payment history now uses a shared strict projection for stable identifiers, explicit PI currency, safe numeric-string amounts, product metadata, purpose labels, provider references, and honest timestamp handling. Mixed rails and malformed rows are rejected rather than coerced. Feature reconciliation remains authenticated, user-scoped, read-only, concurrency-bounded, and requires authoritative ownership/link checks where mappings exist. It does not mutate balances, payments, orders, entitlements, or fulfilment. Run `npm run check:phase9-wallet-transactions`; browser, provider Testnet, database concurrency, and supported Node 24 build acceptance remain open. See `docs/PHASE-09-WALLET-TRANSACTION-INTEGRATION.md`.

## v0.150.8 Phase 8 — wallet and financial UX reliability

The GHC wallet read path validates server snapshot currency, finite non-negative amounts, category fields, holds and reconciliation metadata before presenting them. Concurrent refresh responses are sequenced so an older response cannot overwrite newer wallet state. A transient read failure preserves the last server-confirmed snapshot but explicitly marks it stale instead of replacing it with local session data. Pi payment history and its read-only reconciliation now filter to the Pi provider and PI currency on the server; malformed history responses are errors, not fabricated empty histories. No balances, payments, orders, entitlements, or ledger rows are mutated. Run `npm run check:phase8-wallet-history`; browser, live database, concurrency, and supported Node 24 build acceptance remain open.

## v0.150.5 Phase 7 — social experience reliability

Feed mute filtering now fails closed when authoritative mute state is unavailable, preventing privacy controls from being bypassed during a database failure. Story creation uses the shared streaming JSON reader with a hard 1 MiB request limit even when Content-Length is absent or inaccurate. Existing visibility, identity, audience, and expiry authority are preserved. Run `npm run check:phase7-social-experience`; live DB/browser acceptance remains open. See `docs/PHASE-07-SOCIAL-EXPERIENCE-RELIABILITY.md`.

## v0.150.4 Phase 6 — app shell, navigation and onboarding

Canonical deep-link routing now handles primary and overlay destinations while preserving unrelated URL state. Unknown routes offer explicit accessible recovery instead of an automatic redirect. The Phase 6 source-contract checker is registered in static verification. Browser/device journey acceptance remains open.

## GreenHaven v0.151.0 — project truth and release authority

Phase 16 adds an authenticated, user-scoped read-only endpoint for persisted payment-intent audit events and a user-triggered history view in payment details. It sorts recorded events by their stored timestamps, returns only selected audit fields, and never invents missing events. This is not a complete Pi provider or blockchain event feed. No payment, fulfilment, order, entitlement, or balance mutation is added.

## v0.104.0 Phase 15 — payment recovery guidance and support workflows

- Added copy/share/download actions to GHC ledger transaction details, complementing the existing Pi intent receipt.
- Exports use only persisted ledger fields, disclose that the record is not external bank/Pi settlement proof, and do not mutate balances.
- GHC and Pi remain separate asset rails; runtime build and live Testnet verification are still required before deployment.

## v0.101.0 — Phase 11 wallet cross-feature reconciliation

Pi payment history now distinguishes a true empty result from server/network failure, preserves previously loaded rows on failed refresh, exposes an accessible retry state, and supports text search. Pi and GHC remain separate asset rails. A network-independent source checker covers history failure handling, retry, authenticated user-scoped retrieval, and no-store responses. No migration or live payment was performed. Full Node 24 typecheck/build and live Testnet verification remain outstanding. See `PHASE-8-WALLET-HISTORY-RELIABILITY.md`.

## v0.95.0 — Phase 6 cross-feature integration reliability

The static verification suite includes a source-contract gate for canonical identity, referral attribution, social/curation, wallet/rewards, payment fulfillment, server-only database access, production durability, and messaging. It introduces no migrations and does not prove live Testnet/provider behavior. See `PHASE-6-CROSS-FEATURE-INTEGRATION-RELIABILITY.md`.

## v0.94.0 — Phase 5 curation intelligence reliability

Curation intelligence RPC errors are normalized to bounded diagnostic codes, and the endpoint classifies relevant schema/dependency failures without returning raw database messages. Persisted server-owned intelligence remains mandatory. No migration was added; live Testnet verification and Node 24 build checks remain required. See `PHASE-5-CURATION-RELIABILITY.md`.

## v0.93.0 — Phase 4 cross-feature identity integration

Canonical public profile hydration now covers the authenticated main feed, nested comment previews, and people/posts/videos/creator search results. This is best-effort public display metadata only; no authorship, visibility, ranking, or economy authority is changed. See `PHASE-4-CROSS-FEATURE-IDENTITY-INTEGRATION.md`. Live Testnet and Node 24 production build verification remain required.

## v0.92.0 — Phase 3 public profile identity hydration

## v0.91.9 — Phase 2 canonical identity

Referral attribution uses the shared server-side `ghc_public_identities` resolver. The legacy `gh_profiles` multi-column probe has been removed to prevent schema drift from making valid canonical IDs appear invalid. Static checks passed; live Testnet RPC availability and legacy-ID reconciliation remain operator verification items. See `PHASE-2-CANONICAL-GREENHAVEN-IDENTITY.md`.

## v0.91.9 curation intelligence readiness diagnostics

- The curation API now returns a stable user-facing unavailable message plus a safe diagnostic code when authoritative curation weight cannot be resolved.
- Detailed database/migration failure reasons are restricted to server logs; raw PostgREST messages and secrets are not returned to clients.
- Voting remains fail-closed when durable reputation intelligence is missing. No formula-only, client-supplied, or balance-derived vote-weight fallback was added.
- If Testnet continues returning `CURATION_INTELLIGENCE_UNAVAILABLE`, verify that migration `20261023030002_gh_reputation_curation_intelligence_v2.sql` is applied and that the Vercel deployment has valid Supabase URL/service-role configuration. Shipping a migration file in the ZIP does not apply it to Supabase.

## v0.91.6 deliberate curation and explicit reactions

- A normal tap on the post upvote/downvote controls opens a compact reaction picker only; it does not submit a curation vote or move GHC.
- Holding either curation control for 1.2 seconds submits the selected vote through the existing authenticated, server-authoritative curation API. Releasing early cancels the vote.
- Removed long-press reactions from the post media itself to stop reaction pickers appearing unexpectedly in Feed and Profile. Reaction icons are smaller.
- GHC movement remains controlled by the server response and existing economy feature gates; no client-side balance deduction was introduced.

## v0.91.6 coin-tap claim and transient confirmation

- Tapping the floating GHC coin starts the authenticated server claim; the popover shows verification progress and then the confirmed result.
- Removed the extra claim CTA and outdated “tap below” copy. The short notice explains daily check-ins and streaks; reward state is displayed only after server confirmation.
- The notice closes on an outside-screen tap or automatically after 10 seconds. Failed claims retain a retry action, and duplicate taps remain guarded while a request is in flight.
- Runtime Testnet and production-build verification remain required before release approval.

# GreenHaven project truth and release authority

**Current source version:** `0.157.18`

This document describes the checked-in archive only. It does not establish that any remote deployment, database migration, payment provider, Pi Platform integration, or account-security flow is live or verified.

## Authority

- Application package version: `package.json`.
- Locked dependency graph and root package metadata: `package-lock.json`.
- In-app release label: `lib/app-release.ts`.
- Canonical SQL migration inventory: `supabase/migrations/`, summarized by `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt`.
- Automated verification workflow: `.github/workflows/ci.yml`.
- Runtime requirement: `.nvmrc` and the `engines.node` field in `package.json`.

All version sources must agree. If they do not, stop release work and reconcile the metadata rather than guessing which version is authoritative.

## Latest source-only improvement batch (2026-10-28)

See `docs/UPGRADE-WORKLOG-0.157.18.md` for the current audit findings and changes. The v0.157.13 cross-phase hardening adds streaming JSON byte limits to account lifecycle, marketplace listing creation/update, social post creation, notification bulk-read, community creation, marketplace saves, and social comment creation. The v0.157.14 follow-up extends bounded-body parsing to seller/bank payout intake, membership activation, GHC pack intents, Pi step-up, ad verification, social block/restrict/mute/follow/save, and payment recovery. The v0.157.16 follow-up adds bounded parsing to connection requests, moderation reports, matching signals, creator tips, and bank-beneficiary create/disable; it tightens string-only identifiers, connection metadata bounds, and tip amount syntax, and adds runtime tests for the shared bounded JSON reader. It also prevents payout amount booleans/malformed coercible values and requires social follow target IDs to be strings. Oversized requests fail before route business logic; supported larger social/listing media limits remain unchanged. Phase 5 centralizes official brand asset paths without altering owner-approved logo files, adds hash-based asset integrity checks, and strengthens responsive safe-area gutters plus high-contrast and forced-colors states. Phase 6 hardens client navigation against server-side invocation, sanitizes navigation payloads and settings sections, and gives the not-found back action a safe first-entry fallback. Phase 7 rejects malformed feed rows that do not carry a canonical author identifier, preventing them from bypassing the mute filter. Phase 8 requires bounded wallet identity, integer pending counts, plausible timestamps and allowlisted escrow rails, and applies no-store headers to wallet summary responses. Phase 9 rejects malformed or missing Pi transaction amounts, bounds transaction identifiers and labels, validates decimal payment-intent inputs, and keeps reconciliation authenticated, user-scoped and read-only. Phase 10 v0.157.9 applies streaming request-body limits to marketplace order mutations, rejects quantity coercion and malformed commerce action payloads, bounds listing identifiers, and applies no-store response headers while preserving durable server-side pricing, inventory reservation, idempotency and authorization contracts. Phase 10 v0.157.10 prevents generic public transitions from setting refund/commerce lifecycle outcomes and gates buyer completion on persisted delivery/service activation. Phase 3 hydration remains bounded and best-effort. Source checks do not prove runtime or live database behavior. This is not production approval: the available audit runtime is Node.js 22.16.0, below the supported Node.js 24.15.0 baseline, and dependencies are not installed here. Locked install, TypeScript, lint, production build, browser journeys, live backend/provider, security, recovery and migration-state verification remain outstanding.

## Current verification limits

- The supported Node.js runtime is `^24.15.0`; Node.js 22 is unsupported for this project.
- Static JSX, lockfile coverage, and Pi backend lock checks can be run independently. TypeScript, lint, and Next.js production build must run with the supported Node runtime and installed locked dependencies.
- A source migration inventory is not evidence of applied migrations. Reconcile Testnet and Mainnet migration history independently using the Supabase CLI and target project.
- Testnet Pi authentication/payments, multi-account authorization, private-media access, notifications, messaging, payouts, and provider webhooks require live or disposable-environment evidence before enabling or releasing them.
- Mainnet must not be changed as part of source repair. Do not bulk-apply SQL migrations or enable financially sensitive flags based only on this repository inventory.

## Required pre-release checks

1. Use Node.js `24.15.0` or a compatible later `24.x` version satisfying `package.json`.
2. Run `npm ci --legacy-peer-deps --no-audit`.
3. Run `npm run check:jsx`, `npm run check:release-hygiene`, `npm run check:dependency-lock-integrity`, `npm run check:pi-backend-lock`, `npm run check:clean-migrations`, and `npm run check:migration-release-readiness`.
4. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
5. Review migration classifications and reconcile actual target history before applying any SQL.
6. Complete the Testnet evidence checklist and receive explicit approval before any Mainnet release.

**Release status: NOT APPROVED by this document.** Passing static checks does not replace build, database, integration, security, or operator verification.


## v0.90.9 payment retry reliability
Payment failure handling now preserves community/group drafts and stable IDs, and adds regression coverage for marketplace listing-fee retries. Static verification passed 11/11; live testnet payment behavior is not certified by this source-only check.


## v0.91.0 notification center restoration

The notification center is mounted in the shared compact header actions after Marketplace and Ecosystem. Notification source wiring, update refresh, accessible focus, and section attention indicators have been hardened. See `PHASE-28-NOTIFICATION-CENTER-RESTORATION.md`.


## v0.91.6 floating claim, notification header, and matured reward settlement

- Daily claim is a compact floating action above bottom navigation; it no longer auto-opens or occupies header/content flow.
- Marketplace, Ecosystem, and a compact gold notification bell share one header row; the old global top-right overlay was removed.
- Loading fallbacks use a small GreenHaven brand blink that respects reduced-motion preferences.
- Wallet refresh invokes an authenticated, rate-limited server reconciliation for matured Daily Claim V12 holds. The durable RPC still enforces owner, 48-hour lock, review status, and idempotency. A migration backfills metadata for identifiable legacy pending Daily Claim rows.
- Full production build and live Testnet settlement still require Node 24, applied migrations, and authenticated Testnet validation.

## v0.91.2 daily rewards reliability

The daily claim experience keeps a floating lightning action and opens the claim sheet only when the user taps it or another explicit action requests it. If status is temporarily unavailable, the lightning action remains usable and the server remains the authority for claim acceptance. Claim failures remain retryable; no client-side balance minting or economy bypass was introduced.


## v0.91.2 wallet and utility reliability

Wallet action wiring and the Spend GHC path received a surgical reliability pass. The legacy boost chip now opens the utility catalog instead of silently returning when its domain method is absent. Utility purchases require a review step, target-bound purchases require a target, catalog load errors can be retried, and request idempotency keys remain stable across retries. Unconfigured effects stay unavailable and fail closed. Static contract checks do not prove live database settlement or production build readiness; the release remains NOT APPROVED until Node 24 build and authenticated testnet verification complete.


## v0.91.6 compact GHC daily reward popover

The floating daily claim control uses the official round GHC coin image with reduced-motion-aware gold glow and lightning accents. It opens a compact non-modal popover above the bottom navigation with short explanatory copy and server-verified claim status. This visual change does not change reward eligibility, claim amounts, ledger authority, or the 48-hour hold.


Latest source audit worklog: `docs/UPGRADE-WORKLOG-0.157.18.md`. Source-level checks do not establish production readiness; see the release acceptance boundaries before deployment.

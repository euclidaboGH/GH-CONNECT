## v0.157.27 — Marketplace payment reconciliation recovery

- Verified Pi payments are not reported as fully reconciled when the cashback revenue journal append fails.
- The pay endpoint returns an explicit retryable reconciliation state, with no-store and Retry-After headers; retries reuse the already-completed payment intent.
- Recovery repairs interrupted marketplace order transitions where safe, without submitting another provider payment.
- Revenue-journal network calls have a bounded five-second timeout per attempt so upstream stalls become explicit retryable reconciliation states.
- Static regression contract: `scripts/check-marketplace-revenue-reconciliation.mjs`.

## v0.157.25 — Cashback period close reconciliation safety

- Adds a service-role-only wrapper around the existing four-month cashback close RPC.
- Enforces a seven-day reconciliation grace after each period ends so delayed verified revenue events and recovery retries have time to arrive before the immutable snapshot is calculated.
- Preserves the original four-month UTC earning window; the grace period delays calculation but does not add spending days to the period.
- Revokes direct API-role execution of the renamed underlying close function and exposes only the guarded wrapper.
- Adds a dedicated regression contract to `prebuild` and the full static suite.
- The migration is `REVIEW_REQUIRED`, unapplied, and requires disposable PostgreSQL ACL/concurrency testing plus target migration-history reconciliation. This does not enable withdrawals or A2U payouts.

## v0.157.24 — Pi cashback statement in Rewards Center and Wallet

- Adds a review-gated SQL foundation for canonical paying-user attribution on verified company revenue events, with cashback eligibility opt-in and service-role-only append RPC.
- Adds fixed four-month UTC period records and unique per-user entitlements calculated at 3% of attributable net eligible PI revenue using integer 10^-7 PI atomic units.
- Extends the server-only revenue adapter to pass payer attribution to the attributed RPC without changing existing un-attributed callers.
- Adds a dedicated cashback ledger regression contract and migration review classification.
- Documents source eligibility and remaining integrations in `docs/PI-CASHBACK-SOURCE-ATTRIBUTION-AUDIT.md`.
- Does **not** wire payment producers, add a user payout route/UI, apply migrations, or activate A2U. Source attribution producers, disposable PostgreSQL/Testnet validation and Pi Mainnet permission remain gates.

## v0.157.21 — Notification, feed hydration, daily-claim and vote reliability

This release corrects four user-visible reliability failures and adjacent race conditions: notification unread badges are derived from unique visible rows instead of summed overlapping counters; read-all waits for durable write attempts and refreshes are queued rather than dropped; the feed hydrates from the canonical server endpoint on first entry and retries superseded initial requests; daily claims use synchronous in-flight guards; and upvote/downvote taps now submit a server-authoritative vote directly rather than opening a reaction-picker overlay. Long-press voter rosters remain available. A 16-check regression contract is registered in `prebuild`. This is a source-level correction, not a claim of live Supabase/Vercel verification.

## v0.157.20 — Pi wallet history type-predicate correction

This release fixes the Pi wallet history type predicate that blocked the v0.157.19 Vercel build, and updates the regression guard to require the canonical `PiTransactionProjection` type. It retains the previous wallet, payment-order, governance, bounded-JSON and CI runtime hardening. Dependency audit and npm environment warnings are documented separately; they are not falsely marked resolved. See `docs/UPGRADE-WORKLOG-0.157.20.md`.

## v0.157.16 — Phase 1–12 connection, moderation and financial request hardening

This increment adds bounded streaming JSON parsing to connection requests, user/community report intake, matching signals, creator tips, and bank beneficiary creation/disable. It rejects malformed/non-object payloads before route business logic, requires string identifiers for matching/report/bank-beneficiary fields, validates connection note/source lengths, and prevents boolean/object or exponent-style coercion in tip amounts. The shared bounded JSON parser now has a dedicated runtime test covering valid JSON, declared and streamed size limits, malformed JSON, non-object bodies, invalid UTF-8, invalid limits and bodyless requests. Static checks and runtime helper tests do not replace a full Next.js build or live integration tests. See `docs/UPGRADE-WORKLOG-0.157.16.md`.

## v0.157.14 — Phase 1–12 financial, identity and social request hardening

This cross-phase increment adds streaming JSON byte limits to twelve additional high-impact write routes: seller and bank payout intake, membership activation, GHC pack payment intents, Pi step-up authentication, ad verification signals, social block/restrict/mute/follow/save mutations, and payment recovery. The payout amount parser no longer accepts booleans or malformed values through JavaScript coercion, and follow target IDs must be strings. Requests that exceed limits receive HTTP 413; malformed/non-object JSON receives HTTP 400 before route business logic. The existing v0.157.13 body-boundary work remains included. No remote systems are contacted and no production state is mutated. Source checks are not production approval. See `docs/UPGRADE-WORKLOG-0.157.16.md`.

## v0.157.11 — Phase 11 wallet cross-feature reconciliation integrity

Read-only payment reconciliation resolves only canonical or explicitly prefixed marketplace order references and rejects matches with conflicting intent/provider identifiers, verifies the stored Pi rail and amount before counting a purchase as matched, and requires the order and intent to agree on refund/cancellation terminal states. Membership matching prioritizes the canonical payment-intent ID and only uses a provider-payment reference or `pi:<intent-id>` fallback when no intent ID is stored, avoiding false matches against reusable product references. The 100-record history cap is now exported by the payment-intent store and reused by reconciliation, with returned and reconciled counts disclosed. No financial records are written. Source-level checks do not establish live database, provider, or production acceptance. See `docs/UPGRADE-WORKLOG-0.157.11.md`.

## v0.157.10 — Phase 10 marketplace delivery and lifecycle integrity

The Phase 10 follow-up closes two order-lifecycle gaps: public generic order transitions can no longer mark an order refunded or directly mutate commerce-controlled fulfilment/completion/dispute states, and buyer confirmation is gated on the authoritative seller delivery/service activation state in both the marketplace UI and the database RPC. The generic transition API now rejects non-string target states without coercion. Added forward migration `20261028160000_marketplace_buyer_confirmation_delivery_gate.sql`. Source-level checks do not establish migration application, live concurrency, provider settlement, or production readiness. See `docs/UPGRADE-WORKLOG-0.157.10.md`.

## v0.157.9 — Phase 10 marketplace order integrity hardening

Marketplace order mutations now use streaming bounded JSON parsing, reject malformed or oversized bodies, enforce strict integer quantities (1–99) without coercing invalid values to a default purchase, bound listing identifiers, and avoid coercing commerce action/note payloads. Order payment, transition, and commerce mutation responses use explicit no-store headers. Server-derived price/seller/currency, durable reservation RPCs, idempotency, buyer/seller authorization, payment verification, and separate fulfilment transitions remain authoritative. Runtime, concurrency, and live database acceptance remain open. See `docs/UPGRADE-WORKLOG-0.157.9.md`.

Pi transaction history now rejects missing, non-positive, malformed, coerced, or over-precision amounts; bounds transaction identifiers and labels; and does not present implausibly future timestamps as valid history. Payment-intent creation validates decimal amount input and rejects malformed metadata and control characters in references/idempotency keys. Reconciliation remains authenticated, user-scoped, read-only, and explicitly bounded. Runtime and live integration acceptance remain open. See `docs/UPGRADE-WORKLOG-0.157.9.md`.

## v0.157.7 — Phase 8 wallet and financial UX hardening

Wallet snapshot validation now requires a bounded user identity, safe integer pending count, plausible server timestamp, and an allowlisted escrow rail. The wallet summary API consistently disables caching on success and error responses. Financial writes remain server-authoritative; live integration acceptance remains a separate release gate. See `docs/UPGRADE-WORKLOG-0.157.7.md`.

## v0.157.5 — Phase 6 application shell and navigation hardening

Navigation now fails safely outside browser runtime, rejects control-character payloads, validates settings destinations at runtime, and makes the explicit not-found back action recover to Home when no prior history entry exists. Phase 6 contract checks cover these cases. Browser journeys and supported-runtime build acceptance remain open. See `docs/UPGRADE-WORKLOG-0.157.5.md`.

## v0.157.4 — Phase 5 brand-safe design system hardening

Official GreenHaven and GHC logo assets remain unchanged and are now guarded by SHA-256 regression checks. Shared logo components use centralized asset-path constants. Responsive gutters respect device safe areas, and semantic status/focus feedback is stronger in high-contrast and forced-colors modes. Visual/browser accessibility acceptance and supported Node 24 build checks remain open.

## v0.157.3 — Phase 4 recovery and identity integration hardening

- Restore evidence is opened through a file descriptor with no-follow protection where supported, then verified with `fstat` against the preflight file identity before reading. This reduces symlink and path-swap risks in the evidence validator.
- Evidence size is checked against the opened file descriptor before JSON parsing, and the descriptor closes on every path.
- Expanded Phase 4 regression contracts to verify secure evidence reads, bounded child-process timeouts, identity integration registration, and source-only versus operational gate separation.
- These controls validate evidence structure, not the truth of an operator's claims. A real disposable PostgreSQL restore drill and independent review remain mandatory; no live database was contacted.

## v0.157.2 — Phase 3 public identity hydration hardening

- Public profile hydration now traverses bounded nested comment/reply trees in a shared batch.
- Existing avatar fallbacks are validated through the same public URL policy as hydrated profile photos.
- Identity enrichment remains best-effort and bounded by row count, depth, response bytes, and upstream timeout.
- Runtime and live database verification remain release gates; see `docs/PHASE-03-PUBLIC-PROFILE-IDENTITY.md`.

## v0.157.2 — Phase 1–12 audit-truth and release-contract hardening

- Canonical public identity RPCs now use bounded network timeouts and strict response validation.
- Added explicit active/suspended/deleted identity lifecycle semantics and same-user ensure serialization in a new additive migration.
- Inactive identities do not resolve and cannot be silently recreated through the ensure API.
- The migration is not applied to any live database; see `docs/PHASE-02-CANONICAL-IDENTITY-HARDENING.md` for deployment gates.

## v0.150.9 Phase 11 — wallet cross-feature reconciliation

Reconciliation now discloses the 100-intent store limit and warns when a report may be truncated, preventing a capped sample from being mistaken for a complete lifetime audit. The endpoint remains authenticated, user-scoped, read-only, and keeps GHC and Pi rails separate. Run `npm run check:phase11-wallet-reconciliation`. See `docs/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md`.

## v0.150.8 Phase 10 — marketplace, orders and fulfilment integrity

- Durable order state drives transitions; persisted timestamps normalize safely; order cache changes only after durable writes.
- Regression contract: `npm run check:phase10-marketplace-integrity`.

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

Deep links now resolve through the canonical destination catalogue, including overlay destinations, while preserving unrelated URL state. Unknown routes present explicit, keyboard-accessible recovery rather than silently redirecting. Existing onboarding and session-lock authority are preserved. Run `npm run check:phase6-shell-navigation`; full browser journey acceptance remains open.

## GreenHaven v0.150.8 — source baseline and production-readiness programme

Phase 16 adds an authenticated, user-scoped read-only endpoint for persisted payment-intent audit events and a user-triggered history view in payment details. It sorts recorded events by their stored timestamps, returns only selected audit fields, and never invents missing events. This is not a complete Pi provider or blockchain event feed. No payment, fulfilment, order, entitlement, or balance mutation is added.

## v0.104.0 Phase 15 — payment recovery guidance and support workflows

- Added copy/share/download actions to GHC ledger transaction details, complementing the existing Pi intent receipt.
- Exports use only persisted ledger fields, disclose that the record is not external bank/Pi settlement proof, and do not mutate balances.
- GHC and Pi remain separate asset rails; runtime build and live Testnet verification are still required before deployment.

## v0.101.0 Phase 11 — wallet cross-feature reconciliation

See `PHASE-7-RUNTIME-INTEGRATION-HARDENING.md`. Added source contracts for webhook signature/idempotency, authenticated messaging, server-authoritative rewards, payment ownership and referral/wallet boundaries, plus a safe deployed negative-path smoke runner. This does not replace Node 24 build checks, disposable-PostgreSQL concurrency tests, or authenticated Testnet verification. Run `npm run check:phase7-runtime-hardening` and, against the target deployment, `npm run operator:phase7-runtime-hardening`.

## v0.95.0 Phase 6 — cross-feature integration reliability

See `PHASE-6-CROSS-FEATURE-INTEGRATION-RELIABILITY.md`. The static release suite now verifies critical wiring and server-authority contracts across canonical identity, social/curation, wallet/rewards, referrals, payment fulfillment, and messaging. This source-only gate does not replace Node 24 build checks or authenticated Testnet verification.

## v0.94.0 Phase 5 — curation intelligence reliability

Supabase/PostgREST intelligence RPC failures are normalized into bounded diagnostic identifiers; curation logs can distinguish database configuration, network, invalid payload, and relevant schema/dependency failures without exposing raw database messages. Durable server-owned intelligence remains mandatory; no formula fallback or economy bypass was added. No migration was added, and live Testnet verification is still required. Run `npm run check:phase5-reliability` alongside the static and safety suites. See `PHASE-5-CURATION-RELIABILITY.md`.

## Recovery workstream Phase 4 — operational release gate

CI now explicitly runs the Phase 3 recovery contracts, restore-evidence regression suite, Phase 4 recovery source gate, and existing Phase 4 identity-integration checks under Node.js 24.15.0. These source checks do not replace a real isolated PostgreSQL restore rehearsal; release remains blocked until redacted operational evidence passes the strict gate.

Added an offline orchestrator for Phase 3 recovery contracts and a strict release gate requiring redacted evidence from a real disposable PostgreSQL restore rehearsal. Evidence symlinks are rejected and child checks have bounded timeouts. Source checks do not claim a restore happened; see `docs/PHASE-04-RECOVERY-RELEASE-GATE.md`.

## v0.93.0 Phase 4 — cross-feature identity integration

Extended canonical public profile hydration to the authenticated main feed, nested comment previews, and people/posts/videos/creator search results. Hydration is batched, best-effort, no-store, and only fills public display-name/photo aliases. It does not alter visibility checks, authorship, ranking, or financial authority. Run `npm run check:phase4-identity-integration` plus the Phase 3 and release-hygiene checks. Testnet verification is still required.

## v0.92.0 Phase 3 — public profile identity hydration

Added best-effort canonical profile-name/photo hydration to social feed, post detail, comments, profile timelines, and active stories. The shared server helper selects only public identity fields and leaves existing records intact if the profile read is unavailable. Run `npm run check:phase3-profile-identity`; verify real Testnet profiles after deployment.

## v0.91.9 Phase 2 — canonical GreenHaven identity

Referral attribution now resolves GreenHaven IDs through the same durable public identity directory used by GHC recipient resolution, rather than probing legacy profile columns. This avoids false invalid-ID responses when a valid ID exists in `ghc_public_identities`. Run `npm run check:phase2-identity` and `node scripts/test-fee-referral-contract.mjs`. See `PHASE-2-CANONICAL-GREENHAVEN-IDENTITY.md` for implementation details and the Testnet checklist. Profile display-name restoration remains Phase 3.

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

# GreenHaven — GH Connect

## v0.157.27 — Testnet Pi cashback A2U payout path

Added an authenticated, Testnet-only cashback withdrawal endpoint that derives payout amounts from finalized server-side entitlements and the recipient from the linked Pi identity. It shares the global Pi app-wallet sequence lease with seller A2U, records a separate entitlement-bound payout ledger, verifies the provider payment/recipient/amount/network/transaction, and only records `paid` after verified developer completion and durable reconciliation. Rewards Center exposes the withdrawal action only when the Testnet flags and server-side Pi credentials are present. Mainnet remains disabled. The new migration is REVIEW_REQUIRED and must be validated on disposable PostgreSQL and Pi Testnet before users can receive real Testnet credits. Configure the required Testnet flags and server-only Pi credentials only on the Preview deployment; fund the Testnet app wallet and ensure testers have finalized positive cashback entitlements and linked Pi identities. See `docs/PI-A2U-EARNINGS-AND-CASHBACK-ROADMAP.md`.

**Current source version:** `0.179.0`

Phase 6 navigation implementation notes: `docs/PHASE-06-APP-SHELL-NAVIGATION-ONBOARDING.md`. Phase 5 design-system notes remain in `docs/PHASE-05-BRANDING-DESIGN-SYSTEM.md`. Source checks do not substitute for browser journey and accessibility acceptance.

GH Connect is the GreenHaven social, matching, community, messaging, marketplace, and GHC utility platform.

## Engineering and release safety

- Use Node.js `24.15.0` or the compatible Node 24 runtime specified by `.nvmrc` and `package.json`.
- Install locked dependencies with `npm ci`.
- Run `npm run verify:static`, `npm run typecheck`, `npm run lint`, and `npm run build` before release.
- Database migration inventory is source metadata only. It does not prove migrations are applied to Testnet or Mainnet. Reconcile remote migration history and validate review-required migrations on disposable PostgreSQL/Testnet before applying them.
- Financial balances, rewards, payments, and entitlements must remain server-authoritative. Do not add client-side financial authority, fabricated financial data, or authentication/RLS bypasses.

See `docs/PROJECT_TRUTH.md`, `docs/MIGRATION_CHECKLIST.md`, and `PHASE-26-SURGICAL-RELIABILITY-FIXES.md` for release constraints and current verification limits.


## v0.91.6 floating claim, compact header, and matured reward settlement

See `PHASE-31-FLOATING-CLAIM-HEADER-AND-MATURED-REWARDS.md`. The claim action now floats above bottom navigation, the gold notification bell shares the Marketplace/Ecosystem header row, loading fallbacks use a reduced-motion-aware brand blink, and wallet refresh reconciles eligible matured Daily Claim holds through the durable RPC. The new metadata backfill is review-required; this release is not production-approved until it is reviewed/applied and Testnet settlement is verified.

## v0.91.6 compact GHC daily reward popover

The daily claim action now uses the official round gold GHC coin art instead of a generic lightning button. A small animated gold aura and staggered lightning accents draw attention without taking up layout space. Tapping the coin opens a compact non-modal claim popover with short daily check-in copy, a secure claim action, a clear 48-hour hold explanation, retry feedback, and wallet/reward-history shortcuts after confirmation. The popover does not dim or block the rest of the app, and animations respect reduced-motion settings. Run `node scripts/check-daily-reward-ux.mjs` and `node scripts/check-phase31-floating-header-settlement.mjs` before release.

## v0.90.9 payment retry reliability
Community creation and marketplace listing payment failures preserve the in-progress draft and expose retry guidance. See `PHASE-27-PAYMENT-RETRY-AND-DRAFT-PRESERVATION.md`; payment retry contract passed 10/10 and full static verification passed 11/11. Live testnet payments still require operator validation.

## v0.91.0 notification center restoration

The notification bell is inline with Marketplace and Ecosystem in the compact shared header. The notification center now fetches the unified, social, economy, and announcement sources separately, refreshes on domain updates without overlapping polls, and uses a more precise Home activity indicator. Browser notification permission is not requested merely by opening the inbox. See `PHASE-28-NOTIFICATION-CENTER-RESTORATION.md`.


## v0.91.2 daily rewards reliability

- Daily claim uses a floating lightning action and opens the claim sheet only when the user taps it or another explicit action requests it.
- A persistent floating lightning action remains available when eligibility status is temporarily unknown, and the dialog can attempt a server-authoritative claim instead of showing a dead disabled button.
- Retryable errors remain visible; duplicate submissions are guarded and the dialog cannot be dismissed during an in-flight claim.
- Daily claims still use the authenticated, rate-limited, idempotent server endpoint and remain pending under the 48-hour lock.
- Run `node scripts/check-daily-reward-ux.mjs` and the full static verification suite before release.


## v0.91.2 wallet and utility reliability

- Rewired the legacy wallet boost shortcut to the real Spend GHC panel rather than silently calling a missing domain method.
- Added recoverable utility catalog loading, refresh controls, a review-before-spend step, and target validation for target-bound utility purchases.
- Utility spend retries now reuse a stable request idempotency key until success; the server requires a key and no longer invents minute-bucket references.
- Unconfigured boosts/tools remain explicitly unavailable and fail closed: no GHC is charged without a durable activation path.
- Added wallet/utility regression checks covering button wiring, server pricing, idempotency, and fail-closed behavior.

## v0.94.0 Phase 5 — curation intelligence reliability

- Supabase/PostgREST intelligence RPC failures are normalized into bounded diagnostic identifiers for safer, more actionable server logs.
- Curation migration-readiness classification recognizes relevant schema-cache, function, and dependency SQLSTATE failures without returning raw database messages to clients.
- Persisted server-owned curation intelligence remains mandatory; no formula fallback, client authority, or economy bypass was introduced.
- No database migration was added. Live Testnet verification remains an operator step.
- Run `node scripts/check-phase5-reliability.mjs` alongside the Phase 3/4 identity checks, release hygiene, lock integrity, safety scan, and static verification suite.


Latest source audit worklog: `docs/UPGRADE-WORKLOG-0.157.27.md`. Source-level checks do not establish production readiness; see the release acceptance boundaries before deployment.

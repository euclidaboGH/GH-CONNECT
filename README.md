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

**Current source version:** `0.217.0`

## v0.182.0 — Phase 3 unified wallet integration

- Hardened the PI earnings balance panel with request timeout, latest-request-wins refresh sequencing, explicit retry, and server-provided payout eligibility / Pi identity linkage status.
- PI and GHC remain separate authoritative balances and transaction rails. A balance display is not treated as payout authorization or settlement proof.
- See `docs/PHASE3_UNIFIED_WALLET_CARD_0.182.0.md` for scope, verification, and remaining release gates.


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

## PI earnings payout lifecycle — Phase 4 backend progression (0.185.0)

The additive migration `20261030010002_pi_earnings_payout_requests.sql` introduces a durable, service-role-only PI earnings payout request record and an atomic request-plus-gross-reservation RPC. Idempotency is scoped to the user and rejects payload conflicts. The linked Pi identity is copied from `gh_pi_identities`; the client cannot choose the recipient. Gross, fee and net are constrained to conserve the quoted amount. An uncertain provider outcome retains the reservation.

**Important release boundary:** the request migration does not initiate Pi A2U transfers. This candidate adds guarded settlement and authoritative-failure release RPCs, but does not yet provide the dedicated provider execution/reconciliation worker that independently fetches and validates Pi receipts. Do not apply the migration to Testnet until its dependencies, function ACLs, transaction behavior and concurrent reservation behavior have been exercised on disposable PostgreSQL. Do not enable Mainnet. Mainnet remains disabled.


## v0.184.0 — PI earnings settlement and safe-release foundation

Added service-role-only settlement and recovery RPCs. Settlement requires exact Testnet network, recipient, net amount, verified transaction and developer-completed provider status before consuming the gross reservation. A verified terminal cancellation with no transaction is required before releasing the gross reservation. These database functions are not a substitute for a server-side Pi provider execution/reconciliation worker; provider execution and full Testnet lifecycle remain gated.

## v0.185.0 — dedicated PI earnings Testnet execution worker

This candidate adds `POST /api/economy/earnings/withdrawals/execute`, a separate general-earnings A2U execution path. It authenticates the owning user, requires a server-side executor secret and explicit Testnet-only flags, checks recipient wallet authorization, takes a durable global Pi A2U sequence lease, recovers a matching incomplete payment before creating one, persists the provider payment identifier before submission, and independently re-reads the completed Pi payment before calling the verified gross-reservation settlement RPC. Any ambiguous result retains the reservation and leaves the request recoverable. Seller and cashback payout records are not reused.

The route is disabled by default. Required server configuration includes `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true`, `PI_A2U_ENABLED=true`, `PI_A2U_TESTNET_ONLY=true`, `PI_NETWORK=testnet`, `PI_ENV=production`, `NEXT_PUBLIC_PI_SANDBOX=true`, Pi server API key, app-wallet private seed, Supabase service-role credentials, and `PI_EARNINGS_EXECUTOR_KEY` (or the existing A2U admin key). Do not enable until migrations are reviewed/applied on the intended Testnet project and PostgreSQL plus live Pi Testnet failure/recovery tests pass. Mainnet remains disabled.


## v0.189.0 — Phase 1–4 execution and recovery hardening

The Phase 1–4 audit follow-up bounds the PI earnings execution request body, adds a service-role-only heartbeat for the durable execution lease, extends active worker leases to ten minutes with 45-second heartbeats, and avoids repeating provider completion when Pi already confirms developer completion. Settlement still requires an independent provider read-after-write receipt. These are source-level safeguards; PostgreSQL concurrency/failure-injection, Node.js 24.15.0 production build, and authenticated Pi Testnet E2E remain required before enabling payouts. Mainnet remains disabled.


## v0.189.0 — Phase 4 receipt and lease fencing

This release hardens the PI earnings worker at both the route and database boundaries. The worker revalidates its lease immediately before provider-side create, submit, and complete operations; heartbeat updates lock and validate the request and global lane together so partial lease extension cannot occur. The settlement and release RPCs now independently validate the persisted Pi receipt fields (request metadata, payment identifier, A2U direction, Testnet, recipient, exact net amount, transaction ID/verification/completion, or authoritative cancellation without a transaction) before moving the gross reservation. Ambiguous outcomes continue to retain the reservation. This is source-level hardening only: apply and test migrations on disposable PostgreSQL/Testnet before enabling execution. Mainnet remains disabled.


## v0.189.0 — Phase 5 shared Pi A2U coordination and cashback source gating

- General PI earnings, seller marketplace payouts, and PI cashback now coordinate through the same durable `gh_pi_a2u_sequence_lease` row. The earnings worker uses a namespaced `earnings:<request UUID>` lease owner and validates that shared lease in begin, heartbeat, provider-payment binding, and end operations.
- The new migration is `20261030010007_pi_a2u_shared_sequence_lane.sql` and is `REVIEW_REQUIRED`; validate lock ordering, mutual exclusion and expiry/recovery on disposable PostgreSQL before applying it.
- Cashback eligibility is now fail-closed: only the marketplace PI commission source currently proven to have an authenticated payer and verified company-revenue event is enabled. Membership, promotion, digital-service, creator-tip, refund and chargeback sources are explicitly pending until their provider settlement and compensation paths are wired and tested.
- Existing Testnet-only execution restrictions remain. This source update does not enable payout execution or Mainnet.


## v0.189.0 — Phase 6 financial reconciliation and observability

- Cross-feature reconciliation now queries both authoritative PI earnings balances and the withdrawable snapshot, validating atomic-unit values and flagging available/reserved mismatches.
- Cashback availability is no longer hardcoded: the report probes the authenticated user's authoritative cashback statement RPC and fails closed when the service or statement is unavailable/invalid.
- Read-only report now includes explicit healthy/attention/degraded status and the wallet dashboard surfaces these states.
- Charity remains segregated and non-withdrawable; PI and GHC rails remain separate.
- No financial ledger writes or new database migrations are introduced in this phase.
- Static contract checks do not establish remote database availability or live financial correctness.


## v0.191.0 — Phase 7 financial operations and treasury visibility

Added an operator-only, read-only treasury summary endpoint for the current UTC quarter (or a bounded custom window). It surfaces authoritative PI cashback liability/payout reconciliation together with open A2U review and stuck-job exceptions, and reports `healthy`, `attention`, or `degraded`. It explicitly identifies seller payables, general earnings reservations, bank settlements and GHC utility accounting as outside this snapshot rather than inventing totals. No financial mutations or database migration were introduced.

Endpoint: `GET /api/admin/treasury/summary` with `x-ghc-operator-key`. Requires `GHC_OPERATOR_RECONCILE_KEY`, `GHC_ADMIN_API_KEY`, or `GHC_A2U_ADMIN_KEY` with at least 32 bytes. Run `node scripts/check-phase7-treasury-operations.mjs`.

## v0.191.0 — Phase 7 treasury operations completion increment
- Adds a source-backed treasury aggregate RPC for revenue by currency, seller payout requests by asset, unallocated completed verified marketplace orders, PI earnings gross/fee/net reservations and settlements, PI cashback calculated/review/reserved/paid/outstanding amounts, and creator-tip payables.
- Adds durable operator investigation cases and append-only event history. Case status and notes are operational metadata only; they never mutate payment, payout, wallet, or ledger source records.
- Adds operator-protected `/admin/treasury` reporting and case-history dashboard plus read-only report and case APIs.
- Integrates the expanded report and durable case availability into the existing treasury summary health state.
- GHC utility balances remain separate from company revenue. PI/GHC amounts are not converted or combined.
- Adds migration `20261030010008_phase7_treasury_reporting_and_case_history.sql` as REVIEW_REQUIRED; it has not been applied to Testnet or production.

- Phase 7 completion dashboard: `/admin/treasury` (operator key required).


## v0.194.0 — CI security and financial regression gates

- Expands GitHub Actions source-integrity checks to run database RLS coverage, SECURITY DEFINER ACL source audit, production safety scan, Phase 15 payment recovery contracts, Phase 16 payment lifecycle contracts, and the Phase 7 treasury completion contract as explicit named CI steps.
- Keeps Node.js 24.15.0 pinned for CI and preserves the existing static, typecheck, lint, and production-build gates.
- This improves failure visibility and prevents these critical suites from being hidden only inside aggregate scripts. It does not replace deployed database ACL/RLS verification, disposable PostgreSQL concurrency tests, or authenticated Pi Testnet acceptance.


## v0.194.0 — bounded request parser runtime gate

The primary GitHub Actions workflow now runs the nine bounded JSON runtime regression cases. This closes a coverage gap where the parser test existed in the repository but was not part of the CI workflow. See `docs/UPGRADE-WORKLOG-0.194.0.md` for exact checks and release limitations.

## v0.194.0 — CI governance and commerce regression visibility

The primary CI workflow now validates its own governance assumptions and runs marketplace integrity, cross-feature wallet reconciliation, and the expanded request-boundary contract as explicit, separately visible gates. These checks are source-level regression evidence only; they do not replace disposable PostgreSQL validation, authenticated provider tests, or a successful Node 24 production build. See `docs/UPGRADE-WORKLOG-0.194.0.md`.


## v0.197.0 — marketplace Pi payment evidence binding

Marketplace order payment now requires the durable payment intent to identify the Pi provider, PI currency, marketplace purpose, exact order reference, and matching finite amount. Browser-supplied payment IDs and transaction hashes are no longer used as verification evidence; persisted identifiers come only from the server-side intent. Community PI creation-fee settlement also requires the dedicated intent purpose, provider, currency and strict community binding. The new Phase 18 source-contract suite runs in static verification and pre-build. This does not replace authenticated Pi Testnet checkout testing. See `docs/UPGRADE-WORKLOG-0.197.0.md`.


## v0.197.0 — marketplace durable RPC transport hardening

Marketplace order-store RPCs now use bounded 10-second requests and explicit no-store semantics. Empty PostgREST void responses remain supported, while non-empty malformed JSON, HTTP failures, timeouts and network errors fail closed instead of being interpreted as successful mutations. The GHC marketplace spend RPC receives the same timeout/cache protections; ambiguous spend outcomes continue to retain the payment claim for idempotent recovery. Phase 19 regression checks run in static verification and pre-build. This is source-level hardening and does not replace PostgreSQL concurrency or authenticated Testnet payment tests.

## v0.198.0 — marketplace lifecycle audit journal

Adds a database-authored append-only event journal for canonical marketplace order, payment, delivery, escrow and dispute state changes. It records before/after lifecycle state and best-effort actor context without treating browser activity as financial authority. This is audit history only: refunds, chargebacks, dispute decisions and fund settlement remain separate workflows and are not claimed as implemented. Migration is REVIEW_REQUIRED and unapplied; see `docs/UPGRADE-WORKLOG-0.198.0.md`.


### Current release

Current source release: **v0.202.0**. Phase 25 adds controlled operational workflow foundations for provider-confirmed refund recording, dispute decision evidence, approved payout-correction evidence, and transactionally locked community renewals. The migration remains REVIEW_REQUIRED and is not applied automatically.

## v0.200.0 — Phase 23 treasury and community reconciliation

Treasury reporting now adds per-asset marketplace gross, platform commission, seller net, adjustments, outstanding reservations, paid settlements and historical allocation discrepancy indicators. Community membership entitlement lifecycle changes are journaled and completed payment intents are exposed through a read-only reconciliation queue. PI and GHC payment totals remain separate. The Phase 23 migration is REVIEW_REQUIRED and unapplied; no historical payouts or entitlements are rewritten. See `docs/UPGRADE-WORKLOG-0.200.0.md`.


## v0.201.0 — Phase 24 evidence reconciliation details

Adds bounded, read-only treasury payout-allocation and community membership payment exception reports. Payout diagnostics join historical allocations to immutable seller-net snapshots and adjustments; membership diagnostics verify identity, canonical purpose/product, payment status, intent linkage and expiry. Both RPCs are service-role-only, do not mutate records, do not prove external provider settlement, and do not automatically correct payouts or grant access. Migration `20261030010013_phase24_financial_exception_detail.sql` remains REVIEW_REQUIRED. See `docs/UPGRADE-WORKLOG-0.201.0.md`.


## v0.202.0 — Phase 25 operational workflow foundations

Adds service-role-only workflow foundations tied to canonical marketplace orders, adjustment ledger, payment intents, and membership entitlements. Provider refund outcomes require trusted external verification; this migration does not call a provider. Dispute and historical payout-correction journals are immutable evidence records, not full execution APIs. Community renewal requires a completed canonical payment intent and trusted catalog/currency verification. Migration `20261030010014_phase25_operational_financial_workflows.sql` remains REVIEW_REQUIRED. See `docs/UPGRADE-WORKLOG-0.202.0.md`.

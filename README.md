## v0.105.0 Phase 16 — payment lifecycle observability

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

**Current source version:** `0.105.0`

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

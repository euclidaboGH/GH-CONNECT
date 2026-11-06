# GreenHaven / GH-CONNECT — approved product roadmap

This roadmap preserves the user's ten-phase product sequence. A source implementation is not production acceptance; each phase has separate browser/device, operational, security and infrastructure gates.

| Product phase | Scope | Current status |
|---|---|---|
| 1 | Posting, voting, curation and community | Source delivered; acceptance evidence tracked separately |
| 2 | Stories | Source delivered; runtime/privacy acceptance tracked separately |
| 3 | Marketplace | Source delivered; commerce/payment authorities remain server-side |
| 4 | Cart and checkout | Source delivered; financial acceptance remains separately gated |
| 5 | Discovery | Source delivered; ranking and privacy acceptance tracked separately |
| 6 | Profile and identity | Source delivered through 0.319.0; browser/device acceptance remains open |
| 7 | Wallet | Source implementation closed in 0.320.0; external Node 24 build, browser/device and Pi Testnet financial acceptance remain release blockers |
| 8 | Rewards | Source implementation closed in 0.323.0; Testnet migration/runtime/security acceptance remains required before production approval |
| 9 | Membership | Source implementation complete in 0.327.0; external runtime, database, Testnet, browser/device and operator acceptance remains open |
| 10 | Settings and platform performance | Active: 0.329.0 adds privacy-safe static caching and adaptive feed/story media loading; startup, navigation, settings and device acceptance continue |

## Phase 7 — Wallet completion sequence

1. Premium wallet home and asset presentation.
2. Transaction history and intelligent filtering.
3. Send, receive and withdrawal experience.
4. Pi consent and Testnet financial reconciliation.
5. Wallet performance and final release gate.

## Wallet invariants

- GHC and Pi are distinct assets and ledgers. Never aggregate them or imply a conversion rate that is not explicitly server-authorized and relevant to the transaction.
- Server-confirmed snapshots, transaction records, quotes, reservations and execution outcomes are authoritative. Local state is presentation/cache only.
- Preserve explicit Pi consent, wallet-identity matching, idempotency, rate limits, RLS, service-role isolation and fail-closed behavior.
- No client-side minting, transfer execution, payout, refund, escrow release, treasury movement, settlement or payment completion.
- Testnet and Mainnet remain separately configured. Mainnet financial execution remains disabled until independent operator approval and reconciliation evidence.
- No migration is applied from source review alone. Reconcile remote migration history and validate on disposable PostgreSQL/Testnet before any approved application.

## Previous increment — 0.320.0

The wallet withdrawal sheet now fetches its read-only Pi withdrawable snapshot with cancellation, an eight-second timeout, stale-state clearing, strict successful-response checks, finite non-negative amount validation and validated linked-identity parsing. This does not alter Pi consent, quote or withdrawal execution authority, GHC ledger behavior, or provider integrations.

## Current increment — 0.321.0

Phase 8 opens with bounded account-scoped Rewards snapshot hydration, strict server amount parsing and honest daily claim messaging. See `docs/PHASE-8-REWARDS-INTEGRITY-AND-EXPERIENCE-0.321.0.md`.


## Phase 7 — source closure record

The five Wallet source workstreams and their source-level regression contracts are closed for implementation. This is not production approval: Node 24.15.0 typecheck/build/lint, browser/device acceptance, live Pi Testnet reconciliation and independent operator sign-off remain mandatory release blockers. Mainnet financial execution remains disabled until those controls are independently satisfied.

## Phase 8 — Rewards completion sequence

1. Premium rewards home, personalized journey and transparent server-confirmed balances.
2. Daily claim reliability, idempotency, Africa/Lagos reward-day handling and streak integrity.
3. Missions, achievements, referrals and campaign opportunities with verified progress.
4. Reward history, maturity, validation and Pi cashback transparency.
5. Abuse resistance, operational reconciliation, performance and final release gate.

Rewards UI is a presentation and progression surface. Reward issuance, eligibility, claim idempotency, maturity, settlement and ledger balances remain server/database authoritative. Client-side estimates must never be presented as credited amounts. GHC and Pi remain separate assets and ledgers.


## Phase 8 — previous source increment 0.322.0

Rewards history now hydrates the authenticated GHC wallet ledger through the same-user wallet endpoint, with bounded no-store requests, account-scoped clearing, strict row validation, newest-first ordering, search and status filters. Local reward-domain records remain explicitly supplemental. Mission GHC remains fail-closed because the existing mission progress endpoint deliberately returns unavailable until durable server-side activity verification and one-time claim storage are implemented. No new reward authority or migration is introduced.


## Phase 8 — source completion record (0.323.0)

The Rewards source implementation is complete across premium balance presentation, daily claim integrity, verified mission/achievement progress, authenticated GHC ledger history, cashback separation and abuse-protection contracts. Mission completion now checks durable GreenHaven records inside a service-role-only SQL function and unlocks a non-financial achievement idempotently. The mission endpoint ignores client metadata, uses authenticated identity, bounded JSON and a durable rate limit. It never issues GHC or Pi: generic activity issuance remains disabled by the existing economy policy.

The additive migration `20261106170001_phase8_verified_mission_achievements.sql` is source-only and must be reviewed and applied to a disposable database/Testnet before mission verification becomes operational. No migration was applied in this build. Node 24.15.x typecheck/lint/build, browser/device accessibility/performance, Testnet migration and multi-user verification, and independent operator release approval remain external acceptance gates. Production approval is not implied.


## Phase 9 — Membership foundation (0.324.0)

The first Membership increment hardens authoritative entitlement parsing and status reads before extending the purchase/renewal UX. Paid VIP/VVIP rows with malformed or missing expiry now fail closed (except explicitly complimentary entitlements); invalid tier/source/period/identity/timestamp fields cannot be promoted into an entitlement. Database and client status reads are bounded, and conflicting duration aliases are rejected before payment. GHC and Pi remain separate rails. No migration or financial execution authority changed. See `docs/PHASE-9-MEMBERSHIP-FOUNDATION-0.324.0.md`.


## Phase 9 — Membership session integrity (0.325.0)

The membership screen now aborts superseded status reads, sequence-fences responses, clears prior paid status on wallet-auth changes, refreshes after session resume, and rejects malformed identity/tier/active/expiry data. The authenticated no-store server endpoint and payment authorities remain unchanged. No migration or financial execution authority changed. Full runtime and browser acceptance remain pending. See `docs/PHASE-9-MEMBERSHIP-SESSION-INTEGRITY-0.325.0.md`.


## Phase 9 — Membership lifecycle and access control (0.326.0)

The premium membership screen now renders status only from authoritative server state and shows authenticated read-only lifecycle events. Protected messaging premium products enforce catalog `requiresTier` on the server before GHC debit. The operator renewal workflow verifies the durable PI intent owner, completion, provider, currency, canonical product and catalog amount; SQL derives the calendar duration and bonus month from the product ID rather than trusting a request duration. A 72-hour continuity-only renewal window preserves the prepaid term boundary but does not grant premium access during the gap. A service-role-only lifecycle read RPC and operator-key-protected expiry sweep are added. Plans remain prepaid and non-recurring: there is no auto-renew or recurring charge to cancel. Migration `20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql` is REVIEW_REQUIRED and unapplied. See `docs/PHASE-9-MEMBERSHIP-LIFECYCLE-AND-ACCESS-CONTROL-0.326.0.md`.


## Phase 9 — strict Pi payment-intent integrity (0.327.0)

Membership activation, payment completion, fulfillment, recovery and payment-history reconciliation now require the durable intent to explicitly identify provider `pi`, currency `PI`, purpose `membership` and a `COMPLETED`/`FULFILLED` state. Missing rail discriminators fail closed. A follow-up SQL migration adds null-safe checks to the service-role-only renewal RPC and remains REVIEW_REQUIRED/unapplied. This does not change GHC purchases, catalog prices, entitlement durations, renewal policy or payment execution. See `docs/PHASE-9-MEMBERSHIP-PI-INTENT-SECURITY-0.327.0.md`.

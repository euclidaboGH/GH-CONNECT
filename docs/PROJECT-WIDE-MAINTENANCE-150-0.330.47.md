# GreenHaven Project-Wide Maintenance Programme — 15 Sections × 10 Essentials

**Baseline:** 0.330.46. **Maintenance increment:** 0.330.47. **Scope:** 150 explicit engineering targets across 15 product/system sections.

## Purpose and operating rules

This is a controlled maintenance register, not a claim that all 150 targets are already complete. Each target must be audited against source, tests and (where applicable) the live target environment. Mark an item complete only when its evidence exists. Source-level checks do not prove live Supabase, Pi provider, Vercel, PostgreSQL concurrency, mobile/browser or operator acceptance.

- Preserve canonical feature/API/database authorities; do not duplicate domain logic in UI components.
- Keep Pi and GHC ledgers and payment rails separate. No client-side minting, settlement, transfer execution, refund, payout or entitlement grants.
- No Supabase migration is applied from source review alone. Reconcile Testnet and Mainnet independently, validate on disposable PostgreSQL and obtain explicit approval.
- Fail closed for identity, permissions, financial state and unavailable authoritative dependencies.
- Every section must pass the ten essentials below before its release gate can be closed.

## The 15-section / 150-essential register

### 1. Feed

- [ ] **01.** Canonical post hydration, cursor pagination and duplicate-safe refresh across Feed and community/profile surfaces.
- [ ] **02.** Composer lifecycle for text, media upload, preview, draft recovery, audience selection and publish confirmation.
- [ ] **03.** Server-authoritative visibility, block/mute, moderation, deletion and edit permissions on every mutation path.
- [ ] **04.** Curation, reactions, saves, comments and polls wired to durable APIs with optimistic rollback on failure.
- [ ] **05.** Ranking explanations and feedback actions grounded in real signals; no fabricated trending or engagement metrics.
- [ ] **06.** Media pipeline validation for MIME, size, ownership, transcoding state, retry and safe fallback.
- [ ] **07.** Loading, stale, offline, empty, no-results, partial and error states with truthful copy.
- [ ] **08.** Accessible post cards, keyboard navigation, focus management, reduced motion and touch targets.
- [ ] **09.** Bounded queries, media prefetch budgets, cache invalidation and scroll/realtime resilience.
- [ ] **10.** Regression coverage for visibility, account switching, pagination, engagement idempotency and cross-surface parity.

### 2. Wallet

- [ ] **01.** Separate Pi and GHC assets, ledgers, units, precision and presentation; never imply conversion or combined totals.
- [ ] **02.** Authoritative available, pending, locked, reserved, withdrawable and settled values with explicit unknown states.
- [ ] **03.** Authenticated owner-scoped balance/history reads with bounded pagination and stable cursors.
- [ ] **04.** Payment, transfer, withdrawal, refund and payout actions remain server-authoritative and idempotent.
- [ ] **05.** Withdrawal PIN/step-up discovery, setup, recovery, rate limits and request-bound authorization.
- [ ] **06.** Pi reservation lifecycle reconciles available → reserved → released/settled without client balance edits.
- [ ] **07.** GHC send/receive validates recipient identity, amount precision, limits and durable transfer pairing.
- [ ] **08.** Transaction detail, fee/net breakdown, status timestamps and support evidence are consistent across surfaces.
- [ ] **09.** Offline/reconnect/account-switch behavior clears stale financial snapshots and never displays stale authority as current.
- [ ] **10.** Financial invariants, concurrent requests, duplicate submissions, reconciliation and Testnet operator gates are covered.

### 3. Rewards

- [ ] **01.** Daily claim eligibility and cooldown are read from server authority; client timers are display-only.
- [ ] **02.** 48-hour claim maturity is explicit, and redemption credits only after authoritative ledger confirmation.
- [ ] **03.** Reward sources distinguish daily claims, referrals, curation redistribution, missions and Pi cashback.
- [ ] **04.** GHC issuance is limited to approved minting sources; curation is redistribution of existing voter balances.
- [ ] **05.** Referral links are unique and attributed server-side; qualifying VIP reward is exactly 5% of approved GHC upgrade value.
- [ ] **06.** Missions expose criteria, evidence, exclusions, deadlines and server-verified completion state.
- [ ] **07.** Pending, under-review, approved, mature, redeemed, rejected and expired states remain distinct.
- [ ] **08.** Rewards history uses owner-scoped stable cursor pagination and de-duplicates refresh/append results.
- [ ] **09.** Retry, idempotency, abuse limits and failure messages cannot create duplicate claims or issuance.
- [ ] **10.** Wallet linkage, ledger reconciliation, Testnet fixtures and reward abuse regression tests are maintained.

### 4. Membership

- [ ] **01.** VIP/VVIP plan catalogue is canonical across discovery, purchase, profile, settings and renewal surfaces.
- [ ] **02.** Four term options apply consistently: 1, 4, 8 and 12 months with one bonus month and specified discounts.
- [ ] **03.** VIP baseline and VVIP price configuration are server-owned; no client-calculated charge is authoritative.
- [ ] **04.** Pi and GHC price rails share term/discount policy but preserve separate amounts and payment authorities.
- [ ] **05.** Checkout creates durable payment intents and binds user, plan, term, currency and idempotency key.
- [ ] **06.** Entitlement activation occurs only after verified payment; payment success and access grant remain separate states.
- [ ] **07.** Renewal, expiry, grace, cancellation, upgrade and downgrade are guarded against duplicate or stale transitions.
- [ ] **08.** Membership history and receipts show source currency, term, effective dates, bonus period and verified status.
- [ ] **09.** VVIP downgrade protection and session/entitlement refresh fail closed on unavailable persistence.
- [ ] **10.** Pricing arithmetic, payment-intent replay, provider receipts, migration and Testnet lifecycle tests are maintained.

### 5. Profile

- [ ] **01.** GreenHaven identity and public profile data have explicit private/public field projections.
- [ ] **02.** Owner editing uses narrow patches, server validation and safe conflict handling.
- [ ] **03.** Professional/creator/business showcase fields are normalized and sanitized before rendering.
- [ ] **04.** Portfolio, achievements and media use owned durable records rather than local-only placeholders.
- [ ] **05.** Relationship actions and counts are derived from canonical server state with viewer-specific privacy.
- [ ] **06.** Profile share links resolve to stable, safe routes and disclose only public information.
- [ ] **07.** Tabs, empty states, loading states and responsive layouts remain consistent and accessible.
- [ ] **08.** Media upload, cache, deletion and session invalidation respect ownership and privacy.
- [ ] **09.** Profile hydration does not leak hidden fields through API payloads, metadata or caches.
- [ ] **10.** Two-account privacy, account-switch, sanitizer, relationship and public projection tests are maintained.

### 6. Settings

- [ ] **01.** Settings information architecture groups account, security, privacy, notifications, preferences, performance and support.
- [ ] **02.** All controls bind to a real supported persistence path or are explicitly labelled device-local/session-only.
- [ ] **03.** Narrow partial updates prevent stale full-snapshot writes and lost concurrent changes.
- [ ] **04.** Account-scoped preferences are isolated across sign-in/sign-out and account switches.
- [ ] **05.** Device permissions (camera, location, notifications) reflect browser/OS permission state, not app toggles alone.
- [ ] **06.** Privacy, blocked/muted users, messaging and visibility controls explain their effective scope.
- [ ] **07.** Security controls expose active sessions, passkeys, step-up, PIN and recovery status accurately.
- [ ] **08.** Locale, theme, reduced motion, data saver and accessibility settings propagate across all surfaces.
- [ ] **09.** Dangerous actions require clear confirmation, reauthentication where required and recoverable feedback.
- [ ] **10.** Persistence, race conditions, permission changes, keyboard navigation and screen-reader flows are tested.

### 7. Communities

- [ ] **01.** Discovery search and filters use canonical server results and bounded pagination.
- [ ] **02.** Join, invite, pending, approval, leave and ban states are explicit and server-authoritative.
- [ ] **03.** Roles, permissions and moderation are revalidated transactionally for every privileged action.
- [ ] **04.** Community feed reuses canonical Feed cards and durable curation/reaction/save APIs.
- [ ] **05.** Chat, board, events and resources are gated by membership and per-surface privacy.
- [ ] **06.** Governance proposals, votes and moderation history state whether durability is server-backed or session-only.
- [ ] **07.** Community creation fees support only approved Pi/GHC payment intents and verified settlement.
- [ ] **08.** Member counts, unread counts, activity and sorting derive from authoritative deduplicated signals.
- [ ] **09.** Resource/event URLs, media and member content are normalized against unsafe schemes and malformed records.
- [ ] **10.** RLS, RPC grants, two-member concurrency, moderation audit and Testnet fee tests are maintained.

### 8. Messages

- [ ] **01.** Inbox prioritization, unread counts, archived lanes and conversation ordering use canonical server state.
- [ ] **02.** Conversation membership and participant identity are derived from authenticated sessions, never request bodies.
- [ ] **03.** Message send/edit/delete/reaction/read receipts are idempotent, bounded and ownership-checked.
- [ ] **04.** Drafts persist per conversation and account without leaking across account changes.
- [ ] **05.** Media attachments validate ownership, type, size, scanning/transcoding status and safe preview.
- [ ] **06.** Abuse controls apply durable fail-closed rate limits across every messaging entry point.
- [ ] **07.** Realtime reconnect, offline queue, retry and delivery status distinguish queued, accepted and delivered states.
- [ ] **08.** Block, mute, privacy, reporting and moderation policy are enforced consistently in reads and writes.
- [ ] **09.** Keyboard/touch actions, composer limits, focus order and screen-reader announcements are accessible.
- [ ] **10.** Two-account isolation, membership revocation, replay, spam, media and reconnect tests are maintained.

### 9. Marketplace

- [ ] **01.** Listings, seller identity, categories, currency and publication state are validated by server contracts.
- [ ] **02.** SKU variants have stable seller-scoped identities, prices, stock and immutable order snapshots.
- [ ] **03.** Inventory reservation, release and commit are atomic under concurrent checkout and cancellation.
- [ ] **04.** Cart lines preserve variant identity and are reconciled against current server listing/stock before checkout.
- [ ] **05.** Order currency and payment rail are determined by durable server-created order records.
- [ ] **06.** GHC and Pi checkout, fees, refunds, escrow and seller proceeds remain separate and server-authoritative.
- [ ] **07.** Seller Centre supports safe listing edits, stock changes, fulfilment and order management.
- [ ] **08.** Shipping, pickup and digital fulfilment enforce dispatch/activation and buyer receipt transitions.
- [ ] **09.** Order timeline is append-only, actor-attributed and visible only to buyer/seller participants.
- [ ] **10.** PostgreSQL concurrency, payment receipts, refund paths, SKU bypass, inventory conservation and Testnet acceptance are tested.

### 10. Filters

- [ ] **01.** Shared filter contract validates text, category, date, numeric range, location, sort and pagination inputs.
- [ ] **02.** Each surface documents supported filters and consistent inclusive/exclusive boundary semantics.
- [ ] **03.** Filter state persists only where appropriate and is scoped by account and surface.
- [ ] **04.** Sensitive/private filter values are not placed in public URLs, logs or analytics payloads.
- [ ] **05.** Marketplace and Wallet filters execute server-side before bounded pagination.
- [ ] **06.** Feed, Discovery, Communities, Messages, Rewards and Notifications avoid client-only false completeness.
- [ ] **07.** Clear-all and per-filter removal keep controls, query state and visible result counts synchronized.
- [ ] **08.** Empty, no-results, invalid-range, partial and loading states are distinct and accessible.
- [ ] **09.** Filter changes reset cursors safely and prevent stale results from overwriting newer queries.
- [ ] **10.** Cross-surface parity, URL encoding, date boundaries, account isolation and pagination regression tests are maintained.

### 11. Notifications

- [ ] **01.** In-app inbox remains server-backed with authenticated owner scoping and stable ordering.
- [ ] **02.** Critical/high/normal/low priority is explainable and derived from trusted notification attributes.
- [ ] **03.** Open, contextual Open, Mark Read, Retry and Dismiss actions have explicit persistence semantics.
- [ ] **04.** Account-level in-app preferences and account+device browser-alert preferences remain separate.
- [ ] **05.** Browser permission is read from the platform and refreshed on focus/visibility changes.
- [ ] **06.** Remote push remains disabled until vetted sender, secrets, worker, database and provider acceptance exist.
- [ ] **07.** Subscription endpoints and key material are encrypted at rest and never exposed in claim payloads/logs.
- [ ] **08.** Push payloads remain generic; private message, wallet, payment, reward and membership content is excluded.
- [ ] **09.** Provider accepted, device received and device displayed are never conflated.
- [ ] **10.** Duplicate delivery, retries, expiry, 404/410 revocation, account isolation and offline-device tests are maintained.

### 12. Discovery

- [ ] **01.** Search covers people, content, communities and marketplace with clear result-type boundaries.
- [ ] **02.** Ranking uses documented, available signals and avoids fabricated scores or popularity counts.
- [ ] **03.** Search queries are normalized, bounded, rate-limited and safe for database/full-text execution.
- [ ] **04.** Filters and sort semantics are shared with the Filters contract and applied before pagination.
- [ ] **05.** Personalization explains why results appear and respects user preferences and privacy.
- [ ] **06.** Location relevance uses verified geospatial capability; textual matching never claims radius accuracy.
- [ ] **07.** Loading, no-results, partial-source, stale and error states remain truthful.
- [ ] **08.** Search result actions deep-link to canonical detail surfaces without bypassing authorization.
- [ ] **09.** Cache keys include relevant account/privacy scope and are invalidated on relationship changes.
- [ ] **10.** Ranking relevance, privacy, pagination, abuse controls and multilingual search are tested.

### 13. Matching

- [ ] **01.** Match eligibility is derived from verified profile and user preference constraints.
- [ ] **02.** Discovery/matching filters respect age, location, visibility, block and safety exclusions.
- [ ] **03.** Connection requests and accept/decline flows use durable state and idempotent transitions.
- [ ] **04.** No match, pending, accepted, blocked and expired states are distinct in UI and API.
- [ ] **05.** Ranking and recommendations disclose supported reasons without exposing sensitive hidden attributes.
- [ ] **06.** Rate limits and abuse controls cover request creation, repeated actions and automated scraping.
- [ ] **07.** Profile and relationship caches invalidate on block, privacy or relationship changes.
- [ ] **08.** Location and personal preference data are minimized and never leaked into public result payloads.
- [ ] **09.** Accessible card actions, keyboard navigation and responsive layouts are maintained.
- [ ] **10.** Two-account matching, block/mute exclusions, duplicate requests and privacy regressions are tested.

### 14. Payments

- [ ] **01.** Pi platform payments and GHC utility payments use separate explicit contracts and ledgers.
- [ ] **02.** Every payment begins with a server-created intent bound to owner, purpose, amount, currency and idempotency key.
- [ ] **03.** Provider callbacks/receipts are verified server-side and replay-protected before settlement.
- [ ] **04.** Payment accepted, provider-completed, entitlement granted and ledger-posted are distinct states.
- [ ] **05.** Refund, cancellation, expiry, recovery and reconciliation are explicit durable workflows.
- [ ] **06.** No client route or UI state can mint, transfer, settle, refund or mark payment complete.
- [ ] **07.** Fees, net amounts, rounding and atomic precision are consistent between quote, UI and database.
- [ ] **08.** Timeout/unknown outcomes direct users to recovery/status checks rather than blind resubmission.
- [ ] **09.** Durable rate limits, audit trails, service-role RPC grants and secret handling are enforced.
- [ ] **10.** Provider sandbox/Testnet, replay, concurrency, conservation, exception queues and operator sign-off are tested.

### 15. Identity & Authentication

- [ ] **01.** Pi identity verification and GreenHaven account mapping are server-verified and immutable where required.
- [ ] **02.** Sessions use secure cookies/tokens, expiry, revocation and account-switch invalidation.
- [ ] **03.** Registration, sign-in, callback and onboarding handle replay, interruption and partial completion safely.
- [ ] **04.** Passkeys/WebAuthn and step-up flows validate challenge, origin, RP ID, user and credential ownership.
- [ ] **05.** Public GreenHaven ID, private account identifiers and provider identifiers remain distinct.
- [ ] **06.** Profile and identity projections expose only fields permitted for the viewer and visibility policy.
- [ ] **07.** Authentication errors are user-safe and do not reveal account existence or internal infrastructure details.
- [ ] **08.** Recovery, session management and sensitive changes require the appropriate proof and audit trail.
- [ ] **09.** Rate limits, abuse detection, CSRF/origin protections and secure cookie policy are consistently applied.
- [ ] **10.** Two-account isolation, revoked sessions, invalid provider tokens, replay and device/browser acceptance are tested.

## Programme execution order

1. **Audit and baseline:** map each section to its canonical screen, feature module, API routes, server services, SQL/RPC contracts, migrations and tests.
2. **P0 reliability and security:** repair verified defects in auth, privacy, financial authority, ownership, idempotency, rate limits and data integrity.
3. **Feature wiring:** close UI → API → service → database → refresh/realtime → error/recovery loops without introducing parallel authorities.
4. **Experience and accessibility:** unify loading/empty/error/offline states, responsive behavior, keyboard/touch access and truthful status copy.
5. **Performance and resilience:** bound queries/payloads, stabilize cursors, prevent stale races, handle reconnects and instrument actionable failures.
6. **Acceptance:** run targeted regression suites, Node 24.15.x typecheck/lint/build, browser/mobile/screen-reader tests, PostgreSQL concurrency, Testnet/Mainnet reconciliation and operator sign-off as applicable.

## Current inspection evidence (0.330.47)

- The source contains dedicated feature domains for Feed, Wallet, Rewards, Membership, Profile, Communities, Messaging, Marketplace, Discovery, Matching, Notifications, Payments and Identity, with Settings implemented in the shared GHC UI and settings infrastructure.
- The repository contains 229 API route files and 196 canonical SQL migration files. The migration manifest is repository inventory only; it does not establish remote application state.
- The broad source regression chain passed after correcting one stale Wallet source-contract expectation (`held for` → the current, accurate `held against Pi withdrawal requests`). This was a test expectation correction; no wallet ledger or payout behavior was changed.
- The full npm prebuild cannot complete in this environment because only Node 22.16.0 is installed while `.nvmrc` and package engines require Node 24.15.0. The runtime gate remains intact.
- `node_modules` is absent; dependency-backed TypeScript, ESLint and Next.js production build were not run. No live Supabase, PostgreSQL, Pi provider or deployed-device acceptance is claimed.
- Phase 11 remote Web Push remains disabled pending vetted sender integration, deployment secrets, scheduled worker, approved database schema and real device/provider acceptance.

## Release decision

**Production remains NOT APPROVED.** The 150 essentials are the maintenance target register. Each section will be closed in controlled implementation increments with evidence and explicit external acceptance gates; this document does not convert planned work into a completion claim.

## Canonical source ownership map

| Section | Domain / shared implementation | Main API families (source routes) |
|---|---|---|
| Feed | `features/feed`; `components/ghc/enhanced-feed-screen.tsx`, `enhanced-post-card.tsx`, `unified-compose.tsx` | `app/api/social/feed`, `posts`, `stories`, `short-video`, `engagement`, `reports` |
| Wallet | `features/wallet`; `components/ghc/premium-wallet-screen.tsx`, `wallet-balance.tsx`, `pi-withdraw-sheet.tsx` | `app/api/economy/wallet`, `ledger`, `earnings`, `withdrawals`, `identity/withdrawal-pin`, `identity/wallet-authorization` |
| Rewards | `features/rewards`; `components/ghc/rewards-centre-screen.tsx`, `daily-reward-experience.tsx` | `app/api/economy/rewards`, `missions`, `notifications`, `referral`, `economy/ledger` |
| Membership | `features/membership`; `components/ghc/premium-membership-screen.tsx` | `app/api/membership`, `payments/intents`, `payments/complete`, `payments/recovery` |
| Profile | `features/profile`; `components/ghc/profile-screen.tsx`, `profile-hero.tsx`, `profile-professional-showcase.tsx` | `app/api/profile`, `app/api/social/profile`, `app/api/social/people`, `app/api/connections` |
| Settings | `components/ghc/settings.tsx`; `lib/i18n`, `lib/ux`, settings persistence helpers | `app/api/notifications/preferences`, `app/api/messaging/preferences`, `app/api/auth/sessions`, `app/api/security` |
| Communities | `features/communities`; `components/ghc/communities-screen.tsx`, `premium-community-hub.tsx` | `app/api/communities`, `app/api/governance`, `app/api/communities/create-fee` |
| Messages | `features/messaging`; `components/ghc/messages-screen.tsx`, `chat-screen.tsx`, `message-screen.tsx` | `app/api/messaging`, `app/api/messaging/conversations`, `app/api/messaging/preferences` |
| Marketplace | `features/marketplace`; `components/ghc/marketplace-screen.tsx` | `app/api/marketplace`, `app/api/marketplace/listings`, `orders`, `payouts`, `payments/orders` |
| Filters | `lib/filtering`; shared filter contracts and active-filter UI | Server filters are integrated in `app/api/marketplace`, `app/api/economy/ledger`, `app/api/communities` and social search APIs |
| Notifications | `features/notifications`; `components/ghc/notification-bell.tsx`, `public/sw.js` | `app/api/notifications`, `app/api/notifications/preferences`, `app/api/notifications/push` |
| Discovery | `features/discovery`; `components/ghc/discovery-grid-screen.tsx`, `find-screen.tsx` | `app/api/social/search`, `app/api/social/people`, `app/api/communities` |
| Matching | `features/matching`; `components/ghc/match-screen.tsx`, `matches-screen.tsx` | `app/api/matching`, `app/api/connections` |
| Payments | `features/payments`; `components/ghc/gh-pay-panel.tsx`, `unified-earnings-dashboard.tsx` | `app/api/payments`, `app/api/pi`, `app/api/webhooks`, `app/api/economy/earnings` |
| Identity & Authentication | `features/auth`, `features/identity`; `components/auth/sign-in-with-pi-button.tsx`, `components/ghc/greenhaven-identity-card.tsx`, `passkeys-panel.tsx` | `app/api/auth`, `app/api/identity`, `app/api/profile/me`, `app/api/verification` |

These are ownership starting points, not an exhaustive list of consumers. Before changing a contract, search all callers and shared adapters; a section must not introduce a parallel source of truth.

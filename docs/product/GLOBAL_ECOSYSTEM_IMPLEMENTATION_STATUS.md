# GreenHaven Global Ecosystem — Implementation Status

**Status:** Broad implementation pass completed in source; **not launch-certified**. This is not a claim that all 140 blueprint items are fully shipped or live-verified.

## Implemented in this source pass

### Shared events, policy and operations
- Versioned durable outbox with unique idempotency keys, row-locked claims, lease recovery, retry backoff, consumer receipts and a secret-protected dispatcher endpoint.
- Transactional outbox emission for curation feedback, marketplace order transitions, progression awards, referral qualification, review publication and posted GHC ledger rows.
- Seeded server-only ecosystem policy registry and environment kill switches for reward issuance, ranking personalization, progression awards, marketplace order/payment creation and event dispatch.
- Operations RPC for a ledger reconciliation summary and negative-balance alert indication.

### Rewards and wallet
- Auditable reward risk-hold records for suspicious/velocity/self-dealing patterns, plus authenticated user hold history and reward appeal submission.
- Authenticated wallet CSV export with spreadsheet formula-injection mitigation.
- Wallet UI surfaces risk holds and lets users submit/track reward appeals; appeal status alone does not release funds.
- Posted ledger entries produce transactional provenance events; existing ledger remains the financial authority.
- GHC marketplace refunds use an append-only, linked reversal transaction, and are allowed only for a disputed GHC order. No status-only refund is allowed.

### Ranking and discovery
- Defensive client ranking eligibility checks for deleted/removed, blocked, muted, private, follower-only, friend-only and community-only posts.
- Versioned For You ranking and bounded author/topic diversity reranking.
- Durable `hide`, `show_less`, `show_more` preferences remain applied only after server hard-eligibility filtering; the local hide list now only treats `hide` as hide.
- Server feed and post-search RPCs now enforce public/follower/mutual visibility, block checks and viewer mute checks.
- Bounded ranking impression telemetry endpoint; it is analytics only and never awards value.

### Progression
- Server-only, idempotent XP award RPC and read API; public clients cannot submit XP amounts or event claims.
- One-time profile-completion and first-original-post milestones are wired after successful server writes.
- Completed verified marketplace orders can award small buyer/seller XP, capped at three such events per user per UTC day and within a 100-XP daily cap.
- XP is distinct from GHC, membership, reputation and trust privileges.
- Profile UI shows server-derived level, XP progress, recent milestones and next-level progress.

### Growth
- Authenticated referral-code creation and registration; self-referrals and multiple referral claims per referred user are rejected.
- Referral status dashboard separates pending/qualified/paid/rejected/appealed.
- Qualification only runs through service-role code after a server-verified profile, original post or completed marketplace order. Monetary referral payouts are deliberately disabled by default.

### Reputation and trust
- Contextual trust dimensions (`helpfulness`, `reliability`, `safety`, `expertise`, `transaction_trust`) with append-only source provenance; dimensions do not grant privileges by default.
- Authenticated reputation appeal submission/history and reviewer allowlist with conflict-of-interest protection.
- Profile UI shows separate trust dimensions and appeal status, with an appeal form.
- Marketplace reviews require a buyer on a completed, verified-payment order, are unique per buyer/order and remain blind for seven days before publication; seller transaction trust changes only at publication.
- Seller trust/read models do not expose private reports or reporter identity.

### Marketplace
- Finite stock must be reserved through a database row-lock RPC; an environment flag alone cannot enable unsafe checkout.
- Reservation expiry/release and payment-time validation; reservations on payment-verified orders are never automatically released.
- Order creation accepts a buyer-bound `Idempotency-Key`; same key with different listing/quantity is rejected.
- GHC payment is one SQL transaction across the GHC ledger spend, inventory reservation commit, order confirmation and outbox events.
- Pi finalization locks and verifies the durable provider intent's buyer, purpose, exact order reference, amount, currency and completed state, then commits stock/order/intent together.
- Compare-and-transition RPC prevents concurrent order-state lost updates; paid cancellation and status-only refunds are blocked.
- Disputed GHC orders have a ledger-linked refund route; Pi refunds remain blocked until a provider-verified refund workflow is implemented.
- Marketplace listing metadata and query/category/kind/currency/price/availability/condition/location/delivery facets, listing reporting/moderation, verified review reads, seller analytics and checkout rate limits.

## Important limitations that remain

- Migration `20261024_gh_global_ecosystem_hardening.sql` is **not applied** to Testnet or Mainnet. Review local/remote migration histories and schema before applying; do not blindly push.
- TypeScript, lint and production build were not run because dependencies are unavailable in this workspace. Static scripts do not replace those checks.
- No live Supabase, Pi Browser/provider sandbox, wallet concurrency, stock concurrency, multi-instance, accessibility, privacy or load test was run.
- The outbox dispatcher persists receipts for known contracts; it is not a substitute for every future external integration, alert delivery, support queue or payment-provider webhook consumer. Unknown contracts are retried, not dropped.
- The policy registry is seeded but runtime switches currently use environment variables; a policy-admin UI/audited policy editing workflow is not implemented.
- Reward appeals record review status but do not automatically release a reward hold or reverse arbitrary reward ledger entries. A status change alone never changes a balance.
- Generic non-marketplace reward reversals, payout/provider reconciliation, jurisdiction-specific withdrawal eligibility, complete issuance alerts and automated support/on-call alert delivery still require dedicated implementation and testing.
- Progression awards are intentionally limited to profile completion, first original post and verified completed marketplace orders; all other blueprint event types need their own verified producer integration.
- Referral payout is disabled. Sybil/duplicate-account detection requires privacy-reviewed, server-side evidence and human review; no covert fingerprinting is used.
- Ranking hard-filter coverage is improved for the primary feed and post search, but every story, repost, recommendation, notification preview and community surface must still be audited against the same contract.
- Marketplace refunds for Pi, returns, partial refunds, chargebacks, escrow, seller payouts, delivery tracking and full buyer/seller dispute operations remain disabled or incomplete. Do not represent them as available.
- Listing moderation reports are persisted, but full moderator queue, policy enforcement automation and prohibited-goods review are not yet shipped.

## Release gates

1. Install dependencies using the lockfile; run `npm run typecheck`, `npm run lint`, `npm run test:safety`, `npm run test:curation-preferences`, `npm run test:global-ecosystem`, and `npm run build`.
2. Review the new migration against both Testnet and Mainnet before applying it; confirm every referenced existing table/function and role grant.
3. Test concurrent order creation with identical/different idempotency keys, finite-stock races, payment retries, reservation expiry, and failed persistence recovery.
4. Test GHC spend + inventory + order atomic rollback; test Pi intent mismatch, provider status mismatch, duplicate completion and missing reservation.
5. Test GHC refund ledger reversal on disputed orders; confirm Pi refund stays rejected until a provider workflow exists.
6. Exercise referral self/duplicate/qualification paths, reviewer conflict-of-interest, appeal status transitions and trust review publication.
7. Configure `GHC_DOMAIN_EVENT_CRON_SECRET` (or `CRON_SECRET`) and schedule `POST /api/internal/domain-events/dispatch`; observe retries, stuck events, expired reservations and delayed reviews.
8. Verify the environment kill switches in a staging deploy before production: `GHC_REWARDS_PAUSED`, `GHC_RANKING_PAUSED`, `GHC_PROGRESSION_PAUSED`, `GH_MARKETPLACE_PAUSED`, `GHC_DOMAIN_EVENTS_PAUSED`.
9. Run Pi Browser sandbox E2E, database migration reconciliation, accessibility/security review, and multi-instance concurrency tests before enabling public marketplace traffic.

## Cross-surface review follow-up — 2026-10-12

### Implemented: app-wide canonical post/story composer host

- Added `components/ghc/global-compose-host.tsx` and mounted it once in the app shell.
- The host owns `ghc:open-compose` and passes the requested post/story mode into the existing `PostComposer` / `UnifiedCompose` pipeline.
- Removed the feed screen's local composer state and event listener. The feed no longer needs to be the mounted event owner for a create action launched from Profile or Discover.
- The global host closes on the existing tab-change, close-compose, and close-transient-ui events and removes listeners on unmount.
- Added `npm run test:global-compose-host` with 7 static regression checks.

### Scope and known limitations

- The separate profile story-creation UI remains in `profile-story-section.tsx`; this pass does not claim that all story entry points now share one implementation.
- The `attach: photo` / `attach: video` event detail emitted by some launchers is not yet acted on by the unified composer. A future change should provide a user-gesture-safe attachment chooser rather than relying on a delayed synthetic file-picker click.
- Upload types and sizes remain subject to the existing media validation and storage limits. “Any type, any size” should not mean unbounded uploads.
- The new host was checked with static tests and the repository's existing release suites. Full TypeScript, lint, build, browser interaction, and live backend checks still require operator verification.

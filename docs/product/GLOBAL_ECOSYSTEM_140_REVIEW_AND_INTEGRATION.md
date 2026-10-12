# GreenHaven Global Ecosystem — 140-point review and integration report

**Review date:** 2026-10-11  
**Scope:** rewards/wallet, curation, ranking/discovery, levels/progression, growth, reputation/trust, marketplace/commerce.  
**Status:** code and static review of the available GH-CONNECT workspace. This is not a production certification.

## Executive review

The 140-point blueprint is directionally coherent, but it mixes existing safeguards, partially wired features, proposed capabilities, and launch gates. Those must not be treated as equivalent. The source already has server-side reward routes, server-side curation vote RPCs, ranking helpers, reputation event verification, trust dimensions, marketplace listing/order APIs, and fail-closed protection for finite-stock order creation when atomic reservation is not enabled. It does **not** follow that every corresponding product capability is complete or durable end-to-end.

### New implementation in this update

- Added `POST/GET /api/social/curation-preferences` using the authenticated server actor, rate limiting, server-side validation, and service-role RPC calls.
- Added `gh_post_curation_feedback` durable storage and restricted RPCs in `20261023_gh_post_curation_feedback.sql`.
- Wired the feed to load persisted feedback and to save a hide preference before removing a post locally. Failure now reports failure instead of claiming the preference was saved.
- Changed the menu wording from “show me less like this” to “hide this post” because the implemented, durable behaviour is post-specific; it does not yet infer topic/semantic similarity.
- Explicitly kept feed feedback separate from curation votes, XP, reputation, and GHC rewards.

**Migration dependency:** the preference API returns unavailable until `20261023_gh_post_curation_feedback.sql` has been reviewed and applied to the relevant Supabase environment. Do not push it blindly to Testnet or Mainnet; reconcile migration history first.

## Cross-area agreement rules

1. **GHC and Pi are distinct rails.** GHC balances/rewards must use the economy ledger; Pi payment status must be verified against durable payment intents/provider evidence. Neither can be derived from a UI display value.
2. **Membership, XP, reputation, and trust are distinct axes.** Membership is entitlement; XP/level is progression; reputation/trust is evidence-based standing. A paid tier or wallet balance must not buy trust or moderation immunity.
3. **Curation feedback is not a curation vote.** “Hide this post” is a personal feed preference; up/downvote is a quality judgment; only the server’s settlement workflow can determine reward eligibility.
4. **Ranking is downstream of hard safety filters.** Blocks, private/audience-restricted content, deleted posts, moderation holds, and account restrictions must be applied before ranking; a score can never override those rules.
5. **Marketplace seller reputation is evidence, not a guarantee.** Completed eligible orders and reviewed disputes may inform trust, but a badge must not promise safety or escrow unless those services actually exist.
6. **Growth incentives must not self-finance through loops.** Referral, engagement, XP, reputation, and rewards must use separate event IDs, idempotency, per-actor caps, and provenance; one action must not be counted repeatedly across all systems without explicit policy.
7. **No client authority.** Client-provided user IDs, balances, XP, reputation, prices, payment statuses, vote weights, and eligibility flags are advisory/untrusted.
8. **Atomicity boundaries must be explicit.** Where a workflow requires multiple database effects, use one transaction/RPC or a durable outbox/saga with compensation; sequential API calls can partially succeed.

## Existing source findings and gaps

| Area | Existing implementation observed | Remaining gap / launch gate |
|---|---|---|
| Rewards and wallet | Daily claim/reward APIs, wallet UI, economy server modules and atomic claim migration family | Verify ledger invariants and idempotency against the live schema; run duplicate/concurrent claim, reversal, and reconciliation tests; prove all visible balances derive from authoritative server reads. |
| Curation | Authenticated vote API, server RPC, rate limiting, server-derived GHPV vote weight | Vote write and weighted-record write are separate RPCs; assess partial-write recovery/idempotency. New feed preferences require the new migration before use. |
| Feed ranking | Feed ranking and discovery ranking modules with contribution and relationship signals | Prove privacy/block filters are upstream on every feed/search/story/repost route; add deterministic diversity/freshness/abuse tests and explainability checks. |
| Levels and progression | Separate reward-level XP constants and reputation level thresholds; server reputation event config/proof | Some level/streak helpers retain browser storage for UX. Ensure no client-stored XP, device clock, or display multiplier authorizes value or privileges. Keep tier perks and monetary reward multipliers server-controlled. |
| Growth | Referral/reward-related domain code and onboarding flows exist | Need cross-account attribution, referral abuse caps, cohort metrics, consent/opt-out where appropriate, and idempotent qualification tied to verified milestones. |
| Reputation and trust | Server reputation store/proof modules plus trust evidence helpers | `lib/trust/trust-dimensions.ts` stores evidence in browser localStorage and must remain advisory/demo-only; it is not a durable server trust ledger. Gate all consequential decisions on server-side verified evidence. |
| Marketplace | Server listing/order APIs, seller ownership check, authoritative listing price, payment-intent fee verification, and production fail-closed stock reservation guard | `GH_MARKETPLACE_ATOMIC_RESERVE=1` is not proof an atomic reserve RPC exists or is deployed. Do not enable finite-stock production checkout until migration, RPC and concurrency tests are verified. Audit order transitions, refunds, dispute flows and fulfillment idempotency. |

## Conflicts resolved in the implementation

- **Feed preference vs reward signal:** preference writes do not create votes or reward events.
- **“Less like this” vs exact behaviour:** UI says “Hide this post” because only the exact post is excluded. Topic-level “show less” remains a separate feature requiring topic/tag preference storage and server-side retrieval integration.
- **Best-effort local state vs durable state:** local feed state is updated only after a successful server response; on failure, the user sees an error and the preference is not falsely claimed as saved.
- **Server failure behaviour:** missing DB configuration is fail-closed for persistence (503), not a fake success.

## Required validation before merge/release

- [ ] Review migration order/history in both Testnet and Mainnet before applying the new migration.
- [ ] Run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run test:safety`, `npm run test:release`, and `npm run build` in a complete environment.
- [ ] Add integration tests for curation preference auth, invalid inputs, own-post rejection, block relationships, repeat upsert, GET isolation, DB-down behaviour, and persistence across sessions.
- [ ] Verify Supabase function grants and RLS with anon/authenticated/service-role test identities.
- [ ] Test concurrent order reservations and payment webhook retries before enabling marketplace checkout for finite inventory.
- [ ] Test duplicate/replayed reward events, negative/reversal ledger entries, simultaneous claims and payout idempotency.
- [ ] Confirm all production trust and progression decisions read server-owned state; browser localStorage remains non-authoritative.
- [ ] Validate all privacy filters across feed, discovery, stories, search, reposts, and marketplace recommendations.
- [ ] Configure alerting/runbooks for ledger imbalance, payment mismatch, preference persistence errors, stuck orders, abuse spikes, and migration failures.

## Release status

The new preference feature is implemented in source but remains **migration-gated and unverified against live Supabase**. The existing source review identified high-priority architecture gaps above. A passing static script suite alone is not evidence that the system is production-ready. No live payment, database, load, or deployment result is claimed by this report.

## Follow-up implementation pass

The follow-up pass completed additional curation integration in source:

- `/api/social/feed` now loads durable feedback server-side after the database feed RPC's eligibility/privacy filtering. `hide` excludes a post; `show_more` and `show_less` reorder eligible posts without overriding upstream privacy, block, moderation, or audience restrictions.
- The client writes the explicit `hide` preference for the “Hide this post” action, rather than recording `show_less` and treating it as a hide.
- Added authenticated, rate-limited `DELETE /api/social/curation-preferences` to reset only personal feedback; it does not touch quality votes, rewards, content, or account data. Settings now exposes this control and clears the current in-memory hidden list after a successful reset.
- Added a server-only `gh_domain_event_outbox` table and writes `curation.feedback_recorded` in the same SQL transaction as a preference update. Events are versioned and keyed idempotently. This is an outbox foundation, not a claim that every domain emits events or that a production consumer/worker is deployed.
- Expanded `scripts/test-curation-preferences-static.mjs` to 20 static checks across API authorization, feed application, reset behavior, and outbox constraints.

## Remaining implementation boundary

The seven-domain blueprint is not fully implemented by this follow-up. Specifically, the shared outbox still needs a safe consumer/worker and producers for other domains; the new migration must be reconciled/applied to each target database; end-to-end and concurrency tests must run against real Supabase environments; and remaining ranking, progression, growth, reputation, wallet and marketplace gaps listed above remain release gates. The static tests do not prove SQL execution, runtime behavior, type correctness, or production readiness.

## 2026-10-11 broad cross-domain implementation pass

The source now includes the additive migration `20261024_gh_global_ecosystem_hardening.sql` plus server routes/helpers for referral registration and qualification, XP milestones, trust dimensions, reward holds/appeals, wallet CSV export, ranking impression telemetry, marketplace listing reports/reviews/seller analytics, atomic stock reservation and payment finalization, and a protected outbox dispatcher. See `docs/product/GLOBAL_ECOSYSTEM_IMPLEMENTATION_STATUS.md` and `docs/operations/GLOBAL_ECOSYSTEM_ROLLOUT.md` for implementation boundaries and release gates.

Important non-claims: this is not proof that every item in the 140-item blueprint is shipped, nor that the migration has been applied. Referral payout is disabled; Pi refund is disabled; the outbox consumer currently records durable receipts for known event contracts rather than completing every possible external integration; generic reward ledger reversals and automatic hold release are not implemented. Testnet/Mainnet schema reconciliation, TypeScript/lint/build, Pi Browser E2E, and multi-instance concurrency tests remain required.

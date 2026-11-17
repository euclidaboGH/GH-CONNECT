# GH-CONNECT Product Overhaul — Initial Engineering Audit

**Baseline:** 0.315.4, derived exclusively from the 0.315.3 Phase 28 source archive plus the additive correction documented in this release.
**Date:** 2026-11-06
**Status:** In progress; not a production approval.

## Confirmed source-level findings

### Posting and curation

1. `POST /api/social/posts/[id]/curation` requires session identity, rate limiting, a server-derived vote weight and the atomic `gh_post_curation_set_with_reward` RPC. Client-provided identity, reputation, power and balance are stripped/ignored.
2. `resolveWeightedVote` fails closed unless a durable `gh_reputation_intelligence` row exists and is no more than 24 hours old. This is an intentional trust boundary, but it makes successful snapshot refresh a hard dependency for voting.
3. The original `gh_reputation_intelligence_refresh` SQL function attempted `RETURNING id` from `gh_reputation_intelligence`, whose declared primary key is `user_id` and which has no `id` column. The refresh could therefore fail at runtime.
4. The same function used plain `SELECT ... INTO` for reputation and calibration. For a user with no matching row, PL/pgSQL sets target variables to NULL, overwriting the initialized defaults; the subsequent NOT NULL intelligence insert can fail.
5. Migration `20261106080001_gh_reputation_intelligence_refresh_recovery.sql` corrects both defects without changing curation weights, GHC issuance, wallet balances, RLS, or service-role grants. It is held `REVIEW_REQUIRED` until disposable PostgreSQL and Testnet checks pass.
6. The self-curation policy is inconsistent across historical migrations: `20261022010074` rejects it, `20261022010075` allows display-only self-curation, and `20261023030002` rejects it again in preflight. Product policy must be explicitly settled and made consistent; do not count self-curation as independent evidence or reward eligibility.
7. Feed cards and Profile cards reuse `EnhancedPostCard`. Community Board currently has a separate legacy curation handler and data model; local/legacy IDs are explicitly not linked to the canonical social curation ledger. A safe shared-card migration requires canonical post identity and a deliberate conversion/compatibility plan rather than rendering fake working controls.
8. The feed hydrates engagement through `gh_post_feed_engagement_batch`; missing/unavailable batch RPC causes a non-durable empty feed response. Testnet must confirm the deployed RPC signature and returned fields (`viewerCurationChoice`, `upvoteCount`, `downvoteCount`).

### Stories

- `profile-story-section.tsx` is a large combined viewer/composer/state surface. Story publish/view/reaction APIs are server-backed, but seen markers and highlights are local-device state. The requested rebuild should separate story rail, viewer, composer and highlight management while retaining audience/privacy/media authorization contracts.

### Marketplace and cart

- Marketplace UI is a large single screen (`marketplace-screen.tsx`, 3,134 lines). Existing source contains domain-boundary mapping, durable order state, payment binding, inventory reservation and retry-stable idempotency work. The UX refactor must not collapse seller order, buyer order, payment intent, reservation, payout or fulfilment states into one client-owned state.
- Cart timeout handling already acknowledges that earlier line orders may have been created or paid. Cross-rail atomic cart checkout and durable checkout-session recovery remain distinct integrity gaps; no claim of atomic multi-order checkout is made.

### Wallet and rewards

- Wallet and Pi rails remain separate. Wallet authorization requires explicit literal consent, fresh Pi proof, verified identity mapping and quote-bound confirmation. Rewards are distinct from spendable wallet balances.
- Financial balances, payout state and reward eligibility must remain server-authoritative. No visual refresh may create or imply funds, successful claims, completed payments or enabled withdrawals.

### Profile, discovery, membership and settings

- Discovery has dedicated screen/domain code; presence must remain server-truthful and no client-generated last-seen claims should be introduced.
- Membership activation and status are durable API boundaries. Premium entitlement display must be derived from verified server state.
- Settings includes privacy and account controls; account export/deletion request workflows require step-up and do not claim immediate erasure.

## Current verification facts

- Baseline `verify:static` passed before this corrective patch.
- Targeted curation refresh source regression passes 10/10.
- Migration manifest, generated apply order, Phase 23 migration integrity and Phase 24 release review pass after adding the held migration.
- Full `verify:static` must be rerun after worklog synchronization.
- Runtime is Node 22.16.0 in the audit container; package engine is `^24.15.0`. Typecheck, lint and Next production build are not verified here because dependencies are not installed and the supported runtime is unavailable.
- No live Supabase, Testnet, Mainnet, Pi provider, Vercel environment or production user data was accessed.

## Implementation sequence

1. **Integrity first:** curation refresh repair, curation RPC and vote hydration, community canonical post identity, two-account authorization and concurrency tests.
2. **Social UX:** shared post-card contract across Feed/Profile/Community, coherent vote/reaction/comment/share/save states, story viewer/composer separation and accessibility.
3. **Commerce UX:** marketplace browse/detail/seller journeys, cart and checkout recovery, trust signals and order-state transparency.
4. **Identity and discovery:** profile identity/content library, discovery relevance/filtering and truthful presence.
5. **Economy and account:** wallet/rewards reconciliation, membership entitlement states, privacy/settings completeness.
6. **Release gates:** supported Node 24 CI, browser/device acceptance, Testnet migration reconciliation, two-account tests, payment/provider verification and independent Mainnet review.

The requested ten feature additions per area are to be designed as a prioritized backlog and implemented only where each feature has a real data contract, permission model, measurable user value and test coverage. They are not a reason to add decorative or nonfunctional controls.

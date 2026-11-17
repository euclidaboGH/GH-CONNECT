# Phase 2 — Premium Social Engagement and Interaction

**Baseline:** `GREENHAVEN-0.338.67-RUN304-FILTER-SEARCH-ENV-HYGIENE.zip`  
**Work date:** 14 November 2026

## Surgical improvement delivered

The authenticated post-reaction route previously hydrated reaction counts by reading `gh_post_reactions` directly through PostgREST with a fixed `limit=5000`. On popular posts, this could silently under-count reactions after the first 5,000 rows. It also duplicated aggregation logic in the API layer.

The route now uses the existing `gh_post_feed_engagement_batch` service-role RPC for a single requested post and the authenticated viewer. That canonical RPC aggregates the full reaction set for the requested post, returns reaction counts and viewer selections, and is already defined in `20261023040003_gh_feed_engagement_batch_v2.sql`. The API validates aggregate counts as non-negative safe integers and filters viewer reactions through the durable reaction allowlist. Aggregate hydration remains best-effort after a successful reaction mutation, so a read-side issue does not turn a committed reaction into a false mutation failure.

No schema change or new migration was added. No direct client table access was introduced. The change does not touch GHC balances, issuance, rewards, Pi payments, checkout, settlement, or payouts.

## Regression coverage

Added `scripts/check-phase2-reaction-aggregate-bounds.mjs` and registered it in `check:phase2-reaction-aggregate` and `prebuild:checks`.

Verified source checks:

- Reaction summary uses the canonical batch aggregate RPC.
- Aggregate is scoped to one post and the authenticated viewer.
- The fixed 5,000-row PostgREST scan is removed.
- Returned aggregates are matched to the requested post.
- Counts accept only non-negative safe integers.
- Viewer reaction state is validated against the durable reaction allowlist.
- The SQL aggregate counts all reaction rows for requested post IDs.
- The RPC remains service-role-only.

## Verification executed

- Phase 2 reaction aggregate bounds: **8/8**
- Phase 17 social engagement journey: **19/19**
- Run #266 social post experience: **14/14**
- Run #271 social publishing integrity: **42/42**
- Run #272 feed/profile integrity: **48/48**
- Phase 7 social experience: **24/24**

These are static/source contract checks, not a production build or live Testnet acceptance. Runtime validation is still blocked by the project Node engine requirement (`^24.15.0`); the available environment is Node `22.16.0`. No full TypeScript/lint/build run or two-account/multi-device live E2E was claimed.

## Additional Phase 2 interaction-feedback slice

- The shared post renderer now labels the tray **Social reaction** and explicitly distinguishes it from quality votes.
- Social reaction submission exposes an accessible pending state, disables duplicate taps while a mutation is in flight, and closes the tray only when the callback reports success. A failed or non-durable mutation leaves the tray open for retry.
- The context reaction API now returns an explicit boolean result: `true` only after a durable mutation and state/event reconciliation, `false` on failed/non-durable paths. Community reaction handling applies the same durable-success contract.
- Added `scripts/check-phase2-social-reaction-feedback.mjs`, registered as an explicit npm check and in the existing prebuild contract chain.
- This slice does not couple reactions to GHC rewards or curation votes and adds no schema/migration changes.

## Verification added in this delivery

- Phase 2 reaction-feedback contract: **10/10 passed**.
- Phase 2 reaction aggregate bounds: **8/8 passed**.
- Run #266 shared social post experience: **14/14 passed**.
- Phase 1 social foundation: **12/12 passed**.
- Phase 7 social experience: **24/24 passed**.

These remain source/static checks; no TypeScript build, browser test, live Testnet interaction, or two-account run has been completed here.

## Remaining Phase 2 work

1. Run the full social journey with two authenticated Testnet accounts and separate devices/browsers: react/unreact, comments/replies, mentions, share, save/unsave, block/unblock, mute/unmute, and notification deep links.
2. Verify deployed Testnet has `gh_post_feed_engagement_batch` installed and callable by the service role before rollout. Do not apply the migration automatically; the archive's applied-migration source reconciliation remains an open Phase 0 gate.
3. Run Node 24.15.0 install, typecheck, lint, prebuild, and production build.
4. Measure reaction mutation latency and aggregate hydration behavior on posts with large reaction volumes; verify concurrency and idempotency against the live database.
5. Continue the remaining Phase 2 review of comment/reply moderation, repost/quote semantics, account-scoped saves, notification reliability, and accessible mobile interaction states.

## Release and safety status

**Phase 2 is in progress; not release-certified.** No database writes, migration replay, deployment, promotion, or Mainnet changes were made. Pi-funded GHC acquisition, paid business checkout, GHC issuance/settlement, withdrawals, and payouts remain gated.

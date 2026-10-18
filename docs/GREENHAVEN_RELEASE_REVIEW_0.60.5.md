# GreenHaven implementation pass — release 0.60.5

## Scope

This pass continues the 0.60.4 curation/reward work and closes a critical pipeline gap: vote, one-time reward evaluation, and active GHPV weight previously ran in separate database transactions. It also persists the selected reward percentage with the active vote and makes only explicitly non-terminal reward attempts retryable.

## Implemented

- Added `supabase/migrations/202610180002_gh_curation_pipeline_atomic.sql`.
- The service-role-only `gh_post_curation_set_with_reward` RPC now performs the authoritative vote, reward evaluation, and GHPV active-weight update in one PostgreSQL transaction. An unexpected GHPV failure rolls back the vote/reward transaction rather than leaving systems divergent.
- The API computes reviewer weight from server-side reputation/calibration and passes it to the service-role RPC; client-supplied identity, balance, reputation, or curation power is not accepted.
- The selected percentage scales both the one-time GHC reward calculation and the active GHPV contribution. This scales the content-quality/curation signal; it does **not** directly alter the reviewer's account reputation score.
- The active `gh_post_curations.reward_percentage` is persisted in the database.
- A reward attempt with no eligible balance, zero percentage, or a restricted account may be reevaluated after conditions change. A credited reward is immutable and never credited twice. Daily-cap and other terminal outcomes remain one-shot per voter/post.
- Release metadata is synchronized to `0.60.5`.

## Preserved economic rules

- GHC reward formula remains `balance × reputation level × percentage / 100000`.
- Only an active upvote can earn; downvotes earn no GHC; self-votes are ineligible.
- Spendable balance, reputation level, account restrictions, daily earning cap, and ledger credit are server-authoritative.
- The configured economy daily cap is used; no extra hard-coded 5 GHC cap is introduced.
- Likes remain separate from upvotes/downvotes. No Pi payment, membership, refund, or mainnet data is changed by this source edit.

## Verification

- All `scripts/test-*.mjs`: 75/75 scripts passed after updating the two integration checks to assert the atomic pipeline.
- `scripts/test-ghc-curation-reward.mjs`: 24 original formula/contract checks plus 7 pipeline checks passed.
- Production safety scan: 21/21 passed.
- JSX safety: 640 files scanned.
- Package-lock integrity, TypeScript, ESLint, production build, SQL execution, Supabase integration, Pi Browser and multi-user end-to-end behaviour have not been verified in this environment. The available Node runtime is below the repository's declared minimum and dependencies are not installed.

## Required rollout gates

1. Apply migrations `202610180001_ghc_curation_rewards.sql` and `202610180002_gh_curation_pipeline_atomic.sql` to **testnet only**, in order, after confirming prerequisites and backup/rollback plan.
2. Run live tests with at least two accounts: upvote, downvote, toggle off, switch vote, zero percentage, no balance then later balance, daily cap, simultaneous requests, restricted account, and GHPV aggregation.
3. Resolve product policy before claiming the percentage affects account-level reputation. This implementation scales the content curation weight but intentionally does not invent a separate rule for increasing/decreasing the voter's account reputation.
4. Decide how to handle edits to an already credited percentage. Current behaviour intentionally preserves immutable posted ledger entries; changing the active vote's percentage updates active curation weight but does not reverse or rewrite an earlier GHC credit.
5. Do not apply to mainnet, push to GitHub, or deploy to Vercel until testnet migration and runtime verification are approved.

## Rollback

Do not drop or rewrite posted ledger rows to roll back. If testnet validation fails, disable the curation write path through the deployment configuration/feature gate, preserve evidence, and prepare a reviewed forward-fix or a separately reviewed rollback migration. Do not run destructive rollback SQL against mainnet.

# GHC curation reward engine — release 0.60.3

## What changed

- Post cards use Upvote and Downvote as the primary curation controls. Post-card Like counts/actions are not shown; the long-press reaction tray excludes Like.
- Each post card has a 0%, 25%, 50%, 75%, or 100% reward selector for its upvote.
- The client sends only the requested choice and percentage. The API derives the voter from the authenticated session and calls the service-role-only `ghc_curation_reward_credit` RPC.
- The database RPC reads the spendable ledger balance and authoritative reputation level, checks restricted/suspended account flags, enforces a hard ceiling of 5 GHC/day (and any lower `ghc_economy_limits.max_daily_earn` setting), applies the Africa/Lagos day boundary, and writes the reward to `ghc_transactions`.
- A unique claim per `(user_id, post_id)` and the existing unique posted-earned ledger reference prevent repeat credit from vote toggles or retries. A reward requires the post's current authoritative vote to still be `upvote`; downvotes and neutral votes never mint GHC. Self-votes do not earn.
- Existing GHPV/consensus weighting remains a separate quality/reputation signal and is not used as a client-authoritative GHC amount.

## Formula

`reward = round((eligible_spendable_GHC / 10) * reputation_level * (percentage / 100) / 100, 4)`

Examples: 1,000 GHC × level 5 × 100% yields 5 GHC; 100 GHC × level 10 × 50% yields 0.5 GHC; 100 GHC × level 10 × 100% yields 1 GHC. The database applies the remaining daily earning cap (never above 5 GHC/day, even if the database setting is higher) and may credit less than the calculated amount.

This is a ledger credit (newly earned GHC), not a transfer or stake debit. The spendable balance is read as the calculation basis and is not reduced by voting.

## Rollout — testnet first only

1. Review `supabase/migrations/202610180001_ghc_curation_rewards.sql`.
2. Apply the migration to the **testnet Supabase project only** using the project's normal migration process.
3. Deploy version `0.60.3` to the Vercel Preview/testnet environment.
4. Verify the RPC exists and is executable by `service_role`, and that anon/authenticated roles cannot execute it or read the claims table.
5. Test: eligible upvote at 100%; 50% calculation; 0%; downvote; neutral/toggle; self-vote; zero balance; restricted/suspended account; daily cap reached; retry/double-submit; two concurrent upvotes; balance refresh and ledger row.
6. Confirm each voter/post has at most one claim and one posted `curation_reward` ledger row. Confirm no client-side wallet balance is treated as authoritative.
7. Do **not** apply to mainnet until testnet checks pass and the operator explicitly approves the mainnet migration.

## Verification completed in this workspace

Static/regression scripts passed for curation separation, the reward formula/RPC contract, notification attention, feed layout, social visibility, daily reward reliability, GHC balance locking, wallet authorization, and withdrawal settlement. Full TypeScript/lint/Next build could not be run because dependencies were not available in the workspace; `npm ci --legacy-peer-deps` did not complete in the execution window. Database migration execution and live concurrent-transaction testing have not been performed.

# GHC curation reward engine — target design (roadmap amendment, 2026-10-18)

**Status:** target design only; current Phase 6 candidate disables curation GHC credit. Do not apply the historic minting design below as-is.

## Product decision

Curation must work using each upvoter's server-derived available/spendable GHC balance to calculate voting weight and creator reward. However, because Daily Claim and qualifying referrals are the only approved issuance sources, **creator rewards must redistribute existing GHC** rather than mint new GHC.

## Proposed settlement model

- The server derives voter identity from the authenticated session and reads the authoritative spendable balance inside the transaction. Never trust a client-supplied balance or reward amount.
- Use the existing 0%, 25%, 50%, 75%, or 100% contribution selector. Define the base creator contribution as 0.1% of the voter's eligible spendable GHC at settlement time, then apply the selected percentage. Suggested launch caps: 1 GHC per vote and 5 GHC per voter per Africa/Lagos day. These are proposed risk controls and must be configurable/tested before launch.
- If the calculated amount is below the ledger's supported precision or the voter has insufficient spendable balance, the system must safely settle a zero contribution or reject the paid contribution; it must never overdraw the account. A free upvote can remain a quality signal without a GHC contribution if product UX explicitly indicates that.
- Atomically debit/allocate the voter's GHC and credit the creator the exact same amount under one immutable curation settlement reference. The total user-available GHC supply must not increase from curation. The curation reward row is a transfer/redistribution, not `earned` issuance.
- Voting power uses the spendable balance observed in the same transaction and is snapshotted with the vote. Apply per-vote/per-post ceilings and eligibility controls to limit whale dominance. The reward contribution and voting weight must not be recomputed from a client cache.
- No self-vote rewards. Enforce one active vote per `(post_id, user_id)`, idempotent toggles/retries, atomic vote changes, visibility/block checks, restricted-account checks and rate limits. Prevent re-vote farming from generating repeated creator credits; any additional tip must be a distinct, explicit, debited transaction.
- Likes and profile reactions remain independent from curation votes. Downvotes and neutral votes do not transfer GHC to the creator.
- Creator payout is a redistribution from the upvoter, not an additional Daily Claim/referral issuance. Any platform fee or treasury split must be explicitly configured and accounted for; do not silently create or burn GHC.

## Historical formula (not approved for launch)

The earlier design credited newly issued GHC using `round((eligible_spendable_GHC / 10) * reputation_level * (percentage / 100) / 100, 4)`, with a 5 GHC/day cap. That is incompatible with the approved two-source issuance policy and must not be reactivated without redesign.

## Required tests

- Available-balance calculation is server-authoritative and concurrent with ledger reservation/debit.
- 0/25/50/75/100% selector, rounding, zero balance, insufficient balance and daily/per-vote caps.
- Same vote retry/toggle, duplicate requests, simultaneous upvotes, account restrictions, self-vote, block/visibility and replay after timeout.
- Sender debit equals creator credit; total user GHC is conserved.
- Curation never creates an `earned` issuance row and does not affect Daily Claim/referral counters.
- UI shows the contribution before confirmation and creator rewards in transaction history.

## Rollout

Implement behind a feature flag, validate the SQL/RPC in a disposable Testnet project, run concurrency and two-account tests, reconcile balances, and obtain operator approval before broader rollout.

# Phase 19 Testnet verification plan — no Mainnet use

Do not set `GHC_TIPS_ENABLED=true` or use the reward-pool endpoints until every gate below passes.

## Preconditions

1. Apply the migration only to a disposable PostgreSQL instance first, then Testnet after migration-history/schema review.
2. Use two controlled Testnet users with known GHC balances; verify ledger balances before and after each test.
3. Ensure both users can transfer GHC through the existing `ghc_execute_transfer` RPC and that the service-role-only ACLs are correct.
4. Create a creator profile with `tips_enabled=true`; do not use real user accounts or Mainnet balances.
5. For reward tests, insert the designated Testnet operator into `gh_creator_reward_pool_operators` as postgres, fund the pool from that operator through the endpoint/RPC, and create an approved GHC reward event. Never credit the pool by editing balances or inserting ledger rows manually.

## GHC tip cases

- Valid tip: one debit and one credit, same reference `tip_ghc_<intent-id>`, exact amount, tip intent settled, one settlement row.
- Same intent submitted concurrently from two sessions: one transfer pair only; the other returns idempotent success; one settlement row.
- Two different tips whose total exceeds sender spendable balance: at most the affordable amount settles; no negative spendable balance.
- Concurrent transfers from different senders into one receiver near the daily receive cap: the combined posted amount must not exceed the configured cap.
- Opposite-direction transfers A→B and B→A started together: both complete or fail cleanly; no deadlock or partial ledger pair.
- Reuse a transfer reference with a changed amount or recipient: `IDEMPOTENCY_CONFLICT`; reuse a reference whose debit has no matching credit: `TRANSFER_PAIR_INCOMPLETE`.
- Remove or null the economy-limits row in a disposable database: new transfers fail with `TRANSFER_LIMITS_UNAVAILABLE`; restore the row after the test.
- Change the disposable database session timezone away from UTC and repeat daily-limit boundary tests; results must remain based on UTC day boundaries.
- Repeated idempotency reference with a different amount/recipient: reject; no second transfer.
- Four-decimal amount succeeds; five-decimal amount rejects before ledger mutation.
- Blocked parties, restricted sender, daily limit, self-tip, cancelled intent and disabled feature flag all reject without a new transfer pair.
- Simulate missing RPC/schema: API returns unavailable and does not claim settlement.

## Funded creator reward cases

- Funding with a non-operator ID rejects; insufficient funding wallet balance rejects.
- Funding reference replay with same amount is idempotent; changed amount or movement kind conflicts.
- Distribution requires status `approved`, currency `GHC`, positive amount at four-decimal precision and sufficient real pool balance.
- Run two concurrent settlement calls for the same event: exactly one ledger transfer pair and one movement row; both calls may report settled/idempotent.
- Run concurrent distributions whose combined amount exceeds pool balance: total credits cannot exceed actual funded pool balance.
- Missing pool funding, wrong currency, unapproved/held/rejected event, or repeated event with changed creator/amount must reject without balance changes.
- Verify every movement row's debit/credit transaction IDs against `ghc_transactions`, and reconcile pool balance to the sum of funding less distribution transfers.

## Release evidence to save

Record migration history before/after, RPC ACLs, SQL outputs, two-session concurrency logs, ledger row IDs, before/after balances, API responses, `npm run typecheck`, `npm run lint`, `npm run build`, and the complete `npm run ci:verify` result. Keep `GHC_TIPS_ENABLED` unset/false until all checks pass. Keep bank and GHC external payout rails pending until separate adapters exist and are independently verified.

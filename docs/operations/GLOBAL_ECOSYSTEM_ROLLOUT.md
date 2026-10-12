# Global Ecosystem Rollout and Recovery Runbook

## New migration

`supabase/migrations/20261024_gh_global_ecosystem_hardening.sql` adds the cross-domain outbox, ranking telemetry, risk holds and appeals, progression provenance, referral records, trust dimensions, marketplace reservations/reviews/reports, idempotency and atomic payment/refund RPCs. It assumes earlier GH Connect economy, social, reputation, payment-intent and marketplace migrations are present. It has **not** been applied by this source change.

Before apply:
1. Run `supabase.cmd migration list` in the project folder for both linked environments and inspect duplicate/short migration timestamps.
2. Compare remote schema for `ghc_transactions`, `ghc_payment_intents`, `gh_posts`, `gh_follows`, `gh_user_mutes`, `ghc_user_blocks`, `gh_marketplace_listings`, and `gh_marketplace_orders`.
3. Confirm the service-role RPC grants and deny-all RLS policies. Do not expose service-role credentials to client bundles.
4. Apply to Testnet first; inspect the SQL result and test before Mainnet.

## Event dispatcher

Configure `GHC_DOMAIN_EVENT_CRON_SECRET` (preferred) or `CRON_SECRET`. Schedule an authenticated `POST /api/internal/domain-events/dispatch` request with `x-cron-secret` or `Authorization: Bearer ...`. The worker expires eligible unpaid stock reservations, publishes mature marketplace reviews, claims a bounded outbox batch and records receipts for known versioned event contracts. Unknown contracts retry with backoff. Monitor `attempts`, `last_error`, `available_at`, and oldest unprocessed event age. A receipt is not proof that an external provider action occurred.

## Kill switches

- `GHC_REWARDS_PAUSED=1`: stops new reward evaluations; existing claims can still be processed.
- `GHC_RANKING_PAUSED=1`: neutralizes show-more/show-less ranking boosts/demotions; explicit hide remains respected.
- `GHC_PROGRESSION_PAUSED=1`: stops new XP awards.
- `GH_MARKETPLACE_PAUSED=1`: blocks new order creation, payment finalization and activation of new listings; it does not replace incident handling for already captured payments.
- `GHC_DOMAIN_EVENTS_PAUSED=1`: pauses dispatcher work; only use if event processing itself is unsafe, because reservation expiry and delayed-review publication also pause.

## Payment/inventory recovery

- GHC checkout calls `gh_marketplace_pay_ghc_atomic`: the ledger debit, stock commit, order confirmation and outbox entries should commit or roll back together.
- Pi checkout calls `gh_marketplace_pay_pi_atomic`: it revalidates the durable completed provider intent and commits intent/order/stock state together. If provider payment is complete but stock reservation is invalid, do not manually mark the order confirmed; investigate and reconcile against the provider first.
- A paid order cannot be cancelled through the generic transition route. GHC refund requires a disputed order and creates a linked `kind='reversed'` ledger row. Pi refund is deliberately rejected until a provider-verified refund path exists.
- Do not delete ledger rows, reservation rows, order audit entries or outbox rows to “fix” state. Use compensating operations with a source reference.

## Appeals and reviews

Set `GHC_TRUST_REVIEWER_USER_IDS` to a comma-separated allowlist of reviewer user IDs. Reviewer actions cannot target the reviewer's own appeal. The current review endpoint only records `under_review`, `upheld` or `withdrawn`; it does not directly change wallet balances or reputation totals. Marketplace reviews remain private for seven days, then the dispatcher publishes them and applies a bounded transaction-trust signal.

## Release/rollback

This is a forward-only additive migration. Roll back behavior with environment switches and a code rollback; do not drop tables or rewrite ledgers to reverse deployment. If any atomic payment RPC is unavailable, keep marketplace payment disabled and do not fall back to read/modify/upsert settlement.

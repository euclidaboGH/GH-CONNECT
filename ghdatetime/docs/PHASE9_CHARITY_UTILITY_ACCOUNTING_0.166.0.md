# Phase 9 — Charity & platform utility accounting (0.166.0)

## Goal
Segregate **withdrawal fees**, **charity**, and **utility sinks** from user withdrawable PI earnings so platform retention and gifts never inflate available balances.

## Delivered
- Migration `20261029010012_gh_charity_utility_accounting.sql`
  - `gh_platform_utility_entries` (withdrawal_fee, charity_in/out, utility_sink, adjustment)
  - `gh_charity_contributions` (user audit, not withdrawable)
- Helpers: `postWithdrawalFee`, `recordCharityContribution`, summaries
- APIs:
  - `GET|POST /api/economy/earnings/charity` (user)
  - `GET /api/economy/earnings/platform` (operator key)
- Dashboard shows charity totals as non-withdrawable

## Rules
- 3% withdrawal fees post as `withdrawal_fee` platform entries
- Charity never increases `availableAtomic` on the user earnings ledger
- Idempotent unique_ref on all posts

## Not claimed
- Full funded debit path for charity from available balance in one atomic RPC
- Live operator totals on production DB

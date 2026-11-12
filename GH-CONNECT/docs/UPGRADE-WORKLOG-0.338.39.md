# 0.338.39 — Return reserved π (incomplete) + 30 upgrades

## User capability
- **Return reserved π to available** for incomplete withdrawals that never received a Pi payment id / txid.
- Visible on Wallet (Pi rail), withdraw sheet, and earnings dashboard.
- Server path: POST /api/economy/earnings/withdrawals/cancel → gh_pi_earnings_payout_cancel_unstarted.

## SQL (operator REVIEW_REQUIRED)
- supabase/migrations/20261111120001_pi_earnings_release_stale_incomplete.sql
- Expands self-service release to stale/incomplete processing rows with **no** provider evidence.
- Never force-releases rows with provider_payment_id or provider_txid.

## Safety
- Auth required, durable rate limit, advisory lock, Pi Testnet only.
- Client never invents balances; only refreshes after server ok.

## Prior retained
- Pi auth false-negative fix (0.338.38)
- Progressive wallet scopes / Quality labels (0.338.37)

Production NOT APPROVED. Apply migration before expecting expanded release on live DB.

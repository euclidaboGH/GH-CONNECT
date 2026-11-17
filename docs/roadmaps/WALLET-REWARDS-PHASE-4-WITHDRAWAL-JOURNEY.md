# Wallet & Rewards Phase 4 — Withdrawal Journey

## Scope

Production-ready Pi withdrawal journey on Wallet without duplicate withdraw surfaces on Rewards.

- **Single primary control** on the Pi earnings card: authorize (when required) → fee quote → payout request.
- **Rewards Centre** claims only (daily GHC, registration bonus, cashback summary, missions). Pi withdraw opens Wallet.
- **Settings** retains `PiPayoutAuthorizationCard` for explicit consent management and revoke.
- Recipient always from durable `gh_pi_identities` + active `gh_pi_wallet_authorizations` — never client-supplied.
- 3% fee quote remains server-authoritative (`POST /api/economy/earnings/quote`).

## Security boundaries

- Does not weaken `WALLET_AUTHORIZATION_REQUIRED` or payout guards.
- Does not invent balances or mark payouts complete client-side.
- Does not merge GHC and Pi ledgers.
- No new migrations required for this UI phase (authorization SQL is prior art).

## Validation

- `npm run check:wallet-phase4-withdrawal-journey`
- Existing static suite, typecheck, and Testnet authorize → withdraw eligibility checks.

Document date: 2026-11-03.

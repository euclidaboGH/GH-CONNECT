# Upgrade worklog — 0.266.0

## Pi withdrawal: WALLET_AUTHORIZATION_REQUIRED (user-facing fix)

**Cause:** A2U payouts require an explicit row in `gh_pi_wallet_authorizations` via
`POST /api/identity/wallet-authorization`. Pi identity *link* is not the same as *payout consent*.
Users saw raw `WALLET_AUTHORIZATION_REQUIRED` with 3 π available and identity linked.

**Fix (source):**
- Unified earnings dashboard loads authorization status and shows **Authorize Pi wallet for payouts**.
- Withdraw button becomes **Authorize & withdraw** when consent is missing; grant then request.
- Raw SCREAMING_SNAKE error codes humanized in the UI.
- `GET /api/economy/earnings/withdrawable` now includes `walletAuthorization` snapshot.

**Operator note:** Migration `20261029010005_pi_identity_wallet_authorization.sql` must be applied
on the target database. Without it, status is `WALLET_AUTHORIZATION_UNAVAILABLE` (503).

## Verification
- Static contracts remain network/DB independent.
- Runtime claim of successful A2U transfer is **not** made until Testnet worker + funding confirm.

Supported runtime: Node.js **24.15.0**.

# Pi Official A2U Compliance Checklist — GreenHaven

**Date:** 2026-11-05 · **Release baseline:** 0.315.0  
**Authority:** [Pi Advanced Payments](https://developers.minepi.com/docs/accept-payment/PaymentsAdvanced), [Platform API](https://developers.minepi.com/docs/api-reference/PlatformAPI), [pi-nodejs / pi-backend](https://github.com/pi-apps/pi-nodejs), Mainnet Listing Requirements.

This is a **source checklist**. It does not prove funded Testnet A2U or Mainnet approval.

## Official A2U lifecycle → GH-CONNECT mapping

| Pi step | GreenHaven location | Status (source) |
|--------|---------------------|-----------------|
| Authenticate user / obtain Pi UID | Pi auth + `gh_pi_identities` + `/api/identity/me` | Implemented |
| Explicit app consent for payouts (GH design) | `POST /api/identity/wallet-authorization` + RPCs | Implemented — **must be used once per user** |
| Create A2U payment (`createPayment`) | `app/api/economy/earnings/withdrawals/execute/route.ts` via `pi-backend` SDK | Implemented |
| Persist payment ID | Earnings payout request rows + provider payment id on execution | Implemented |
| Submit to blockchain (`submitPayment`) | Same execute worker | Implemented |
| Persist txid | Settlement RPC with provider txid | Implemented |
| Complete (`completePayment`) + independent receipt | `sdk.getPayment` + `gh_pi_earnings_payout_settle_verified` | Implemented — never marks paid from create alone |
| Incomplete recovery | Execute path + incomplete payment helpers | Implemented (review with live Testnet) |
| Server API Key (never in browser) | `PI_API_KEY` / pi-backend env | Required on Vercel |
| App wallet seed (server only) | SDK wallet config (operator) | Operator-owned secret |
| Testnet network fencing | `PI_A2U_TESTNET_ONLY`, `network: "Pi Testnet"` | Implemented |
| Execution kill switches | `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`, `PI_A2U_ENABLED`, executor key | Fail-closed until operator enables |

## User journey (product)

1. Wallet → π → **Withdraw** → amount  
2. Fee preview (3%) + linked Pi UID destination (server-resolved, not browser address)  
3. First time: explicit payout consent  
4. 6-digit **withdrawal PIN** (app-side; never sent to Pi)  
5. Submit request → ledger reservation  
6. Operator/worker executes A2U when flags + funding allow  
7. History shows request / paid / failed from server ledger  

## Listing / Mainnet notes

- Published listing criteria require a functional app, Pi auth, production URL, and demonstrated **U2A** in production.  
- Advertising withdrawals means the **represented** path must work on Testnet first.  
- Mainnet A2U needs **outgoing wallet** approval — separate from Testnet.  
- Do not set `sandbox: false` or enable Mainnet execution until approval and funding exist.

## Operator Testnet sequence

1. Apply pending migrations (including `20261105200001_withdrawal_pin_security.sql` if using PIN storage).  
2. Set Testnet `PI_API_KEY`, app wallet seed, `PI_A2U_TESTNET_ONLY=true`.  
3. Fund Testnet outgoing wallet.  
4. User: Authorize once + set PIN + Withdraw request.  
5. Enable `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true`.  
6. Run execute worker with `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true` + executor key.  
7. Confirm paid status only after independent provider receipt verification.

## Explicit non-claims

- Source PASS ≠ blockchain paid.  
- Consent gate is intentional.  
- Withdrawal PIN is GreenHaven security, not a Pi requirement.

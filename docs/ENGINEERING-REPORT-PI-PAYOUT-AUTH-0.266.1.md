# Engineering report — Pi payout authorization (0.266.1)

## 1. Research (official + platform)

Primary official sources consulted:

- Pi Platform API / Payments (A2U `POST /payments` with Server API Key, recipient `uid`)
- Pi Advanced Payments (A2U involves Platform API + blockchain; incomplete server payments must be resolved)
- Pi SDK reference (U2A client flow vs A2U server flow; Direction `app_to_user`)
- pi-apps/pi-platform-docs, pi-sdk-integration-guide, pi-ruby / pi-php A2U packages
- Incomplete server payments: `GET /payments/incomplete_server_payments`
- Security: Server API Key never in frontend; complete only after verified txid

**Application to GH-CONNECT:** Pi does **not** define GH’s `gh_pi_wallet_authorizations` table — that is **app-level consent** that A2U may use the durable mapped uid. Pi still requires Server API Key + recipient app uid for A2U creation. Identity link ≠ payout consent ≠ payment completed.

## 2. Root cause

Users with linked Pi identity and withdrawable balance received `WALLET_AUTHORIZATION_REQUIRED` because:

1. Withdrawal RPC path calls `assertPayoutWalletAuthorization` requiring an **active** row in `gh_pi_wallet_authorizations`.
2. UI did not surface grant/revoke against `POST|DELETE /api/identity/wallet-authorization`.
3. Error codes were shown raw.

This is correct server fail-closed behavior, not a false negative from missing Pi API support.

## 3. Implementation

- UI: authorize panel, Authorize & withdraw, humanized errors, revoke
- API: withdrawable includes `walletAuthorization` snapshot
- Existing: grant uses server mapping only; assert matches recipient uid; RLS deny-all; service-role RPCs

## 4. Testing (this environment)

| Gate | Result |
|------|--------|
| Static phase2 wallet authorization | 13/13 PASS (prior) |
| Project truth / release hygiene | PASS |
| JSX safety | PASS |
| Live Supabase migration apply | **NOT run** (no DB) |
| Live Pi Testnet A2U | **NOT run** (no funding/keys) |
| npm production build | **BLOCKED** if registry/install fails |

## 5. Deployment

See `docs/OPERATOR-PI-PAYOUT-AUTHORIZATION-2026-11-01.md`.

## 6. Risks

- Migration not applied → `WALLET_AUTHORIZATION_UNAVAILABLE`
- Flag off → requests disabled
- Incomplete A2U payments block new creates (Pi platform rule)
- Mainnet A2U policy / funding not verified here

# Upgrade worklog — 0.204.0

## Scope
Wallet/Rewards PI UX: remove duplicate earnings dashboards, add **Request PI withdrawal** CTA (server request only, Pi A2U Testnet-gated), soften transient ledger banners.

## Source-only verification
- Network/DB independent static contracts only.
- Supported runtime: **Node.js 24.15.0**.

## Pi A2U notes (developer docs)
- A2U is **server-initiated** via Platform API `POST /payments` with Server API Key — never from the client.
- Currently **Testnet-only** per Pi Advanced Payments documentation.
- Client only creates a durable GreenHaven payout **request**; execution worker performs provider transfer after flags/migrations/funding.

## Limits
Does not enable live A2U or invent paid balances. Operator must set `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` and `PI_NETWORK=testnet` after readiness.

# Section C + D implementation (2026-10-12)

## C — Economy

| Item | Implementation |
|------|----------------|
| C13 | GET `/api/economy/rewards/daily` + hero hydrate |
| C14 | referenceId / idempotencyKey static gate |
| C15 | export / holds / appeals routes gated |
| C16 | Ops reconciliation — monitor on Testnet |
| C17 | Rate limit buckets including `daily_status` |
| C18 | docs/PENDING_VS_SPENDABLE_QA.md |
| C19 | Payouts/refunds remain off by default |

## D — Security

| Item | Implementation |
|------|----------------|
| D20–D26 | Static security gate + CSP/media/reports/blocks docs |

```bash
npm run test:economy-cd
npm run test:security-cd
npm run ops:cd-gates -- --strict
```

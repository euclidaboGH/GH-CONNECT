# Pending ≠ spendable — QA checklist

| Check | Expected |
|-------|----------|
| Available balance | Only posted/available GHC can be sent or spent |
| Pending holds | Visible separately; claim required before available |
| Daily claim | Server POST only; GET status does not mint |
| After claim | UI shows claimed today (not green CTA) |
| Offline claim | Blocked; no optimistic credit |
| Transfer | Requires auth + step-up + referenceId |
| Wallet export | Authenticated; rate-limited |

Automated: `npm run test:economy-cd`

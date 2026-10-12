# Section G + H implementation (2026-10-12)

## G — Messaging & communities

| Item | Implementation |
|------|----------------|
| G41 Durable messaging gate | Flag + server durable store; keep OFF until IDOR green |
| G42 Single Create community | `openCreateCommunity` only (`setShowCreate(true)` once) |
| G43 Community roles | API cannot inject owner; hub gates mod actions with `isMod` |
| G44 Presence optional | Chat works offline; presence is display-only |

## H — Marketplace & membership

| Item | Implementation |
|------|----------------|
| H45 Checkout | Idempotency-Key required + atomic `reserveListingStock` |
| H46 Membership status | Server `/api/membership/status` + refresh on pageshow/visibility/Pi complete |
| H47 Seller analytics | Read-only from durable orders; `unavailableMetrics` listed |

```bash
npm run test:messaging-marketplace-gh
```

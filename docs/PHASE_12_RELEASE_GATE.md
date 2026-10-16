# Phase 12 — Testnet / release gate

## Package hygiene

- Removed dated root pass/report markdown from release tree
- Standards retained under `docs/`
- No `.env`, no `node_modules`, no `.next` in zip

## Automated (local, no install)

```
node scripts/check-jsx-safety.mjs     → ok
node scripts/scan-production-safety.mjs → 21/21
node scripts/print-migration-checklist.mjs → inventory OK
```

## Operator must still run

```
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:economy
npm run test:daily-wallet
npm run test:safety
npm run build
```

## Explicit non-claims

- No live database migration applied from this phase
- No Pi Browser Testnet session performed here
- No “production ready” certificate beyond static gates above

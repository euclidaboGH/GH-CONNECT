# Phase 10 — Testnet release gate (0.167.0)

## Goal
Static + operator live probes for the Pi earnings / cashback / A2U stack. Prove contracts and auth boundaries; **do not claim** funded wallet receipts without real Testnet evidence.

## Delivered
- `scripts/check-phase10-testnet-release-gate.mjs` — migration inventory + child suites
- `scripts/operator-live-e2e-pi-earnings.mjs` — HTTP probes (Testnet/Preview only)
- `lib/server/payments/a2u-receipt.ts` — receipt verification after durable settle
- Cashback claim returns `receipt` only when `verifyA2uReceipt` passes

## Operator live
```bash
export GHC_E2E_BASE_URL=https://your-preview.vercel.app
export GHC_E2E_ALLOW_TESTNET=1
export GHC_E2E_COOKIE_A='…'   # optional
export GHC_OPERATOR_RECONCILE_KEY='…'  # optional
npm run operator:live-e2e-pi-earnings
```

## Migrations to apply (reconcile history first)
`20261029010004` … `20261029010012` (A2U cashback through charity/utility)

## Not claimed
- Live funded A2U transfer success
- Mainnet authorization
- Remote migration applied

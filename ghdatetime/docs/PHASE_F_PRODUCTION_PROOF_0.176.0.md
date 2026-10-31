> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase F — Production proof & release hardening (0.176.0)

## Status

**NOT APPROVED for production or Mainnet.**

This release consolidates product phases **A–E** (claim UX, marketplace commerce, marketplace trust, communities product, ecosystem polish) with the earlier Pi earnings/A2U source track. The source gate is network-independent.

## Product track delivered (source)

| Phase | Focus |
|------:|-------|
| A | Daily claim pill UX · GHC vs PI separation |
| B | Marketplace order lifecycle · sort · message |
| C | Delivery modes · seller trust · reports · reviews |
| D | Community Mod console · privacy discovery |
| E | Toasts above nav · tab fades · stories · empty states |
| F | Production-proof gate · operator live product probes |

## Operator checklist (required before claiming “works in production”)

1. **Runtime:** Node matching `package.json` engines; `npm ci --legacy-peer-deps`; `npm run build` green on CI/Preview.
2. **Migrations:** Reconcile history; apply `20261029010004`–`013` (and prior required inventory) on **Testnet** only after review.
3. **Earnings live:**  
   `GHC_E2E_ALLOW_TESTNET=1 GHC_E2E_BASE_URL=… npm run operator:live-e2e-pi-earnings`  
   One **funded** Testnet A2U cashback claim with receipt = ledger `paid`.
4. **Product live:**  
   `GHC_E2E_ALLOW_TESTNET=1 GHC_E2E_BASE_URL=… npm run operator:live-e2e-product`  
   Optional cookie for authed order/wallet probes.
5. **Manual browser:** mobile + desktop — claim pill, marketplace pay→fulfill→review, community join + mod console, stories, toasts clear of tab bar.
6. **Accessibility smoke:** keyboard tab order on nav, toast `role=status/alert`, empty states readable.
7. **Explicit human go/no-go** before any Mainnet discussion.

## Commands

```bash
node scripts/check-phase-f-production-proof.mjs
npm run operator:live-e2e-product
npm run operator:live-e2e-pi-earnings
```

## Safety

No production database, balances, or migrations are mutated by this gate.

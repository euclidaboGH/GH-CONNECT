# GreenHaven Phase 3 — Finance & Commerce Transformation (source slice)

**Baseline:** `GREENHAVEN-0.312.0-PHASE-2-COMPLETE-2026-11-04.zip`  
**Date:** 4 November 2026  

## Goals

1. Multi-line marketplace checkout that does not silently drop Pi lines.  
2. Honest partial-failure messaging when reservations or GHC pays succeed mid-cart.  
3. Visible checkout progress without inventing payment success.  
4. Longer client bounds for order create/pay mutations.  
5. Preserve server authority, idempotency keys, and dual-rail (GHC vs Pi) separation.  

## Implemented

| Change | Detail |
|--------|--------|
| Cart checkout | Progress text per reserve / GHC pay step |
| Multi-Pi cart | First Pi line opens pay sheet; remaining Pi orders directed to **Orders** (not discarded) |
| Partial failure | Error copy reports reserved count and paid GHC count; unpaid line keys retained |
| Timeout | Cart hard timeout 90s; social client order mutations 45s (reads stay 12s) |
| Own listings | Still excluded client-side via Phase 2 identity match; server still enforces `CANNOT_BUY_OWN` |
| Idempotency | Per-line keys still stable across retries until full success clear |

## Not claimed

- Atomic single-transaction multi-currency cart (requires new server endpoint).  
- Automatic sequential Pi provider sessions for N Pi lines in one sheet.  
- Live Testnet settlement proof.  
- Migration apply / Mainnet enablement.  

## Verify

```bash
node scripts/check-phase3-finance-commerce-2026-11-04.mjs
```

## Handoff

Phase 4: product experience (social, communities, discovery polish) on this commerce baseline.

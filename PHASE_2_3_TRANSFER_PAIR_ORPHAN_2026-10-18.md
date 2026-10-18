# Stage 2.3 — Transfer pair orphan recovery

**Date:** 2026-10-18

## Context

`ghc_execute_transfer` is atomic. Orphan `transfer_out` without `transfer_in` should be rare (manual SQL, partial historical data).

## Solution

Ops list + complete-in only. No second debit. Unique indexes on transfer refs preserved.

## Verification

`npm run test:transfer-pair-orphan` PASS  
`npm run operator:stage2-gates` PASS  
Inventory: **93** migrations

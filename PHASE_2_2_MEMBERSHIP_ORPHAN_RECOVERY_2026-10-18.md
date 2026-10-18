# Stage 2.2 — Membership orphaned purchase recovery

**Date:** 2026-10-18

## Problem

If ledger debit commits and entitlement write fails outside a single transaction boundary (or historical partial failure), retry of `ghc_purchase_membership` returns `MEMBERSHIP_PURCHASE_RECONCILIATION_REQUIRED` and must not double-grant or double-charge.

## Solution

Ops-only complete path that requires an existing posted `spent` row for the reference, then upserts entitlement. No `ghc_execute_spend`.

## Verification

`npm run test:membership-orphan-recovery` PASS  
`npm run operator:stage2-gates` PASS  
Inventory: **92** migrations

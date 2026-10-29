# Phase 3 — Unified earnings ledger (0.159.0)

## Goal
One authoritative financial record for Pi earnings with immutable entries, unique references, and explicit statuses: pending, available, reserved, paid, reversed, disputed.

## Delivered
- Migration `20261029010006_gh_unified_earnings_ledger.sql`
- RPCs: balances, post_credit, reserve, settle, statement (service_role)
- Server module `lib/server/earnings/unified-ledger.ts` (atomic units, 1e7)
- API `GET /api/economy/earnings` (authenticated statement)
- Cashback A2U claim bridges: credit → reserve → settle (idempotent unique_ref)

## Rules
- Amounts are integer atomic units only
- Balances are derived from entries
- Client cannot write ledger rows
- Duplicate unique_ref returns idempotent success

## Not claimed
- Full backfill of historical cashback entitlements
- Activity/creator/charity adapters (Phase 4+)
- Live Testnet receipt
- Remote migration applied

## Operator
1. Reconcile history; apply `20261029010006` on Testnet if missing
2. Deploy 0.159.0
3. `GET /api/economy/earnings` after a claim cycle to verify entries

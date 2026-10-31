# GreenHaven / GH Connect upgrade worklog — 0.180.0

## Phase 2 — registration bonus reconciliation and ledger hardening

Implemented the 3 PI registration bonus policy, legacy 2.95 PI top-up reference, direct status lookup, same-user claim serialization, service-role-only database RPCs, Testnet-only operator backfill workflow, and a fail-closed network/feature flag. Static checks passed; live Supabase migration/backfill and Node 24 CI remain required.

## Phase 3 — unified PI + GHC wallet card (started)

- Reworked the wallet balance area into one unified card with separate PI earnings and GHC utility panels.
- PI is loaded from `/api/economy/earnings/withdrawable` with `cache: no-store`; unavailable data is labelled unavailable, not fabricated as zero.
- The card distinguishes PI ledger available from withdrawable PI and notes that eligibility/fees apply.
- GHC remains on the authoritative GHC wallet snapshot. PI and GHC are not added or converted into a combined total.
- Added wallet/earnings refresh event handling and a dedicated static contract check.
- Existing GHC action flows and separate GHC/PI transaction-history rails are preserved.

The implementation has source-level verification only; it is not deployed or live-database validated.

## Verification limitations

This source archive has no installed `node_modules` and the current shell runtime is Node `22.16.0`, below the project-required Node.js 24.15.0. Static scripts can run here; full TypeScript/build must run in the supported runtime. No live Supabase or Vercel operation has been performed from this working copy.

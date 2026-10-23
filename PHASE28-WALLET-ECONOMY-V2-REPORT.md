# GREENHAVEN PHASE 28 — GHC ECONOMY & WALLET V2

## Objective
Converge the GHC wallet onto one server-authoritative ledger read model so Available, Pending, Locked and Escrow states cannot drift between Wallet, Rewards, social economy and transaction detail surfaces.

## Implemented
- Added `ghc_wallet_v2_snapshot()` as a service-role-only authoritative read RPC.
- Available balance is derived from the existing spendable ledger path.
- Pending value is derived from pending positive ledger rows.
- Locked value is explicitly separated from Pending and currently represents withdrawal reservations.
- Escrow is an explicit field and is `0` until a durable escrow reservation rail exists; the system does not fabricate escrow value.
- Added server reconciliation flags proving Available + Locked = Ledger balance and enforcing non-negative read states.
- Added server-side category attribution for rewards, creator, curation, transfers, marketplace, membership, withdrawals, adjustments and unclassified rows.
- Added authenticated `GET /api/economy/wallet/summary` with no-store semantics.
- Added a reusable Wallet V2 client read adapter with no localStorage balance synthesis.
- Upgraded `WalletReadProvider` to hydrate from the server wallet authority and refresh on wallet/reward/payment events plus periodic refresh.
- Expanded the wallet read seam with category, ledger, escrow and reconciliation state.
- Upgraded the Premium Wallet balance area to consume the authoritative Wallet V2 state and show Available / Pending / Locked explicitly.
- Locked financial mutation authority remains server-side; the read provider cannot transfer, spend, claim, mint or grant value.
- Regenerated the canonical Supabase installer: 122 migrations.

## Verification
- Phase 28 Wallet Economy V2: **17/17 PASS**
- Phase 17 Economy Surface Convergence: **15/15 PASS**
- Phase 14 Social Economy Wallet Bridge: **22/22 PASS**
- Phase 21 Activity Wallet Attribution: **12/12 PASS**
- Phase 27 Creator Economy V2: **17/17 PASS**
- GreenHaven ID Transfers: **12/12 PASS**

## Runtime/build limitation
`node_modules` is not present in the working source, so Next.js build, TypeScript typecheck and ESLint were not run. The checks above are source-level regression/contract tests. No live Supabase, Vercel or Pi Testnet success is claimed by this phase.

## Next
Phase 29 — Membership + Pi Payment Convergence, including payment completion → fulfillment → entitlement → membership status, VIP/VVIP paid-but-Free recovery, idempotent retries and durable failure recovery.

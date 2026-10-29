# Phase 8 — Unified earnings & wallet experience (0.165.0)

## Goal
Polished PI earnings dashboard reflecting **server-authoritative** balances, cashback context, fee preview, payout history, and clear ineligible states.

## Delivered
- `components/ghc/unified-earnings-dashboard.tsx`
- Wired into Wallet + Rewards Centre
- Data from:
  - `GET /api/economy/earnings/withdrawable`
  - `GET /api/economy/earnings`
  - `POST /api/economy/earnings/quote` (3% fee preview)
- Shows available / pending / reserved / paid
- Linked Pi wallet status + eligibility reasons
- Recent ledger entries with statuses

## Not claimed
- Full visual redesign of entire GHC wallet hero
- Live Testnet receipt

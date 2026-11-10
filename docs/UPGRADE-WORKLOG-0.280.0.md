# GreenHaven 0.280.0 — Phase 3 Wallet / Rewards Product Separation

Date: 2026-11-03

## Goal

Wallet = balances, transfers, dual-rail History, Pi authorize → withdraw.  
Rewards = claims (daily, registration bonus, cashback, missions).  
Membership = VIP / VVIP purchase surface (not Wallet primary chrome).

## Changes

### Wallet (`features/wallet/wallet-screen.tsx`)
- Removed primary **Buy GHC with π** + inline `GhPayPanel` catalog.
- Replaced with compact **Add GHC → Open packs** CTA that opens `AddGhcSheet` only.
- Rewards tab renamed label **Earn**; content is redirect-only to Rewards Centre (no local claim list).
- Money & benefits copy clarifies Claims → Rewards, VIP → Membership.
- Membership tile: “VIP plans open on Membership — not paid from this balance card”.
- Pending matured holds use **Release** wording (ledger release ≠ daily claim).
- Send educate no longer says “Claim pending GHC” as a Wallet primary action.

### Rewards (unchanged authority)
- Registration bonus + daily claim remain on Rewards.
- Withdraw remains “Open Wallet · Withdraw Pi” navigation.

## Verification

`node scripts/check-phase3-wallet-rewards-separation.mjs` — expected 13/13 PASS

## Not claimed

- Live A2U settlement
- Removal of server claim-matured reconciliation on wallet refresh (still safe ledger sync)

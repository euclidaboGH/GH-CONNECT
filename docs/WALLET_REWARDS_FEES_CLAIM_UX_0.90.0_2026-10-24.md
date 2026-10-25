# 0.90.0 — Wallet claim refresh, dual-rail fees, floating daily claim

## Fixes
1. **Pending → available after Claim**: wallet + rewards call server `/api/economy/rewards/claim`, then `refreshWalletAuthority` + `ghc:wallet-synced` (no logout required).
2. **Marketplace fee rail**: server honors `feeCurrency` preference (GHC vs Pi); Pi path no longer returns GHC-only error text when Pi selected.
3. **Community create fee**: human-readable errors for `COMMUNITY_CREATE_FEE_REQUIRED` / insufficient GHC / Pi payment required.
4. **Daily claim UX**: floating lightning FAB above bottom nav (Pi/Rubi-style); does not push headers; hides after claim; details in Settings → Rewards.

## Operator note
Ensure testnet env has fee amounts and unlock flags. Pi fee still needs a completed GH Pay intent when rail is Pi.

# Wallet section — overview, wiring & hardening 0.83.0

## Product model (dual-rail)

| Asset | Role |
|-------|------|
| **GHC** | In-app utility: rewards, transfers, fees, marketplace/community utility |
| **π (Pi)** | External payment rail via GH Pay / Pi Browser — **never mixed** into GHC balance |

No free FX. Governed packs only: verified Pi payment → fixed GHC pack credit.

## Architecture

```
PremiumWalletScreen (features/wallet/wallet-screen.tsx)
├── WalletBalanceCard     available / pending / reserved / month flow
├── Your Assets           GHC row + Pi rail (separate)
├── Primary actions       Send · Request · Receive · Add GHC · Activity
├── Tools                 Utility spend · GH Pay · Withdraw (gated)
├── AddGhcSheet           Earn / receive / Pi packs
├── Utility panel         Catalog spend sinks
└── Activity + P2P flows  ledger-backed

Read path
├── useWalletRead → fetchWalletV2 → GET /api/economy/wallet/summary
└── ghc_wallet_v2_snapshot (server ledger authority)

Write path
├── transfers / transfer-requests
├── packs/intent + purchase-ghc fulfill
├── utility spend
├── daily claim / rewards claim
└── marketplace / community fee settlement
```

## Cross-feature wiring

| Feature | Wallet link |
|---------|-------------|
| Daily claim / rewards | Pending holds · 48h maturity · claim → available |
| Marketplace | Listing fees / checkout GHC or π · order events refresh |
| Community | Create fee dual-rail |
| Membership | Pi/GHC activate · referral queue |
| Referral | Settlement flag · pending/posted |
| Notifications | GHC / rewards buckets |
| Utility catalog | Spend GHC for features |

## Hardening in 0.83.0

1. **Balance card** dual-rail footer (GHC vs π) + pending ~48h hint  
2. **Wallet read provider** listens for marketplace, pack, utility, referral, refresh events  
3. **Utility spend** emits `ghc:utility-spent` for live balance refresh  
4. **Assets row** shows pending/reserved alongside available  
5. **Pi rail copy** clarifies external payment — not mixed with GHC  

## Already solid (kept)

- Server-authoritative summary RPC  
- Asset separation policy (no free FX)  
- Pack catalog + intent  
- Send / request / receive GreenHaven ID flows  
- Pending hold auto-mature claim path  
- Withdrawals gated by env  

## Env (relevant)

| Variable | Privacy |
|----------|---------|
| `GHC_BUY_WITH_PI_ENABLED` / `NEXT_PUBLIC_*` | Private / public |
| `GHC_TESTNET_UNLOCK` | Private |
| `GHC_WITHDRAWALS_ENABLED` | Private |
| `PI_A2U_ENABLED` | Private |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | Private |
| Supabase service role | Private |

## Verify

1. Balance matches server summary after claim  
2. Pack purchase refreshes available GHC  
3. Utility spend drops available and refreshes  
4. Pi never appears as GHC balance  
5. Pending shows until 48h / claim ready  

Version **0.83.0**

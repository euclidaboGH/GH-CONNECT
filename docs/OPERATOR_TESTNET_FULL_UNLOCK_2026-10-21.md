# GreenHaven testnet full-product unlock (0.64.0)

Use this before mainnet so marketplace, packs, missions, and curation can be exercised end-to-end.

## Required Vercel env (Production + Preview)

| Variable | Value | Purpose |
|----------|-------|---------|
| `GHC_TESTNET_UNLOCK` | `1` | Master unlock (server) |
| `NEXT_PUBLIC_GHC_TESTNET_UNLOCK` | `true` | Client surfaces (Buy GHC sheet) |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | Pi sandbox network |
| `GHC_BUY_WITH_PI_ENABLED` | `true` | Explicit Pi→GHC (optional if unlock on) |
| `NEXT_PUBLIC_GHC_BUY_WITH_PI` | `true` | Show Buy with Pi in wallet |
| `GHC_ACTIVITY_REWARDS_ENABLED` | `1` | Mission activity credits |
| `GHC_CURATION_REDISTRIBUTE_ENABLED` | `1` | Curation balance redistribute |
| `NEXT_PUBLIC_GHC_CURATION_REDISTRIBUTE_ENABLED` | `true` | Program status UI |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | `1` | Referral settlement |

## Supabase migrations (apply in order if missing)

1. `202610210001_gh_post_list_feed_curation_fields.sql` — feed upvote/downvote + viewer choice  
2. `202610210002_ghc_credit_pack_purchase.sql` — Pi pack → GHC ledger credit  

## Product paths unlocked

- **Marketplace**: Sell in GHC or Pi → listing detail **Buy now** creates server order and pays with GHC (or opens Pi pay).
- **Pi→GHC packs**: `GET/POST /api/economy/purchase-ghc` with catalog packs 10/50/100/250/500 GHC.
- **Missions**: `/api/economy/missions/progress` credits activity GHC when unlock/activity flag on.
- **Curation redistribute**: uses unlock helper (still balance-funded, not mint).
- **Daily claim**: 48h pending → claim to available (wallet auto-matures ready holds).
- **Votes**: feed returns `upvoteCount` / `downvoteCount` / `viewerCurationChoice`.

## Safety

- Client never invents available balance.
- Pack credit is idempotent on `reference_id`.
- Mainnet: leave `GHC_TESTNET_UNLOCK` unset and set only the flags you intentionally enable.

> HISTORICAL SNAPSHOT — dated findings and test counts are not current release evidence. Check `docs/PROJECT_TRUTH.md` and the latest CI run.

---

# Full system audit — testnet GHC / Pi (0.64.1)

Test coins are only for in-app development. Paths below must work the same way on mainnet with real balances.

## Apply migrations

1. `20261022010092_gh_post_list_feed_curation_fields.sql` — feed upvote/downvote + viewer choice  
2. `20261022010093_ghc_credit_pack_purchase.sql` — Pi pack → GHC credit  

## Vercel env (testnet)

| Variable | Value |
|----------|--------|
| `GHC_TESTNET_UNLOCK` | `1` |
| `NEXT_PUBLIC_GHC_TESTNET_UNLOCK` | `true` |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` |
| `NEXT_PUBLIC_GHC_BUY_WITH_PI` | `true` |
| `GHC_BUY_WITH_PI_ENABLED` | `true` |
| `GHC_ACTIVITY_REWARDS_ENABLED` | `1` |
| `GHC_CURATION_REDISTRIBUTE_ENABLED` | `1` |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | `1` |
| Optional explicit fees | `GHC_COMMUNITY_CREATE_FEE_GHC=5`, `GHC_MARKETPLACE_LISTING_FEE_GHC=1` |

Under unlock, community create fee defaults to **5 GHC** and listing activation fee to **1 GHC** if env fees are unset.

## End-to-end checklist

| Surface | Expected |
|---------|----------|
| Daily claim | Pending 48h → claim to available |
| Missions | Progress credits activity GHC when unlock on |
| Curation upvote | Persists on reload; optional redistribute when funded |
| Pi→GHC packs | Complete Pi intent → POST purchase-ghc → balance up |
| Marketplace sell | GHC or Pi currency; active listing spends listing fee from available GHC |
| Marketplace buy | Create order → pay GHC (ledger) or Pi |
| Community create | Debits create fee from available GHC (or Pi intent) |
| Premium messaging | Existing GHC spend path |
| Transfers | Session + step-up + ghc_execute_transfer |
| Membership / GH Pay | Pi intents via existing payment routes |

## Still operator-side (not code stubs)

- Supabase migrations applied  
- `PI_API_KEY` / Pi app matching sandbox  
- Wallet has available GHC for fee + purchase tests (claim matured packs / daily claim)  
- Mainnet: unset `GHC_TESTNET_UNLOCK`; set only approved fee env values  

## Safety

- Client never invents available balance  
- Fees never accept client amounts  
- Pack credit idempotent on reference_id  
- Free social (browse, message basics) remains free of mandatory paywalls  

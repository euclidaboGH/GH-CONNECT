# Operator flags — testnet / pre-launch GHC + Pi (2026-10-21)

All progress can be wiped at launch. Enable full flow on **Vercel** (Production + Preview) and ensure matching **Supabase** migrations are applied.

## Required Vercel env (string values)

| Variable | Recommended test value | Purpose |
|----------|------------------------|---------|
| `GHC_ACTIVITY_REWARDS_ENABLED` | `1` | Mission / activity small GHC emissions |
| `GHC_CURATION_REDISTRIBUTE_ENABLED` | `1` | Balance-funded curation rewards |
| `NEXT_PUBLIC_GHC_CURATION_REDISTRIBUTE_ENABLED` | `true` | Client program status surface |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | `1` | Referral settlement when membership charged |
| `NEXT_PUBLIC_GHC_REFERRAL_SETTLEMENT_ENABLED` | `true` | Client program status |
| `GHC_BUY_WITH_PI_ENABLED` | `true` | Allow Pi → GHC purchase path |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | Testnet Pi (keep true until mainnet launch) |
| `PI_ENV` | `sandbox` or as your Pi dashboard requires | Align with Pi Browser sandbox |
| `PI_A2U_ENABLED` | `true` only if testing A2U | App-to-user Pi; also needs `PI_A2U_TESTNET_ONLY=true` |
| `PI_A2U_TESTNET_ONLY` | `true` | Blocks A2U outside sandbox |

## Supabase

Apply migrations through at least:

- `20261022010045_gh_post_curation.sql` (upvote/downvote columns + table)
- `20261022010009_economy_v12_atomic_daily_claim.sql` (48h claim)
- **`20261022010092_gh_post_list_feed_curation_fields.sql`** (feed returns upvote/downvote + viewerCurationChoice)

Without the last migration, votes still write to DB but **disappear from the feed UI on reload**.

## Daily claim maturity

1. User claims daily → ledger row `status=pending`, lifecycle `daily_claim_48h`.
2. After 48h, Wallet → Pending shows **Ready to claim**.
3. Opening Wallet auto-claims up to 5 ready holds once per browser session (`ghc.wallet.autoMatured`).
4. Manual: Pending sheet → Claim.

If balance stays 0 after 48h: open Wallet, check Pending, claim manually, and confirm `ghc_claim_pending` RPC exists in Supabase.

## Votes

Thumbs are **curation** (`gh_post_curations`), not emoji reactions. Feed RPC must return `upvoteCount`, `downvoteCount`, `viewerCurationChoice`.

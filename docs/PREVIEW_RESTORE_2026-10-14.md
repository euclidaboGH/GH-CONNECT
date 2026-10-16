# Preview restore — design upgrades on Vercel-fix tree

## Problem
`GH-CONNECT-Vercel-Fix-2026-10-14C` deployed cleanly but preview lacked recent UI upgrades:
- Marketplace / Ecosystem header icons
- Profile GH ID / ecosystem arrangement
- Shared surface actions on primary tabs

## Cause
Vercel-fix package was a build/deploy-focused branch. Feed header only had Search + notifications; ShoppingBag was imported but unused. Profile showed GH ID in the name block **and** a full SignatureGhIdCard, plus a large ecosystem block.

## Fixes (this package)
1. **PremiumSurfaceActions** — shared Marketplace + Ecosystem header buttons (events: `ghc:open-marketplace`, `ghc:open-ecosystem`)
2. Wired on **Home/Feed**, **Communities**, **Matches** headers (not Wallet)
3. **Profile** — removed duplicate SignatureGhIdCard; compact GH ID remains in identity block; Ecosystem wrapped in a single **Dashboard** card above posts
4. App shell marketplace/ecosystem listeners retained from Vercel-fix tree

## Unchanged
- Ledger, RLS, auth, economy, payment authority
- Official brand assets

# Upgrade worklog — 0.214.1

## Build/CI fix from 0.214.0 Vercel failure

- Fixed syntax error in `app/api/economy/withdrawals/operator/route.ts` (__ghNoStore inserted mid-import).
- `.env.example`: PI_NETWORK free-text removed to satisfy foundation placeholder contract.
- Primary nav contract updated for Home|Cart|Wallet|Profile.
- Wallet rails copy exact match; `gh-premium-wallet-metrics` wrapper.
- Phase 1–12 / Phase 12 docs baseline → 0.214.1.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.

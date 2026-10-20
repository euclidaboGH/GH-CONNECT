# Stage 1 — Economy gates (source verification)

**Policy (unchanged):**
- Daily Claim may issue new GHC (server-authoritative).
- Qualifying referrals may issue only when `GHC_REFERRAL_SETTLEMENT_ENABLED=1`.
- Curation redistributes existing GHC only when `GHC_CURATION_REDISTRIBUTE_ENABLED=1`.
- Default for both flags: **OFF** until Testnet evidence + operator approval.

**Verify locally:**
```bash
node scripts/verify-economy-stage1-gates.mjs
```

**Do not** enable flags on Mainnet without:
1. Migration inventory green
2. Two-account financial E2E
3. Conservation checks under concurrency

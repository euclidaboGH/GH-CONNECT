# UPGRADE WORKLOG — 0.313.2

**Date:** 2026-11-05

## Build / CI fixes

1. **communities-screen.tsx** — restored missing `</>` on `CollapsingAppHeader` `secondary` fragment (Vercel SWC syntax error).
2. **wallet-authorization.ts** — corrected `supabaseUrl.replace(/\/$/, "")` double-escaped regex that failed compile (`Unknown regular expression flags`).
3. **docs/PHASE3-UNIFIED-EARNINGS-LEDGER-HARDENING.md** — marked as current 0.313.x engineering note for doc-hygiene gate.

## Non-changes

- No bulk wallet authorization.
- No Mainnet enablement.
- No automatic `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`.
- Withdrawal still requires per-user explicit consent + Testnet flags + funded execution path.

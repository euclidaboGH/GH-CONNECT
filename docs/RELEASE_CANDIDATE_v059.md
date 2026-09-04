# GreenHaven / GH-CONNECT — Production Release Candidate

**Version:** 0.59.0 (ECONOMY 1.2 integrated)  
**Status:** Release candidate — **not auto-deployed**  
**Node:** `engines.node = 24.x`  
**Next.js:** `15.5.24` (locked)

## Verified in RC packaging session

- `package.json` / `package-lock.json` aligned on `next@15.5.24`, `qrcode@1.5.4`, `@types/qrcode@1.5.6`
- `npm run test:economy` → **119 passed, 0 failed**
- `.gitignore` excludes `.env`, `.env.local`, and variant env files
- `vercel.json` framework `nextjs`, build `next build`, install `npm install --legacy-peer-deps`
- `.npmrc`: `legacy-peer-deps=true`, `package-lock=true`

## Required environment (server — never NEXT_PUBLIC for secrets)

| Variable | Required | Notes |
|----------|----------|--------|
| `PI_API_KEY` | Yes (Pi) | Server only; Testnet vs Mainnet key matches portal app |
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | For DB ledger | URL may be public |
| `SUPABASE_SERVICE_ROLE_KEY` | For DB ledger | **Never** public |
| `NEXT_PUBLIC_PI_SANDBOX` | Test only | `true` for Sandbox/Test-Pi; omit/false for production checklist |
| `GHC_ADMIN_CREDIT_KEY` | If admin credit API used | Server only |
| `GHC_SERVER_MEMORY` | Studio only | Do not rely on in multi-instance production |

## Migrations (apply manually before production traffic)

1. Prior ledger migrations (`20260821_*`, `20260822_*`)
2. `20260903_economy_v12_claim_streak_and_population.sql`
3. `20260903_economy_v12_atomic_daily_claim.sql`

## Blockers before production promote

1. Full `npm ci` / `npm run build` on CI or local machine (sandbox agent cannot complete long installs)
2. Supabase migrations applied + verified
3. Live **Test-Pi** U2A path confirmed in Pi Browser
4. Incomplete-payment handler verified end-to-end
5. Durable payment intents under multi-instance hosting
6. Platform rate limits in front of in-process limiters

## Do not

- Commit `.env` / real secrets
- Deploy Mainnet payments until Test-Pi checklist passes
- Treat 100 GHC = 1 π as a market rate

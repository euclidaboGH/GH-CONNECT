# GreenHaven / GH Connect — Production maintenance audit

Date: 2026-09-09  
Scope: Full-application discovery + critical stabilisation (not a rewrite)

## Verdict

**CONDITIONALLY READY** — automated safety/economy gates pass; live Vercel + Supabase + Pi Browser operator verification still required.

## Discovery summary

| Area | Status |
|------|--------|
| Next.js 15.5 App Router | Present; `ignoreBuildErrors: false` |
| Providers | PiAuth → Identity → SessionLock → domain providers on home |
| Auth | Pi SDK + server `/v2/me` + `gh_session` + App Lock + step-up + optional WebAuthn |
| GHC economy | Supabase RPCs + atomic daily claim; memory blocked on Vercel |
| Pi payments | Intent → approve → complete; ownership checks; durable upsert |
| Migrations | Economy, identity, sessions, step-up, WebAuthn, payment intents present |
| Middleware | Domain validation key only (narrow matcher) |
| Health | `/api/health` readiness probe (503 when production blockers) |

## Fixes applied in this maintenance pass

1. **`.env.example`** — Removed guidance that production should use `GHC_SERVER_MEMORY=1`. Documents required `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
2. **`app/api/payments/intents/route.ts`** — After create, **await** `assertDurableWrite` so production fails with 503 if intent cannot be persisted (no silent memory-only intents across serverless instances).

## Prior stabilisation already in tree (confirmed)

- GHC memory ban on Vercel/production (`lib/server/economy/http.ts`, `store.ts`, claim-engine fail-closed)
- Daily claim → wallet client rehydration (`wallet-sync-after-claim.ts` + UI listeners)
- Atomic `ghc_execute_daily_claim_v12` with 80/20 + idempotency
- Build-time typecheck not ignored; previous `startConversation` / `pi-runtime` type errors addressed in tree

## Automated tests (this environment)

| Suite | Result |
|-------|--------|
| `test:economy` | **PASS** 173/173 |
| `test:daily-wallet` | **PASS** 35/35 |
| `test:safety` | **PASS** 21/21 |
| `test:release` (automated portion) | **PASS** 30/30 suites |
| `npm run typecheck` / `lint` / `build` | **BLOCKED** — `tsc` not installed in this sandbox (`node_modules` incomplete) |

## Operator-required before calling production “ready”

1. `npm install --legacy-peer-deps` then `typecheck`, `lint`, `build` on CI/Vercel  
2. Set Vercel secrets: `PI_API_KEY`, `NEXT_PUBLIC_PI_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
3. Apply all `supabase/migrations/*` on the production project  
4. Live: daily claim → wallet (no hard refresh) → second claim same day  
5. Live: Pi payment create → approve → complete in matching sandbox/mainnet  
6. Multi-instance smoke (two sequential requests on different workers)

## Remaining risks

- App shell waits on Pi auth (`AppWrapper` → AuthLoadingScreen when unauthenticated) — guest/public surface limited by design  
- Payment approve treats auth as best-effort for Pi wallet unlock timing (ownership enforced when session present)  
- Live concurrency and Pi Browser E2E **NOT VERIFIED** in this environment  

# E2E integration & Pi Mainnet readiness

## GHC_E2E_BASE_URL

| Concern | Detail |
|---------|--------|
| Used by | `npm run test:e2e` (Playwright), `npm run operator:live-e2e` |
| Not used by | Next.js runtime, client bundle, Pi SDK |
| Local | `GHC_E2E_BASE_URL=http://127.0.0.1:3000` + `GHC_E2E_ALLOW_LOCALHOST=1` |
| Preview | Deploy URL, no production flag |
| Production smoke | Example `https://gh-connect-tau.vercel.app` requires `GHC_E2E_ALLOW_PRODUCTION=1` |

Resolver: `lib/e2e/resolve-base-url.mjs`

## Commands

```bash
npm ci --legacy-peer-deps
npx playwright install chromium
npm run typecheck && npm run lint && npm run test:safety && npm run build

export GHC_E2E_BASE_URL=http://127.0.0.1:3000
export GHC_E2E_ALLOW_LOCALHOST=1
npm run test:e2e

export GHC_E2E_BASE_URL=https://YOUR_PREVIEW.vercel.app
npm run test:e2e && npm run operator:live-e2e

export GHC_E2E_BASE_URL=https://gh-connect-tau.vercel.app
export GHC_E2E_ALLOW_PRODUCTION=1
npm run test:e2e:prod
```

## Vercel

`GHC_E2E_*` is for CI/local test runners, not app runtime. Keep `SUPABASE_*` / `PI_*` in Vercel project env.

## Mainnet readiness

Static: payment routes, CSP for Pi, safety/economy scripts, `/api/health`.
Unverified by E2E: live Pi Platform, real Mainnet payments, portal domain match, migrations applied.

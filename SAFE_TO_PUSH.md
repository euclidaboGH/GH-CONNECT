# GreenHaven / GH-CONNECT — Safe to push

This tree is intended for GitHub + Vercel after the production repair pass.

## Included repairs (do not revert)

- `package-lock.json`: all package `resolved` URLs use `https://registry.npmjs.org/` (no `35.245.43.102`)
- `package.json`: `@next/eslint-plugin-next@15.5.24` present
- `components/ghc/app.tsx`: Window typing for idle prefetch; no dead `id === "matches"` primary-nav checks
- `lib/server/economy/store.ts`: static `allowMemoryServer` import (no invalid ESLint rule disable)

## Do NOT commit

- `.env`, `.env.local`, or any file with real secrets
- `node_modules/`, `.next/`, coverage, local logs
- Pi API keys, Supabase service-role keys, admin keys

## Set only in Vercel (dashboard)

- `PI_API_KEY` (server only)
- `NEXT_PUBLIC_PI_CLIENT_ID`
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- Other vars listed in `.env.example` (placeholders only)

## Before first deploy after pull

```bash
npm install --legacy-peer-deps
npm run build
```

## Preserved

Pi SDK, domain validation (`public/validation-key.txt`, `/api/validation-key`, middleware, next.config rewrites), Supabase, auth, GHC economy, routes, and UI.


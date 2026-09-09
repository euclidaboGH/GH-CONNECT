# GH-Connect-production-clean.zip — Manifest

Generated: 2026-09-09

## Archive

- **Name:** `GH-Connect-production-clean.zip`
- **Approx size:** 1.5 MB
- **Entries:** ~767 (files + directories)
- **Root folder inside ZIP:** `gh-connect/`

## Included major directories

- `app/` — App Router pages and API routes
- `components/` — UI
- `contexts/` — providers
- `features/` — wallet feature module
- `hooks/`
- `lib/` — domain, economy, identity, payments, Pi
- `public/` — assets, manifest, validation key
- `scripts/` — regression and release scripts
- `styles/`
- `supabase/migrations/` — 22 SQL migrations/RPCs
- `docs/` — readiness and maintenance docs

## Required config included

- `package.json` + `package-lock.json`
- `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`
- `vercel.json`, `middleware.ts`, `postcss.config.mjs`
- `.env.example` (placeholders only)
- `.gitignore`, `.npmrc`, `README.md`

## Excluded from ZIP

- `node_modules/`
- `.next/`, coverage, caches
- `.env`, `.env.local` (secrets)
- Historical temporary ZIPs

## Tests (source tree, pre-ZIP)

- test-economy-v12: PASS (173)
- test-daily-claim-wallet-pipeline: PASS (35)
- typecheck / lint / build: NOT RUN (node_modules not fully installed in packaging environment)

## Operator deploy requirements

Set on Vercel (never commit):

- PI_API_KEY
- NEXT_PUBLIC_PI_CLIENT_ID
- SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
- SUPABASE_SERVICE_ROLE_KEY

Apply all `supabase/migrations/*.sql` on the production Supabase project.

Then: `npm install --legacy-peer-deps` → `npm run build` on Vercel (automatic).

# Cleanup 0.89.1 — removed non-runtime leftovers

Removed **446** paths that are not required for build/run.

## Kept (required)
- `app/`, `components/`, `lib/`, `features/`, `contexts/`, `hooks/`, `types/`, `public/`
- `supabase/migrations` + canonical install/validate SQL
- Build config (`package.json`, lockfile, `next.config.mjs`, `tsconfig.json`, `vercel.json`, …)
- Prebuild scripts: `check-node-runtime.mjs`, `check-jsx-safety.mjs`
- Operator/verify scripts and essential `docs/OPERATOR*` + section overview docs

## Removed categories
- Root `PHASE*`, `*REPORT*`, static test result dumps
- Historical audit/roadmap markdown under `docs/` (not operator/overview)
- Bulk `scripts/test-phase*`, `scripts/audit-*`, non-essential test harnesses
- Supabase staging packages and readonly preflight SQL noise

## Note
If you previously saw **30k+ files**, that was almost certainly `node_modules` after `npm install` — never commit that. This zip excludes `node_modules` and `.next`.

Version **0.89.1**

# GH-CONNECT 0.338.53 — build-gate resilience improvements

## Authoritative baseline
Applied against `GREENHAVEN-0.338.53-FULL-PROJECT-REPAIR-2026-11-11-1.zip` only.

## Changes
- `scripts/check-phase26-wallet-ledger-resilience.mjs`: cache-policy validation no longer treats the lack of `.git` metadata as proof of a cache-policy violation. In a no-Git source/Vercel workspace, only build-info files in recognized generated cache locations (`.cache/`, `.next/cache/`, `.turbo/`) are accepted; a stray build-info file at the source root or in application/source directories fails. In a Git worktree, discovered cache files must be ignored and untracked. Git command failures are not treated as a successful ignored result.
- `scripts/test-run272-vercel-build-prep.mjs`: adds regression cases for no-Git workspace handling, allowing generated cache files in a recognized location while rejecting a stray source-root cache file. Existing tracked-cache rejection coverage remains.

## Validation performed
- `node scripts/test-run272-vercel-build-prep.mjs`: 10/10 passed.
- `node scripts/check-phase26-wallet-ledger-resilience.mjs`: 17/17 passed in extracted source workspace without `.git` metadata.
- `node scripts/check-vercel-build-hygiene.mjs`: 17/17 passed.
- `node scripts/check-run262-build-memory-budget.mjs`: 6/6 passed.
- Source archive inspection: no `.tsbuildinfo` files were present.

## Not yet verified
- The environment provides Node.js 22.16.0, while this project requires Node.js `^24.15.0` (`.nvmrc` pins 24.15.0). The project's own runtime guard correctly rejects Node 22. Full `npm ci`, `npm run typecheck`, `npm run lint`, `npm run verify:static`, and `npm run build` were therefore not claimed as passed.
- This change does not prove that all TypeScript diagnostics, ESLint warnings, runtime defects, database migrations, or external Pi/Supabase integrations are resolved. Those need supported-runtime CI and appropriate live/testnet evidence.
- No financial controls, feature gates, migrations, dependencies, application UI, or runtime behavior were changed.
- No GitHub push or Vercel deployment was performed.

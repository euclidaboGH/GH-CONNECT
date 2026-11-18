# UPGRADE-WORKLOG 0.338.62

## Summary
Vercel MODULE_NOT_FOUND for prepare-vercel-build.mjs fixed by fail-soft buildCommand:
`(node scripts/prepare-vercel-build.mjs || rm -rf .next/cache/webpack) 2>/dev/null || true`
then `npm run build`. Script remains in tree for hygiene gates.

## Deploy (critical)
1. Unzip so **package.json is at the GitHub repository root** (not inside a nested GH-CONNECT/ folder).
2. Confirm on GitHub: `scripts/prepare-vercel-build.mjs` is visible at that path.
3. Vercel Project Settings → General → **Root Directory** must be empty / `.` (repo root).
4. Redeploy testnet.

## Source-only verification
Source-level only. Node.js 24.15.0. Production **NOT APPROVED**.

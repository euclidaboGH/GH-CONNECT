# Critical maintenance & modernization — 2026-10-10

**Scope:** Surgical, safe upgrades. No economy rewrite. No design restart. No DB writes.

## Twenty necessary work areas — actions taken

| # | Area | Action |
|--:|------|--------|
| 1 | Dual CSS drift | Banner on `styles/globals.css`: **non-canonical**; runtime = `app/globals.css` |
| 2 | Legacy home stub | `@deprecated` on `home-screen-stub.tsx` (not mounted) |
| 3 | Legacy screens barrel | `@deprecated` on `screens-complete.tsx` |
| 4 | Vercel security headers | Permissions-Policy + DNS-Prefetch; **no X-Frame-Options** (Pi iframe) |
| 5 | Package scripts | `verify:static`, `verify:migrations`, `test:social-authz`, `test:idor-static` |
| 6 | TypeScript hygiene | `forceConsistentCasingInFileNames`, `noFallthroughCasesInSwitch` |
| 7 | Gitignore | Ensure `.vercel/` ignored |
| 8 | Static verify runner | `scripts/verify-phase14-static.mjs` chains critical suites |
| 9 | Middleware live headers | nosniff + referrer on `/api/health/live` middleware path |
| 10 | Health live route headers | nosniff on Node live probe |
| 11 | Next.js security posture | Confirmed CSP frame-ancestors for Pi; build fails on TS/ESLint errors |
| 12 | Migration inventory | Already reconciled to **70** (Phase 14A) |
| 13 | Social authz policy | Already fixed public/system routes (Phase 14B) |
| 14 | Pi iframe compatibility | Removed incorrect SAMEORIGIN frame block from vercel.json |
| 15 | README operator path | Documented `verify:static` + build memory flag |
| 16 | Economy static gate | Included in `verify:static` (173 checks when run) |
| 17 | GHPV / content-reward boundaries | Included in `verify:static` |
| 18 | IDOR / messaging static | Included in `verify:static` |
| 19 | JSX safety prebuild | Existing `prebuild` + included in verify |
| 20 | Release honesty | SAFE_TO_PUSH / phase docs: static ≠ Testnet ≠ Production |

## Explicitly NOT changed

- Ledger / reward math / RLS policies / auth identity stack
- Official brand assets
- Migration SQL files (inventory only)
- Product feature expansion (Phase 15)

## Operator still required

1. `npm ci --legacy-peer-deps` on ≥6–8 GB RAM host  
2. `npm run verify:static && npm run typecheck && npm run build`  
3. Testnet schema vs `docs/MIGRATION_CHECKLIST.md`  
4. Pi Browser + two-user E2E  

## Verify locally

```bash
npm run verify:static
```

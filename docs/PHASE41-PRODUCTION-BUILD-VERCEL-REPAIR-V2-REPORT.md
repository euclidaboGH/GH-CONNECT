# GREENHAVEN — PHASE 41 PRODUCTION BUILD + VERCEL REPAIR V2

## Objective

Move GreenHaven from source/regression confidence toward a reproducible production build contract, with Node 24 as the single supported runtime and Vercel using the canonical clean-install/build path.

## Major changes

1. Standardized the project runtime contract on Node `^24.15.0`.
2. Kept `.nvmrc` pinned to `24.15.0`.
3. Updated `package.json` and `package-lock.json` root engine metadata to the same Node 24 contract.
4. Removed Node 22 from the executable runtime guard so unsupported Node 22 environments fail before dependency installation/typechecking/building.
5. Added `scripts/test-phase41-production-build-contract.mjs` covering runtime, Vercel build/install commands, strict TypeScript/ESLint build behavior, CI release gates, environment safety, Pi Testnet defaults and release hygiene.
6. Wired the Phase 41 production-build contract into `ci:verify`.
7. Preserved the rule that production builds must not ignore TypeScript or ESLint failures.
8. Preserved the Vercel clean install contract: `npm ci --legacy-peer-deps`.
9. Preserved the canonical build contract: `npm run build` / `ESLINT_USE_FLAT_CONFIG=false next build`.

## Static verification

- Phase 41 production build contract: **20/20 PASS**
- Phase 40 regression fortress: **50/50 PASS**
- Phase 39 backend convergence: **26/26 PASS**
- Project integrity: **36/36 PASS, 0 errors, 0 warnings**
- Database source contract: **114 executable tables / 131 migrations**

## Runtime limitation

A real dependency installation and production build were attempted from this environment, but the available container runtime is Node `22.16.0`, below the now-enforced Node `24.15.0` minimum. The clean install also could not complete within the available execution window and the local npm cache contains no usable dependency cache.

Therefore this phase does **not** claim:

- real Node 24 `npm ci`
- TypeScript compiler success under Node 24
- ESLint success under Node 24
- Next.js production build success
- browser E2E success
- Vercel deployment success
- live Supabase verification
- Pi Testnet transaction verification

Those remain explicit release gates and must be executed in the actual Node 24/Vercel environment.

## Release rule

Do not promote a deployment merely because the static contract passes. The same commit must pass a real Node 24 clean install, typecheck, lint and Next production build before Phase 41 is considered runtime-green.

## Next phase

### Phase 42 — Pi Testnet E2E

The next phase will validate the actual integrated runtime across Pi authentication, identity/session lifecycle, wallet connection, Pi payments, membership entitlement, marketplace checkout/order lifecycle, GHC wallet, Daily Claim/redemption, messaging, media, notifications/deep links and Pi Browser/mobile behavior.

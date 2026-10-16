# GH-CONNECT Vercel Build Fix 3 — 2026-10-15

## Changes made

1. Fixed the TypeScript self-reference in `lib/domains/economy-domain.ts`.
   - Renamed `const wallet = wallet()` to `const walletSnapshot = wallet()`.
   - Returned that value as `wallet: walletSnapshot`.
   - This calls the existing `wallet()` helper instead of declaring a local variable with the same name, which caused TS7022 / implicit `any`.
2. Tightened the declared Node.js engine range in `package.json` and the root package-lock metadata to `^22.22.2 || ^24.15.0`.
   - The installed `isomorphic-dompurify@3.20.0` metadata requires Node 22.22.2+ or 24.15.0+ (or 26+), and `undici@8.10.2` requires Node 22.19.0+.
   - Configure the Vercel project's Node.js version to Node 22.x at a compatible current patch, or Node 24.x at a compatible current patch. Do not force a lower runtime.
3. Preserved the existing build, type-check and lint checks; no checks were disabled.

## Warnings not safely auto-fixed

- `Unknown env config "cache-dir"`: not configured in the repository `.npmrc`. Inspect Vercel Project Settings → Environment Variables and remove/correct an injected `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` or equivalent unsupported `cache-dir` setting if present.
- `isomorphic-dompurify@3.20.0` deprecation notice: Node engine compatibility is documented above. A package downgrade/upgrade requires regenerating the lockfile against the registry; registry access was unavailable in this environment, so package versions were not changed by hand.
- `eslint@9.39.5` deprecated/unsupported notice: kept dependency versions stable rather than making an unverified major upgrade that could conflict with `eslint-config-next@15.5.26`. Upgrade ESLint only together with a verified compatible Next.js ESLint config and regenerated lockfile.
- `12 vulnerabilities`: must be reviewed with `npm audit` against the registry and fixed advisory-by-advisory. `npm audit fix --force` was intentionally not used because it can introduce breaking dependency changes.
- `unrs-resolver` install-script approval notice: review the package and approve only if its postinstall script is expected and trusted in the project's build policy.

## Verification status

- Source-level correction applied.
- A complete dependency install and production build could not be run in this environment: registry packages were not available in npm's offline cache. Therefore this archive is not represented as a fully verified green build; Vercel must run the full checks after deployment.

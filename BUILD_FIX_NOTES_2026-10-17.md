# GH-CONNECT build remediation notes — 2026-10-17

## Latest build failure fixed

`lib/profile/sanitize-profile-media.ts` accessed `photos` and `coverPhoto` directly on generic type `T`. TypeScript cannot assume those keys exist on every `T extends Record<string, unknown>`. The helper now performs media-specific edits through a `Record<string, unknown>` clone, preserves unrelated fields, preserves explicit `null`/empty-string cover-photo clearing, filters `blob:`/`data:` URLs, caps photos at six, and returns the preserved generic shape.

This change fixes the reported compile-time error without disabling type checks.

## Warnings requiring environment/dependency verification

- `Unknown env config "cache-dir"`: `.npmrc` in the repository does not contain this option. Inspect Vercel project/team environment variables for `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` or equivalent injected npm config and remove/correct the obsolete setting.
- `isomorphic-dompurify@3.20.0`: the package itself warns about a semver/Node compatibility mismatch. Upgrade to a compatible 4.x release only with a refreshed lockfile and regression checks for all sanitization call sites, or pin 3.19.0 if the deployment runtime is below the package's corrected Node floor.
- `eslint@9.39.5`: the installed version is reported unsupported. Review current ESLint support and Next.js 15 config compatibility, then pin a supported compatible release and refresh `package-lock.json`.
- `npm audit` reports 14 vulnerabilities (2 low, 1 moderate, 11 high). Run a fresh `npm audit --json` with registry access and resolve by advisory and dependency path. Do not run `npm audit fix --force` blindly.
- `unrs-resolver@1.12.2` install script: review the dependency provenance and whether the postinstall is required. Approve only if verified; do not disable package lifecycle security globally.

## Verification status

The patch is source-level. A clean `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, project safety tests, `npm audit`, and full `npm run build` must be run in CI/Vercel before claiming the deployment is green. Keep existing mainnet/testnet environment separation and database configuration unchanged.

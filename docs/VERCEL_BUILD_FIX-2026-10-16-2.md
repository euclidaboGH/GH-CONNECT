# Vercel build fix — 2026-10-16 (follow-up)

## TypeScript blocker fixed

In `components/ghc/enhanced-post-card.tsx`, the image filter previously called `isDurableMediaUrl(u)` before checking the data-image fallback. Because `isDurableMediaUrl` is a type predicate (`url is string`), TypeScript narrowed `u` to `never` in the false branch when `u` was already inferred as a string, making `u.startsWith(...)` invalid. The filter now checks the bounded data-image case first and then calls `isDurableMediaUrl`, preserving the intended behavior and avoiding the invalid narrowing.

The `components/ghc/connection-card.tsx` imports for `MATCH_CLARITY` and `formatIntentChip` are also present to address the earlier reported missing-name error if the deployment branch still contains that version of the file.

## Warnings requiring deployment/environment review

- `Unknown env config "cache-dir"`: this option is not present in the repository `.npmrc`. Check Vercel Project Settings → Environment Variables for `NPM_CONFIG_CACHE_DIR`, `npm_config_cache_dir`, or a related injected setting; remove/correct the unsupported setting rather than masking it in source.
- `isomorphic-dompurify@3.20.0`: its published warning says Node.js versions below `22.22.2` should use `3.19.0` or use the corrected `4.x` line. The project engine range expects Node `^22.22.2 || ^24.15.0`; confirm the actual Vercel Node version before changing this dependency.
- `eslint@9.39.5`: npm reports this version is no longer supported. Upgrade only after checking the currently supported ESLint release and compatibility with the project's Next.js 15.5.26 / `eslint-config-next` setup; update `package.json` and `package-lock.json` together.
- `12 vulnerabilities`: run `npm audit` against the deployed lockfile and review the advisories/transitive paths before applying targeted fixes. Do not run `npm audit fix --force` blindly because it can introduce breaking upgrades.
- `unrs-resolver` install script: review the package and its postinstall script before approving it; do not approve automatically without verifying dependency provenance and necessity.

## Verification status

The source-level fixes are applied. A full local TypeScript/build verification was not completed in this environment because dependency installation did not finish, so the next Vercel build remains the definitive verification step.

# GH-CONNECT build fix notes — 2026-10-17

## Fixed in this package

- Fixed the `contexts/ghc-context.tsx` TypeScript error in the post-engagement event listener. The validated `postId` is captured into a local constant before the React state updater, so the type narrowing is retained inside the callback. Empty or missing IDs are ignored.
- Retained the existing strict build/type validation and production-safety checks; no TypeScript or ESLint build checks were disabled.

## Checks run here

- `node scripts/check-jsx-safety.mjs` — passed (627 files scanned).
- `node scripts/scan-production-safety.mjs` — passed (21 checks, 0 failures).
- `npm audit` could not reach `registry.npmjs.org` in this environment, so dependency vulnerability counts and safe dependency updates could not be verified.
- A full `npm ci`, `npm run typecheck`, and `npm run build` were not run here because dependencies are not installed and registry access is unavailable. A successful Vercel build is not claimed.

## Remaining Vercel/npm warnings requiring follow-up

- `Unknown env config "cache-dir"`: remove the obsolete `npm_config_cache_dir` / `NPM_CONFIG_CACHE_DIR` setting from the Vercel project or organization environment if present. This warning is emitted by npm configuration, not by the TypeScript source.
- `isomorphic-dompurify@3.20.0`: the build log says this release has an incorrect semver/minimum-Node declaration. The project declares Node `^22.22.2 || ^24.15.0`; upgrade to a compatible 4.x release only after updating both `package.json` and `package-lock.json` and running the full test/build suite. Do not edit the lockfile by hand.
- `eslint@9.39.5`: check the currently supported ESLint major against the project's Next.js 15.5.26 `eslint-config-next` peer dependencies before upgrading. Do not force ESLint 10 into this Next.js 15 setup without confirming compatibility.
- `14 vulnerabilities`: the registry audit endpoint was unreachable here, so the advisory details were unavailable. Run `npm audit --json` in CI or locally with registry access, then apply compatible fixes and review breaking changes. Avoid `npm audit fix --force` without reviewing the dependency tree.
- `unrs-resolver` install script: review why the dependency is present and approve its postinstall script through the package manager only if it is a trusted, required dependency. Do not broadly allow install scripts.

## Deployment safety

Deploy this package to the testnet Preview first. Preserve the current mainnet/testnet environment-variable split and separate Supabase projects. Do not run database migrations as part of fixing this TypeScript error.

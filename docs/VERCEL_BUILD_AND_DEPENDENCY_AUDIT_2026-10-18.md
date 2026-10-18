# Vercel build and dependency audit — 2026-10-18

## Fixed in this source upgrade

- Moved the stable `addToast` callback above the messaging-preferences effect that calls it. This resolves the reported TypeScript build failure (`Block-scoped variable 'addToast' used before its declaration`) without suppressing type checking.
- Corrected both daily reward claim callbacks to include `daily.streakDays` in their dependency arrays.
- Made the message-read effect compare `selected?.id` to `selectedId`, avoiding a dependency on the whole `selected` object while retaining the guard against marking a stale/missing conversation read.
- Added `initialMode` to the compose event effect's dependencies so a mode change cannot leave stale event-handler behavior.
- Added `scripts/test-vercel-build-repair.mjs` and the `test:vercel-build-repair` npm script. It is included in `ci:verify` to guard against these regressions.
- Moved `permanentFailure` and its associated error string to the outer scope of `sendMessage`, so the final return value and optimistic-message reconciliation can read them. This fixes the new TypeScript failure (`Cannot find name 'permanentFailure'`) without suppressing type checks.
- Extended the regression script to assert the outcome variable is declared once at the correct function scope.
- Bumped the app package version to `0.59.7` and kept the root package-lock version aligned.

## Items that cannot be safely repaired by source edits alone

### 1. `Unknown env config "cache-dir"`

The project's `.npmrc` contains only `legacy-peer-deps=true`, `fund=false`, `package-lock=true`, and the registry URL; it does not define `cache-dir`. The operator also confirmed that `NPM_CONFIG_CACHE_DIR` and `npm_config_cache_dir` are absent from Vercel Environment Variables. Therefore, do not keep searching for those two exact names. Check for the hyphenated key `npm_config_cache-dir` / `NPM_CONFIG_CACHE-DIR`, a different Vercel Root Directory pointing to another `.npmrc`, or a setting injected by the build environment. If none exists, preserve the warning in the deployment notes and contact Vercel support with the build ID: it is a warning, not the current TypeScript blocker. npm's supported cache option is `cache` / `NPM_CONFIG_CACHE`; do not add an unsupported `cache-dir` key to `.npmrc`.

### 2. Dependency vulnerabilities and deprecated packages

The supplied deployment log reports 14 npm audit findings (2 low, 1 moderate, 11 high), `isomorphic-dompurify@3.20.0` deprecation, and EOL `eslint@9.39.5`. This workspace could not reach `registry.npmjs.org` during the audit (`EAI_AGAIN` DNS resolution failure), so the exact advisory tree and a refreshed, integrity-verified lockfile could not be retrieved. No `npm audit fix --force` was applied because it may change major framework versions and break the application.

Security research during this pass indicates that Next.js `15.5.28` is the current patched 15.5 release relevant to security notices published after `15.5.26`. The project should update `next`, `eslint-config-next`, and `@next/eslint-plugin-next` together to the same patched 15.5.x release, regenerate `package-lock.json` with npm, and run the full verification before deployment. Do not edit only `package.json` or hand-edit lockfile integrity values.

The current Node engine range (`^22.22.2 || ^24.15.0`) is compatible with `isomorphic-dompurify` 4.x's stated Node floor. Once registry access is available, upgrade that package and regenerate the lockfile as part of the same reviewed dependency pass. ESLint 10 is current, but it is a major-version upgrade; first confirm compatibility with the project's Next 15 ESLint config, or keep the matching Next 15.5.28 ESLint config and use a supported ESLint version.

### 3. `unrs-resolver` install script approval

npm is reporting a lifecycle-script approval notice, not a compilation failure. Review the package and its parent dependency first; only approve the install script if the dependency tree and registry integrity are trusted. Do not blindly enable every package's install scripts.

## Verification status

The following local source/regression checks passed in this environment:

- `node scripts/test-vercel-build-repair.mjs` — 8/8 checks
- `node scripts/test-rewards-reliability.mjs` — 24/24 checks
- `node scripts/test-daily-claim-wallet-pipeline.mjs` — 35/35 checks
- `node scripts/test-economy-v12.mjs` — 173/173 checks
- `node scripts/verify-phase14-static.mjs` — 12/12 suites
- `node scripts/check-jsx-safety.mjs` — 637 files scanned

A full `npm ci`, ESLint run, TypeScript typecheck, Next.js production build, and fresh `npm audit` could not be run here because the npm registry was unreachable and this workspace did not have `node_modules`. These results are not a claim that the full Vercel build has already passed.

## Current build blocker fixed in version 0.59.7

The latest Vercel log showed `contexts/ghc-context.tsx:4378: Cannot find name 'permanentFailure'`. The declaration had been scoped inside an inner `try` region while the final `return !permanentFailure` sat outside that region. The declaration is now placed at the top of the `sendMessage` callback, and the inner duplicate declaration was removed. The offline queue and permanent-vs-retryable failure semantics are otherwise unchanged.

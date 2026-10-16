# GH-CONNECT build-fix report — 2026-10-16

## Applied source fix

`contexts/ghc-context.tsx` used two identity-service methods that do not exist:

- `IdentityService.getUserId()` → `IdentityService.getCurrentUserId()`
- `IdentityService.getPiUid()` → `IdentityService.getPiUserId()`

The onboarding-local identity stamp now uses the actual exported API. This resolves the TypeScript error reported at `contexts/ghc-context.tsx:1386` and corrects the Pi identity fallback to use the service's supported method.

## Validation performed

- `node scripts/check-jsx-safety.mjs` — passed (`621 files scanned`).
- Full `npm run typecheck` / production build — not run because dependencies are not installed in this workspace and the npm registry could not be reached from the environment.
- `npm audit` — unavailable: the registry audit endpoint failed with `EAI_AGAIN registry.npmjs.org`. Therefore the 12 reported vulnerabilities have not been verified or claimed fixed.

## Remaining deployment warnings and safe next steps

1. **Unknown npm `cache-dir` configuration:** the repository `.npmrc` does not define this setting. Inspect Vercel Project Settings → Environment Variables and remove/correct an accidental `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` value if present. Do not add an unsupported `.npmrc` key to hide the warning.
2. **`isomorphic-dompurify@3.20.0`:** the install warning recommends 4.x for corrected semver, or 3.19.0 for Node versions below 22.22.2. The package declares Node `^22.22.2 || ^24.15.0`; confirm Vercel's selected Node runtime and upgrade this package together with a regenerated lockfile and build/security tests. No lockfile-only version edits were made because registry access was unavailable.
3. **`eslint@9.39.5` support warning:** the project uses Next.js 15.5.26 and its matching `eslint-config-next` / Next ESLint plugin. Avoid upgrading ESLint to a major version unsupported by that Next config. Plan a coordinated framework/linter upgrade after checking the supported peer-dependency ranges, then run lint, typecheck, tests, and production build.
4. **12 npm audit vulnerabilities:** rerun `npm audit` in a network-enabled environment, review each advisory and its dependency path, then apply non-breaking fixes and regenerate/commit `package-lock.json`. Do not use `npm audit fix --force` blindly.
5. **`unrs-resolver` install script:** review the package and its dependency parent using `npm explain unrs-resolver` and `npm install-scripts ls`; approve the install script only if it is required and trusted. Do not blanket-approve scripts.

## Deployment recommendation

Use the Vercel Node.js runtime compatible with the package's declared engine (Node 22.22.2+ in the 22.x line, or 24.15.0+ in the 24.x line), then deploy the corrected branch and confirm the typecheck/build succeeds before promoting it.

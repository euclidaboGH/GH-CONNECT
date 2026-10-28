# GreenHaven upgrade worklog — v0.157.17

Date: 2026-10-28

## Build blocker repaired

Vercel's v0.157.16 build stopped during TypeScript validation because `readBoundedJson` was called but not imported as executable code in `app/api/economy/purchase-ghc/route.ts`. A repository-wide scan found the same import inside the leading documentation comment in two more routes: `app/api/economy/utility/route.ts` and `app/api/economy/rewards/daily/route.ts`. All three imports are now outside their comments.

## Regression prevention

- Added `scripts/check-bounded-json-imports.mjs`, which scans API routes using `readBoundedJson` and verifies that exactly one executable import exists outside block comments.
- Added `npm run check:bounded-json-imports`.
- Added this check to the `prebuild` gate so a repeat of this specific omission fails before Next.js starts compiling.
- Updated package and lockfile root versions to `0.157.17`.

## Deployment warnings — status and action

These warnings were present in the supplied Vercel log and are not all source-code defects:

- `Unknown env config "cache-dir"`: not present in the repository `.npmrc`. Check Vercel project environment variables and build settings for an injected `npm_config_cache_dir` or equivalent malformed npm config; remove/fix the variable at its source, then redeploy. Do not add an unsupported `cache-dir` entry to `.npmrc`.
- 16 npm audit findings (1 low, 13 high, 2 critical): an audit attempt from this build environment could not reach `registry.npmjs.org`, so exact advisory records and safe remediation paths could not be verified. Do not run `npm audit fix --force` blindly. Run `npm audit --json` in CI or a network-enabled trusted environment, identify direct vs transitive paths and available non-breaking fixes, then update package.json and package-lock.json together and rerun build/tests. Treat critical/high findings as release blockers until triaged.
- `isomorphic-dompurify@3.20.0`: npm warns that the package's Node engine requirement was raised without a major-version bump. Vercel's runtime is Node 24.22.1, but the package should still be deliberately aligned to a semver-correct supported release after checking API compatibility and the lockfile audit. No unverified major upgrade was applied.
- `js-xdr`, `stellar-base`, `stellar-sdk`: upstream packages advertise successor package names. These may be transitive and replacing them safely requires tracing imports and dependency ownership first; no speculative SDK swap was applied to payment-related code.
- `eslint@9.39.5`: npm reports the installed version is no longer supported. Upgrade the lint toolchain only after checking Next.js 15.5.26, the current legacy ESLint configuration, and plugin compatibility. No unverified major upgrade was applied.
- `sodium-native` and `unrs-resolver` install scripts are not covered by npm's install-script allowlist. Review their dependency paths and scripts in CI; approve only the exact packages whose lifecycle scripts are required and trusted. Do not blanket-approve all install scripts.

## Verification boundary

The import regression checker passes across all 54 API routes currently calling `readBoundedJson`. The full Next.js build, TypeScript check, lint, and live Vercel deployment must still be run against this archive/commit. The npm audit endpoint was unavailable from this environment, so dependency advisories remain unresolved rather than being represented as fixed.

The repository's supported Node.js baseline remains Node.js 24.15.0 or newer within the project's configured engine range. This environment could not reach the npm audit endpoint, so full dependency audit and full production build verification are still pending.

These are source-level regression checks and do not substitute for a full TypeScript/lint/production build or live provider verification under Node.js 24.15.0+.

The bounded JSON helper runtime test passes 9/9. On the available Node.js 22.16.0 test host, this test emits Node experimental type-stripping and typeless-package warnings; do not change the whole application package to ESM just to silence them because that can alter Next.js/script behavior. Run the final build with the declared Node.js 24.15.0+ environment.

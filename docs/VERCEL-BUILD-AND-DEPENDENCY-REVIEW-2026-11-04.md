# Vercel build and dependency review — 2026-11-04

## Confirmed build blocker and correction

The supplied Vercel log fails in `prebuild` at `scripts/check-pass21-discovery-intelligence.mjs` (8/9). The discovery screen already imports and calls `buildDiscoveryOutcome` from `lib/discovery-outcome.ts`, and renders the result in an accessible section labelled through the translated `discoveryOutcome` key. The guard incorrectly required the literal English phrase `Discovery outcome` to appear in the component source. That phrase is not required because the UI uses the translation catalog. The guard now verifies the real integration contract: the shared model import, invocation, and translated accessible label. It does not remove or weaken the outcome-model requirement.

## Findings from the supplied log

- `npm ci --legacy-peer-deps` completes, but reports 29 advisories: 1 low, 13 moderate, 13 high, and 2 critical.
- The log reports `isomorphic-dompurify@3.20.0` as deprecated due to a Node engine/semver mismatch; npm's warning explicitly identifies 4.x for compatible newer Node runtimes, or 3.19.0 for Node versions below 22.22.2. The project's declared engine is Node `^24.15.0`, and the deployment log ran Node `v24.22.2`; confirm package compatibility and test before changing the major.
- `stellar-sdk`, `stellar-base`, and `js-xdr` are deprecated in favour of the `@stellar/*` package names. The lockfile shows `stellar-sdk` is brought in through `pi-backend`; migrate only after confirming the SDK import/API contract and `pi-backend` compatibility. Do not blindly replace transitive packages.
- ESLint 9.39.5 is reported unsupported by the upstream support policy. Upgrade ESLint and its Next.js integration as a coordinated set after checking the project's legacy `.eslintrc` and `ESLINT_USE_FLAT_CONFIG=false` setup.
- npm reports unknown environment config `cache-dir`. It is not present in the supplied repository `.npmrc`; inspect Vercel Project Settings → Environment Variables and remove/rename the obsolete `NPM_CONFIG_CACHE_DIR`/`npm_config_cache_dir` setting if configured. Do not add a speculative `.npmrc` workaround.
- npm reports install scripts for `sodium-native` and `unrs-resolver`. Review their provenance and necessity, then allow only required scripts through the package manager's explicit script-approval mechanism. Do not globally allow all install scripts.

## Validation limitations

The Discovery Intelligence guard now passes 9/9 and project-truth passes 10/10 in the inspection environment. The inspection container has Node `v22.16.0`, below the repository's declared Node `^24.15.0`; therefore it is not a valid environment for a full project build. A live `npm audit` request could not reach `registry.npmjs.org` from this environment. The 29 advisory records were not included in the supplied log, so exact vulnerable dependency paths and safe fixed versions cannot be asserted. No broad dependency upgrades or `npm audit fix --force` were applied without those records and a Node 24 build/test environment.

## Required next verification

1. Run `npm audit --json` using the project's Node 24 runtime and preserve the full report.
2. Apply non-breaking patched versions first; treat major upgrades (DOMPurify, Stellar SDK, ESLint/Next.js) as separate tested migrations.
3. Run `npm ci --legacy-peer-deps`, the complete `npm run prebuild`, `npm run typecheck`, `npm run lint`, and `npm run build` on Node 24.15+.
4. Confirm the two native install scripts are needed and explicitly approve only those required.
5. Redeploy to Vercel Preview before promoting to Production.

## GitHub Actions release-hygiene follow-up

The later GitHub Actions log failed because the repository tree did not contain `.env.example`, despite `.gitignore`, the canonical project documentation, and multiple existing release gates requiring that safe template. Restored the root template with empty credential placeholders and only conservative `0`/`1` feature defaults. Pi payout requests and execution, registration bonuses, referral settlement, curation redistribution, and other issuance switches remain disabled by default; `PI_NETWORK` is intentionally left blank and documented as a deployment setting for Testnet-only gated flows. No live credentials or wallet seeds were added.

Validation after restoring the template:

- `npm run check:release-hygiene`: 11/11.
- `npm run verify:static`: passed (exit 0).
- Phase 1 foundation: 10/10; Phase 2 operator hardening: 7/7; registration bonus: 18/18; wallet A2U: 16/16; economy Stage 1: passed; Phase 26 wallet resilience: 17/17.
- CI-equivalent checks for JSX safety, bounded JSON runtime, Phase 17–19 contracts, security headers, CSRF, production safety scan, payment recovery/timeline, project truth, Pi backend lock, clean migrations, migration release readiness, database recovery/catalog, and recovery-gate runtime tests passed.
- The broader `verify:production` pack is not clean in this Node 22.16.0 inspection container: it reports existing failures in post-curation dashboard, Stories rail v2, and feed/creator verification checks, and did not complete within the available execution window. These failures are separate from the missing environment template and require their own source-level investigation.
- Full prebuild/typecheck/lint/Next.js build and Vercel deployment remain unverified here because the available Node runtime is 22.16.0 while the project requires Node 24.15.0 or newer.

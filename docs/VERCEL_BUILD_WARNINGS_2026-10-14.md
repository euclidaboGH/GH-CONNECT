# GH-CONNECT — Vercel build and warning remediation (2026-10-14)

## Applied in this pass

1. **TypeScript blocker:** the profile content-library `<video>` element no longer uses the unsupported `referrerPolicy` JSX property. The existing `referrerPolicy="no-referrer"` settings on supported image/link elements remain unchanged.
2. **ESLint config import failure:** updated `eslint.config.mjs` to import `eslint-config-next/core-web-vitals.js` with an explicit `.js` suffix. The prior extensionless import failed under Node ESM resolution in Vercel (`Cannot find module ... Did you mean ... .js?`). The config still uses Next.js Core Web Vitals rules and preserves the existing overrides and ignored directories.
3. **Static validation:** JSX safety passed for 613 files; TypeScript/JS syntax transpilation passed for 613 files; profile audits passed 87/87, 83/83, and 84/84; IDOR static checks passed 124/124; social authorization checks passed 31/31; static verification passed 11/11; production safety passed 21/21; release verification passed 30/30.

## Follow-up from the latest Vercel log

- The application compiled and static pages/routes were generated, but the build log reported an ESLint configuration import failure. This pass corrects that exact path-resolution error. A fresh Vercel deployment must confirm that the config loads and expose any actual lint/type errors that were previously masked by the config failure.

## Verification limitation

A full `npm run typecheck`, `npm run lint`, and `npm run build` could not be completed in this workspace because `npm ci --legacy-peer-deps` could not finish fetching dependencies. The attempted typecheck consequently reports missing installed type packages (`react`, `react-dom`, `node`, `qrcode`, etc.), not a verified list of application source errors. The Vercel build must run again after these changes to reveal any further compiler errors. Do not treat syntax transpilation as a replacement for `tsc`.

## Warnings intentionally not force-fixed

- **`Unknown env config "cache-dir"`:** not present in the repository's `.npmrc`; likely injected as an npm environment/config setting by the Vercel project or build environment. Inspect Vercel Project Settings → Environment Variables for `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` (or an equivalent `cache-dir` setting) and remove/correct that setting if it was added by the project. Do not add an unrelated `.npmrc` option to mask it.
- **`isomorphic-dompurify@3.20.0`:** its release raised the Node.js floor without a major-version bump. The package maintainer's warning recommends 3.19.0 for Node runtimes below 22.22.2. This pass does not alter the package or lockfile without a registry-backed lock regeneration and confirmation of the deployed Node version. The warning is caused by package deprecation metadata, not by a source-code error. On the project machine, verify the Vercel Node.js setting, then use `npm install --save-exact isomorphic-dompurify@3.19.0` if the deployment is below 22.22.2; commit both `package.json` and `package-lock.json`, and rerun tests. Do not pin 3.19.0 if the runtime/engine policy or package API usage says otherwise.
- **`eslint@9.39.5` is end-of-life:** Next 15.5.26 declares compatibility with ESLint 9, not ESLint 10. Upgrading only ESLint to 10 would risk breaking the installed Next lint integration. Handle this with a tested coordinated Next.js + `eslint-config-next` upgrade (likely Next 16), not `npm audit fix --force`. Next 15 and `eslint-config-next@15.5.26` explicitly peer-support ESLint 9; moving only ESLint to 10 would create a peer-compatibility risk.
- **12 npm audit vulnerabilities:** the build log does not include the advisory details. Run `npm audit --json` or `npm audit` in the repository after a clean install, review each direct/transitive dependency and breaking-change impact, then apply compatible fixes and rerun typecheck, lint, tests, and build. Avoid `npm audit fix --force` without reviewing the proposed major upgrades.
- **`unrs-resolver` install script:** this is an explicit npm install-script allowlist warning. It is left visible rather than blindly approving a dependency lifecycle script. Review the package and its parent dependency (`eslint-import-resolver-typescript`) first; approve only if required and accepted by the project supply-chain policy.

## Required verification on the project machine / Vercel

```powershell
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run check:jsx
npm run test:safety
npm run build
npm audit
```

If typecheck reports another source error, fix that error rather than setting `ignoreBuildErrors` or disabling type validation. Keep the build and typecheck gates enabled.

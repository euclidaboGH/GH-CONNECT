# Dependency security remediation — Run 320

## Source and deployment baseline

- Source of truth: `GREENHAVEN-0.338.99-RUN318-PI-AUTH-RELIABILITY-FULL-PROJECT-2026-11-17-2.zip`.
- Repository: `euclidaboGH/GH-CONNECT`, branch `testnet`, commit `347c849a6d93ac62fdeaf03e8528ee26a9e65700`.
- Vercel project: `gh-connect-5p3o`, framework Next.js, Node 24.x, root directory unset (repository root).
- Preview deployment `dpl_5dyDAqhqAhQzi5YcJSeyMdsTMsrP` reached `READY` after a cache-free build. `npm ci --legacy-peer-deps` succeeded; 364 prebuild checks ran; Next.js build and serverless output completed. This verifies build health, not dependency safety.

## Confirmed vulnerability count

Vercel's npm install output for the source commit reported:

- 2 critical
- 21 high
- 5 moderate
- 1 low
- 29 total

The build log did not include the package-level advisory paths. The local `npm audit --json` attempt failed with `EAI_AGAIN registry.npmjs.org`, so it did not produce an advisory report. An offline npm audit against the local cache returned zero because it had no registry advisory data; that result is **not** evidence that the project is clean and must not be used as a security sign-off.

## Changes in this remediation package

1. Added `.github/dependabot.yml` for weekly npm and GitHub Actions update PRs.
2. Added `.github/workflows/dependency-security.yml` to run on pushes, pull requests, weekly schedule, and manual dispatch. It uses Node 24.15.0, verifies the committed lockfile, installs with `npm ci --legacy-peer-deps`, produces a complete `npm audit --json` report, uploads the report for 30 days, and fails the security gate when any known finding remains or the registry audit cannot complete.
3. Added `scripts/check-dependency-security-policy.mjs` and registered it in `verify:static`.
4. Preserved the existing Pi authentication, wallet, consent, payment, and Testnet boundaries. No schema, balance, authorization, payout, or Mainnet settings were modified.

## Important unresolved work

The 29 dependency advisories are **not yet remediated**. This environment could not resolve `registry.npmjs.org`, and the connected GitHub integration denied branch creation (`403 Resource not accessible by integration`). Therefore no dependency versions or lockfile entries were changed, and no security PR was pushed. Manually editing lockfile package versions or applying `npm audit fix --force` without advisory metadata and a working registry would be unsafe, particularly for Pi/ Stellar transaction code and the React/Next runtime.

The next secure remediation pass must run with npm registry access and must:

1. Retrieve the full `npm audit --json` report and preserve each advisory ID, package path, severity, range, and fixed version.
2. Resolve critical/high findings first using the smallest compatible upgrades; avoid blanket major upgrades.
3. Review the deprecated `stellar-sdk` / `stellar-base` chain separately. `pi-backend@0.1.3` depends on `stellar-sdk@^10.4.1`; replace it only with a verified compatible Pi backend SDK or a tested adapter migration, never by changing imports blindly.
4. Update `package.json` and regenerate `package-lock.json` with npm 10 on Node 24.15+.
5. Run `npm ci --legacy-peer-deps`, the complete static suite, typecheck, lint, production build, Pi auth tests, wallet/consent tests, and payout recovery tests.
6. Re-run online `npm audit --json` and confirm zero vulnerabilities. Review any remaining accepted risk explicitly; do not suppress advisories.
7. Deploy to Preview and perform Pi Browser acceptance before considering Production.

## Security posture and compatibility notes

- The existing `vercel.json` Content Security Policy includes `unsafe-eval` and Pi Browser origins. Removing it without a real Pi SDK/browser acceptance test could break authentication or embedded Pi flows. It remains a targeted hardening candidate, not a safe blind edit.
- `isomorphic-dompurify@3.20.0` emitted a Node engine semver/deprecation warning. The project requires Node `^24.15.0`, so its declared Node range includes the current Vercel Node 24 runtime; upgrade to a corrected release only after API compatibility tests for `lib/sanitizer.ts`.
- The current `next.config.mjs` intentionally keeps image optimization off by default and limits build concurrency due prior Vercel resource pressure. These settings were not relaxed.

## Verification performed

Passed locally on the source tree:

- Pi authentication reliability: 11/11.
- Security audit source guards: 34/34.
- Security headers: 7/7.
- Wallet security hardening: 12/12.
- Vercel build contract: 20/20.
- Vercel build hygiene: 17/17.
- Dependency lock integrity: passed.
- New dependency security policy: 8/8.

Local runtime is Node `v22.16.0`, below the project's required `^24.15.0`; no local production build is claimed. The Vercel Preview build described above is the valid Node 24 build verification.

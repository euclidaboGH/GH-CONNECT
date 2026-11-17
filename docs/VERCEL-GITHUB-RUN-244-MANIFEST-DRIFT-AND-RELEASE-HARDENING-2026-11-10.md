# Run #244 — migration manifest drift and release hardening

## Source and confirmed failure

- Source baseline: `gh-connect@0.338.20`, Run #243 release-alignment archive.
- GitHub Actions Run #244 failed in the complete static verification suite.
- The first confirmed failure was `VERIFIED_MANIFEST.txt` retaining `project_version=0.338.19` while package, lockfile, README and app release identity were `0.338.20`.
- Running the complete local static suite exposed three additional stale documentation contracts: the Phase 1–12 acceptance baseline, the current worklog's explicit Node 24.15.0 verification boundary, and the Phase 12 release report identity.
- The separately supplied build excerpt ends with `npm run build exited with 1` but does not include the underlying compiler/type diagnostic. The build failure is therefore not attributed to an invented cause and remains an external validation item until the full build log is available.

## Ten safe release-quality improvements

1. Regenerated the four deterministic migration inventory artifacts from the canonical 199-file SQL directory and current package version; no classification or SQL migration was changed.
2. Strengthened `check-project-truth.mjs` to run the generator in `--check` mode and surface actionable drift output.
3. Updated the Phase 1–12 acceptance fixture to identify `0.338.20` while preserving its historical-fixture warning.
4. Updated the Phase 12 final integration report to identify `0.338.20` and retain the explicit production NOT APPROVED boundary.
5. Documented the actual Node.js 22.16.0 / missing `node_modules` limitation in the `0.338.20` worklog, including the required Node.js 24.15.0 verification runtime.
6. Repaired the wallet-authorization regression check to inspect the current `PiWithdrawSheet` intent reference, retry key reuse, PIN-bound idempotency key and reset only after accepted request; it no longer checks retired dashboard-local state.
7. Added exact Node.js 24.15.0 assertions to the GitHub Actions static-verification job.
8. Added the same exact Node.js 24.15.0 assertion to the separate CI build job.
9. Updated Vercel's install command to unset obsolete `npm_config_cache_dir` / `NPM_CONFIG_CACHE_DIR` variables before `npm ci`, matching the GitHub Actions install behavior.
10. Added this Run #244 report to documentation hygiene so the root cause, dependency decisions and acceptance limits remain auditable.

## Dependency warnings

- `cache-dir`: both GitHub Actions and the Vercel `installCommand` now unset `npm_config_cache_dir` and `NPM_CONFIG_CACHE_DIR` before npm starts. If Vercel still reports this warning, a dashboard-level environment injection or override remains; remove the obsolete variable in Vercel Project Settings.
- `isomorphic-dompurify@3.20.0`: upstream marks this patch release deprecated due to a Node minimum-version change. A major-version move can affect sanitizer import/runtime behavior; do not change it without the Node 24.15.0 test suite and sanitizer regression tests.
- `js-xdr`, `stellar-base`, `stellar-sdk`: upstream package names have moved to `@stellar/*`. These are part of the Pi/Stellar transaction dependency graph; renaming them without a complete API/import and provider compatibility review is unsafe.
- `eslint@9.39.5`: upstream support status needs a deliberate ESLint/Next.js compatibility upgrade, not an untested major bump during a release-blocker repair.
- `sodium-native` and `unrs-resolver` install scripts: no new install-script allowlist was added. Native/optional binary install scripts must be reviewed against exact package provenance and CI runtime before approval.

## Safety and verification limits

- No migration was applied, generated migration classifications were not changed, and no remote database was contacted.
- No Pi transfer, payout, GHC ledger mutation, production flag, deployment setting, GitHub push or Vercel deployment was performed.
- Production remains **NOT APPROVED**.
- The supported runtime is Node.js `24.15.0`. The local review runtime is Node.js `22.16.0` and has no `node_modules`; therefore this report does not claim a full dependency-backed TypeScript, lint or Next.js production build pass.
- The full Next.js build failure's underlying diagnostic was not present in the supplied log excerpt. Capture the complete Vercel build log from the first compiler error before treating that separate build issue as resolved.

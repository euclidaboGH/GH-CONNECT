# RUN377 — Dependency audit and CI failure analysis (2026-11-19)

## Source evidence

The latest accessible GitHub Actions workflow for `euclidaboGH/GH-CONNECT` was run `44501928637` on branch `testnet`, commit `58eb5a359fc98843f2db8c453d828880d5f50c87` (the pre-RUN376 remote baseline).

- Static verification job: **success**.
- Typecheck/lint/build job: **failure** before `tsc` ran. The failing step was `check-run288-type-safety.mjs`, which required that its gate be the first command in `pretypecheck`. The remote package had it later in the command chain.
- Reproducible npm security audit: **failure after 53 seconds** at the explicit zero-known-vulnerabilities policy step. `npm ci --legacy-peer-deps` and report generation succeeded; audit itself returned 22 vulnerable package entries.

The archived npm audit report is artifact `npm-audit-44501928581-1` from run `44501928581`.

## Exact advisory summary

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 13 |
| Moderate | 6 |
| Low | 2 |
| **Total** | **22** |

Notable package findings from that exact report:

- `next` at the old 15.5.26 line: critical; npm reported a non-major fix at 15.5.29. The advisory includes an unauthenticated image-optimization RCE condition when SVG files are used. The deployed image-optimization configuration and SVG handling must be reviewed along with the patch upgrade.
- `@simplewebauthn/server` 13.2.2: low; reported fix 13.3.3.
- Playwright and `@playwright/test`: high; patch availability reported, exact lockfile resolution must be refreshed and tested.
- `postcss`, `sharp`, `source-map-js`, `undici`, `dompurify`, `follow-redirects`, `brace-expansion`, `minimatch`, and TypeScript ESLint transitive packages: additional findings, several with non-major fixes available.
- `zod` 3.25.67: high; npm reported 4.6.7 as the available fix and marked it as a major change. Do not apply without a Zod v3→v4 compatibility migration and full type/runtime testing.
- `pi-backend` 0.1.3 → `stellar-sdk` 10.4.1: high, with transitive `axios` and `toml` findings and no automatic fix reported. This requires a deliberate Pi integration dependency decision, not an arbitrary override.

## Local remediation performed

- Moved `check-run288-type-safety.mjs` to the first position in `pretypecheck`.
- Added RUN376 economy/curation/withdrawal regression gates to `pretypecheck` so TypeScript cannot run without the new financial safety contracts.
- Re-ran RUN288 type-safety contract: **8/8 PASS**.
- Re-ran package/release identity contract: **22/22 PASS**.
- Did not run blanket `npm audit fix` or `npm audit fix --force`.
- Did not change dependency versions or lockfile resolutions because the local npm registry request failed with `EAI_AGAIN`; there is no dependency cache in this workspace. Updating only `package.json` without a regenerated lockfile would break reproducible installs.

## Required dependency remediation sequence

1. On a network-enabled Node 24.15.0 environment, patch Next.js to the reported fixed 15.5.29 line and regenerate `package-lock.json`; verify the exact advisory is closed.
2. Patch `@simplewebauthn/server`, Playwright, `sharp`, `source-map-js`, `undici`, `postcss` and other non-major fixes only where the resulting lockfile proves the vulnerable versions are gone.
3. Review the Next image route/configuration and SVG handling; do not assume a package patch alone resolves unsafe SVG behavior.
4. Plan a separate Zod v3→v4 migration with schema compatibility tests; do not force it into the patch release.
5. Replace or upgrade the `pi-backend`/legacy `stellar-sdk` dependency chain only after auditing its actual usage and verifying Pi Platform authentication/payment behavior in Testnet. Do not override `axios` or `toml` without checking the SDK's supported dependency range.
6. Re-run clean `npm ci`, `npm audit --json`, Node 24.15.0 typecheck, lint, Next build and the full static suite. Preserve the zero-vulnerability gate; do not weaken it to obtain a green workflow.

## Release decision

Dependency security is **NOT CLEARED**. The local RUN376 source fixes do not alter the archived remote workflow result. The pretypecheck-order defect is fixed locally but awaits a new CI run. Production remains **NOT APPROVED** until the critical/high findings are remediated or explicitly dispositioned with evidence, and all build/runtime/operator gates pass.

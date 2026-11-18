# RUN337 — GitHub audit and environment-template repair (2026-11-18)

**Package:** `gh-connect@0.338.99`  
**Parent:** RUN336 GitHub Desktop cleanup candidate  
**Status:** local source candidate only; not pushed or deployed. Production remains NOT APPROVED.

## Confirmed GitHub Actions failures

The supplied run is GitHub Actions run `44237574920`, commit `9ceeaeafcf0f4b08c2b390fadfed0111a70ce285`, branch `testnet`, on Node `24.15.0` / npm `11.12.1`.

### 1. Missing `.env.example`

The prebuild failed at `scripts/check-run332-audit-remediation.mjs` because it unconditionally reads the root `.env.example`. The archive/branch did not contain that file even though `.gitignore` and `.vercelignore` explicitly allow the safe example template. The exact previously committed template was restored from the parent of the failing commit (`7a3932c5fadd000d4299bb0202b3ebaeb687b197`), rather than inventing configuration values. It contains blank privileged secrets and preserves `PI_NETWORK=testnet`, `NEXT_PUBLIC_PI_SANDBOX=true`, and disabled A2U/payout switches. Local `.env`, `.env.local`, and other populated environment files remain excluded.

### 2. Dependency security audit

The workflow's audit artifact `npm-audit-44237574920-1` (artifact ID `14397778034`, SHA-256 `c00690ee75ffee977baed6a547bb044bc56928ae082225a99346296687451acd`) was downloaded and inspected. It reports **29 findings: 2 critical, 21 high, 5 moderate, 1 low**.

The complete original JSON report is preserved at `docs/security/RUN337-NPM-AUDIT-44237574920.json`. The vulnerable package inventory is:

- Direct or root-level packages: `next`, `@next/eslint-plugin-next`, `eslint-config-next`, `@playwright/test`, `@simplewebauthn/server`, `zod`, and `pi-backend`.
- Transitive/tooling packages: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `axios`, `brace-expansion`, `dompurify`, `fast-glob`, `follow-redirects`, `eslint-import-resolver-typescript`, `micromatch`, `minimatch`, `picomatch`, `playwright`, `postcss`, `sharp`, `source-map-js`, `stellar-sdk`, `tinyglobby`, `toml`, and `undici`.

Critical advisories affect the current `next@15.5.26` and its DOMPurify dependency. The audit metadata identifies `next@15.5.29` as a non-major patch candidate; upstream `isomorphic-dompurify@4.7.0` is available and has the corrected Node engine declaration. Other reported fix candidates include `@simplewebauthn/server@13.3.3`, patched Playwright, patched `sharp`, and Zod 4.6.7 (a major-version migration).

The Pi SDK dependency chain is a special blocker: `pi-backend@0.1.3` depends on `stellar-sdk@10.4.1`; that Stellar SDK pins `axios@0.25.0` and `toml@^2.3.0`. The audit reports no automatic fix for the `pi-backend` / `stellar-sdk` / `toml` chain. Do not remove or override the Pi SDK's transitive dependencies without a vendor-compatible release and Pi Testnet payment, A2U, and receipt-verification regression tests. The current container cannot resolve `registry.npmjs.org`, so a new lockfile with authentic registry integrity hashes could not be generated. The package manifest and lockfile were deliberately left unchanged; no hand-edited lock metadata, `npm audit fix --force`, or security-gate bypass was used.

### 3. Audit workflow diagnostic correction

The original workflow treated npm's normal exit code `1` for a valid audit report containing vulnerabilities as though the audit command itself had failed. The workflow now parses and validates the JSON report first, distinguishes registry/report errors from vulnerability findings, prints severity counts, and still exits nonzero whenever any vulnerability remains. It is not a waiver and does not make the 29 findings pass.

## Added regression gate

`scripts/check-run337-github-audit-recovery.mjs` verifies:

- `.env.example` exists and is included in the source tree;
- privileged credentials in the example remain blank;
- Pi Testnet and payout/A2U defaults remain fail-closed;
- `.gitignore` and `.vercelignore` exclude local environment files while retaining `.env.example`;
- the audit workflow accurately distinguishes registry errors from vulnerability findings and still fails closed;
- the complete audit artifact remains retained.

The RUN337 gate is registered in `verify:static`, `prebuild:checks`, `pretypecheck`, and `prelint`. The existing RUN332 source gate was updated to assert the new accurate audit behavior.

## Verification and limitations

- RUN337 audit/template recovery: 7/7 PASS.
- RUN332 audit remediation: 16/16 PASS.
- Full `npm run verify:static`: PASS after registering the RUN336 and RUN337 documents and the preserved JSON audit report with documentation hygiene. Dependency-lock integrity: PASS; documentation hygiene: PASS.
- Dependency audit remains **BLOCKED** by the 29 findings in the captured GitHub report. This candidate does not claim the security audit is clean.
- `npm run prebuild:checks` was attempted but cannot complete in this workspace because `node_modules` is intentionally absent and the `typescript` package is unavailable. Registry access is unavailable in the working container. Package manifest and lockfile remain unchanged, so no dependency-install, fresh audit, full Node 24.15 typecheck, ESLint or Next.js build is claimed.

## Safety and handoff

No GitHub push, Vercel deployment, Supabase migration, Testnet/Mainnet data mutation, Pi payment, payout, reward, membership or election operation occurred. Mainnet remains untouched. Preserve the official Pi SDK until a compatible remediation is proven. Do not approve Production while the audit has critical/high findings or the supported-runtime build remains unverified.

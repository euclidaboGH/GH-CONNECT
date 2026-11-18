# RUN366 — Source-of-truth audit and remediation register

Date: 2026-11-19
Source: user-supplied `GREENHAVEN-0_338_99-RUN365-FULL-AUDIT-PASS38-AND-RELATED-DOC-GATE-FIX-2026-11-19-1.zip`
Package version: 0.338.99

## Scope and integrity

- Archive contains 3,286 entries and passed `zipfile.testzip()`.
- SHA-256 of supplied archive: `334a2fb91693933b7b8a588cce922e60ef52353ae5b6209c0927738de2e84224`.
- Project root is `run359/`.
- Source tree contains 231 SQL migration files; the migration source manifest is present.
- `package.json` and `package-lock.json` both identify release 0.338.99.
- `.nvmrc` pins Node 24.15.0; the audit container has Node 22.16.0.
- No project build or production deploy was performed.

## Confirmed findings

### 1. Dependency security — release blocker

The checked-in audit snapshot `docs/security/RUN364-NPM-AUDIT-2026-11-18.json` reports 22 findings: 2 critical, 13 high, 6 moderate, 1 low. It is a historical report, not a fresh registry audit.

Installed lockfile versions include:
- `next` 15.5.26 (audit snapshot offers 15.5.29 as a non-major fix)
- `dompurify` 3.4.15 through `isomorphic-dompurify` 3.20.0
- `@playwright/test` 1.55.0 / `playwright` 1.55.0
- `@simplewebauthn/server` 13.2.2
- `sharp` 0.35.4
- `undici` 8.10.2 through jsdom
- `source-map-js` 1.2.1
- `zod` 3.25.67
- `pi-backend` 0.1.3, which depends on legacy `stellar-sdk` 10.4.1 and old Axios/TOML dependencies.

The dependency graph also reports vulnerable `postcss`, `brace-expansion`, `follow-redirects`, `minimatch`, and `@typescript-eslint/*` packages.

The lockfile is not rewritten in this environment: npm registry DNS access failed (`EAI_AGAIN`), and the runtime is below the project's required Node 24.15.0. Editing package versions without regenerating and verifying the lockfile would make deterministic installs unreliable.

The `zod` fix reported by npm crosses from v3 to v4, so it needs a deliberate compatibility migration rather than a blind override. The Pi payment/A2U integration pins `pi-backend@0.1.3`; its SDK replacement requires Testnet integration and payment-reconciliation regression testing. No dependency security gate was disabled.

### 2. Static verification exposed a documentation-hygiene regression

Running `npm run verify:static` in the available Node 22.16.0 environment progressed through the project's static checks and then failed at documentation hygiene because the prior run's `docs/security/RUN365-AUDIT-AND-FIX-2026-11-19.md` was not registered as an allowed current audit record.

This is a real repository consistency defect introduced by the prior audit artifact, not a product-runtime failure. The documentation classifier now explicitly registers both RUN365 and this RUN366 audit record.

### 3. Environment limitations

- The project requires Node 24.15.0; this environment provides Node 22.16.0.
- npm registry access failed with `EAI_AGAIN`, preventing a fresh `npm audit`, deterministic install, and lockfile regeneration.
- Dependencies are not installed in the extracted archive.
- Consequently, full prebuild (396 checks), TypeScript, ESLint, Next.js production build, browser E2E, and live Testnet integration remain unverified here.

## Safety and production constraints retained

- Production remains NOT APPROVED.
- No GitHub push or Vercel deployment.
- No Supabase migration was applied.
- Pi Mainnet was not accessed.
- Testnet-only financial safeguards, GHC ledger boundaries, and existing payout approvals were not weakened.
- No forced dependency overrides or security-gate bypasses were added.

## Required next remediation sequence

1. In a registry-connected Node 24.15.0 environment, update Next.js to at least 15.5.29 and update the compatible PostCSS/Sharp graph; verify the Next.js security release notes and application-specific image/cache/header behavior.
2. Update `isomorphic-dompurify` and its DOMPurify/jsdom graph to a maintained, Node-24-compatible release; run sanitizer regression tests and verify all rendering paths.
3. Update Playwright, SimpleWebAuthn, TypeScript ESLint packages, source-map-js, minimatch, brace-expansion, follow-redirects, and Undici to patched compatible versions.
4. Plan and test the Zod v3-to-v4 migration separately.
5. Replace or isolate the legacy Stellar dependency path only after confirming the Pi SDK/A2U transaction contract against Testnet; retain exact amount, recipient, txid, idempotency and reconciliation checks.
6. Regenerate `package-lock.json` with `npm ci`/`npm install` under Node 24.15.0, run a fresh `npm audit --json`, and require zero known vulnerabilities.
7. Run all 396 prebuild checks, typecheck, lint, production build, browser E2E, and Testnet payment/withdrawal reconciliation before considering release approval.

## Verification performed for RUN366

- ZIP integrity: PASS.
- Package/lock release identity: 0.338.99 / 0.338.99.
- Migration inventory: 231 SQL files; source manifest check PASS (231/231).
- `npm run verify:static`: PASS (exit 0) after registering the existing RUN365 audit note and this RUN366 report in the documentation hygiene allowlist.
- Focused documentation hygiene: PASS.
- Release hygiene: 17/17 PASS.
- Project truth: 11/11 PASS.
- Dependency lock integrity: PASS.
- Phase 8: 14/14 PASS; Phase 9: 15/15 PASS; Phase 10 platform acceptance: 24/24 PASS; Phase 10 release closure: 17/17 PASS.
- RUN301 release hardening: 20/20 PASS; RUN333 Testnet security reconciliation: 11/11 PASS.
- Full 396-check prebuild, typecheck, lint, production build and E2E remain unverified because the runtime is Node 22.16.0 (required: 24.15.0), dependencies are not installed, and registry access failed.

# RUN367 — CI evidence, dependency security and release audit

Date: 2026-11-19
Source of truth: user-supplied RUN365 archive, as corrected and represented by RUN366.
Package version: 0.338.99
GitHub repository: `euclidaboGH/GH-CONNECT`

## Executive result

The source archive RUN366 passes `npm run verify:static` in the available local environment (Node 22.16.0). The full prebuild orchestrator correctly refuses to run on that local runtime because the project requires Node `^24.15.0`. The final six checks in the 396-check manifest were executed individually; all six passed, including the last two Pi authentication diagnostics checks (RUN343 8/8 and RUN344 10/10).

The latest GitHub CI evidence available during this audit is commit `a450149675eaf80a9c5750a203379eb58138e106`, workflow run `44425654800` (CI) and `44425654801` (Dependency security audit), both started 2026-11-19 00:01:50 UTC.

- CI run `44425654800`: dependency lock integrity and npm install passed; static verification failed at documentation hygiene because `docs/security/RUN365-AUDIT-AND-FIX-2026-11-19.md` was not classified in that repository revision. Typecheck/lint/build job was skipped. RUN366 contains the missing RUN365 classification and passes `npm run verify:static` locally.
- Security run `44425654801`: Node 24.15.0 runtime assertion, lock integrity, `npm ci --legacy-peer-deps`, audit report generation and artifact upload all passed. The fail-closed security gate then correctly blocked the run on 22 vulnerabilities: 2 critical, 13 high, 6 moderate, 1 low.
- Full audit JSON from the actual GitHub Actions run is preserved at `docs/security/RUN367-NPM-AUDIT-44425654801.json`.

## Dependency findings from the actual GitHub run

The 22 findings are grouped across these affected package records:

- Critical: `dompurify` (installed 3.4.15) and `next` (installed 15.5.26; related `postcss` finding).
- High: `axios`, `brace-expansion`, `follow-redirects`, `pi-backend` via `stellar-sdk`, `playwright`, `postcss`, `sharp`, `source-map-js`, `stellar-sdk`, `toml`, and `undici`.
- Moderate: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, and `minimatch`.
- Low: `@simplewebauthn/server`.
- High: `zod` (Zod 3 line; audit reports a major-version fix in Zod 4).

The actual audit report is authoritative for affected ranges and `fixAvailable` values. Do not interpret the 22 package records as 22 independent root dependencies; several are transitive paths and overlapping advisories.

### Remediation direction

1. Upgrade Next.js within the existing 15.x line to patched `15.5.29` or a later verified 15.x security release, and update its aligned Next ESLint packages and lockfile together. Re-run the app-router, image optimization, server-action, cache and build checks.
2. Upgrade DOMPurify to `3.4.18` or later verified patched 3.4.x, through a compatible `isomorphic-dompurify`/DOMPurify graph. The current `isomorphic-dompurify@3.20.0` warning also indicates its declared Node engine support changed without a major-version bump; confirm the runtime range and choose the correct maintained major or compatible pinned version.
3. Apply non-major fixes where npm audit provides them: Playwright, SimpleWebAuthn, Sharp, source-map-js, Undici, brace-expansion, follow-redirects, minimatch and the TypeScript ESLint family. Regenerate the lockfile rather than hand-editing integrity metadata.
4. Treat Zod 3 → 4 as a separately tested migration. Audit schemas, coercions, error handling, inferred types, API contracts and shared validators before adopting it.
5. Treat the Pi SDK / Stellar chain as a financial integration exception requiring deliberate replacement or a reviewed compatibility patch. `pi-backend@0.1.3` depends on `stellar-sdk@10.4.1`; Stellar in turn pins Axios `0.25.0` and TOML `^2.3.0`. The app dynamically imports `pi-backend` in A2U execution, qualification, cashback and withdrawal routes. A blanket override can change SDK transport/parser behavior and must not be introduced without Pi Testnet create/complete/cancel, recipient, amount, transaction ID, idempotency and reconciliation tests.
6. Keep the security gate fail-closed. Do not suppress audit counts, use `npm audit fix --force` blindly, fabricate lockfile integrity, or bypass the gate.

## Verification evidence

- `npm run verify:static`: PASS, exit 0 on RUN366 source archive under Node 22.16.0.
- Prebuild manifest: 396 commands discovered by `node scripts/run-prebuild-checks.mjs --list`.
- Last six checks individually executed: all passed; checks 395 and 396 passed (RUN343 Pi auth timeout 8/8; RUN344 Pi auth diagnostics UX 10/10).
- Full prebuild orchestrator: NOT run locally; it rejects Node 22.16.0 because the project requires `^24.15.0`.
- Actual GitHub Node runtime: 24.15.0; `npm ci` passed.
- Actual GitHub `npm audit`: 22 findings; security gate correctly failed.
- Actual GitHub static verification: failed at documentation hygiene on commit `a450149`; the uploaded RUN366 source includes the classification repair and passes static verification locally.
- TypeScript, ESLint and Next.js production build: not executed in the latest CI run because the static verification job failed first; no successful build claim is made.

## Production and financial safeguards

- Production remains NOT APPROVED.
- No Supabase migration was applied.
- No Vercel deployment was performed.
- No GitHub commit or push was performed during this audit.
- Pi Mainnet was not accessed.
- Keep Pi Testnet fencing, server-side payment verification, durable idempotency and payout reconciliation intact.
- Keep Paystack live transfers disabled pending explicit approval.
- GHC balance must not grant curation power; votes must not mint or credit GHC; tips remain distinct from votes; GHPV remains server-only; existing economy RPCs remain authoritative.

## Exit criteria

A release candidate requires a fresh registry-backed lockfile update under Node 24.15.0, a new `npm audit --json` with zero known vulnerabilities (or a separately approved, documented exception process that does not hide findings), all 396 prebuild checks, typecheck, lint, Next.js build, browser E2E, database/RLS and security-definer checks, and Pi Testnet payment/reconciliation regression tests.

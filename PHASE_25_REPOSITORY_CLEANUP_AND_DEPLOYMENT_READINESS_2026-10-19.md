# Phase 25 — Repository integrity, cleanup, and deployment readiness (0.62.5)

## Changes applied

- Added `scripts/audit-project-integrity.mjs`, a read-only audit covering local import resolution, literal internal navigation targets, npm script targets, release-version alignment, Vercel commands, security-header ownership, `.gitignore` safeguards, and generated/secret artifacts.
- Added `npm run audit:project-integrity`; it runs at the beginning of `ci:verify` and as an early CI workflow step, before the dependency-lock gate.
- Pinned `.nvmrc` to Node 24.15.0, matching `package.json` engines and the CI runtime.
- Replaced the stale 0.59.4 `VERCEL_DEPLOY.txt` deployment stamp with a current GitHub Desktop/Vercel runbook and explicit release gates. It does not tell the operator to add/restore a domain-validation environment variable; it calls out the existing `/validation-key.txt` route behavior as a separate verification item.
- Removed duplicate global security-header declarations from `next.config.mjs`. `vercel.json` is the single owner for deployment-wide CSP/frame-ancestor, referrer, permissions, and content-type headers; Next config retains validation-key and immutable asset headers.
- Hardened `.gitignore` for `.vercel`, Next output, coverage, Playwright reports, TypeScript build state, logs, and OS-generated files while keeping only the redacted root `.env.example` template eligible for Git.
- Removed the generated `tsconfig.tsbuildinfo` artifact.
- Bumped version metadata to `0.62.5` and removed brittle hard-coded `0.62.4` assumptions from the Phase 23/24 source checks.
- Kept historical audit, migration, and release records; these are project traceability records, not runtime dead code.
- Fixed a deployment-runbook regression: Preview/Testnet and Production/Mainnet now explicitly document their distinct `NEXT_PUBLIC_PI_SANDBOX` values; the integrity audit enforces this guidance.

## Audit result in this workspace

- Repository integrity audit: 33 checks passed, 0 errors, 1 warning (the missing `pi-backend` lock graph).
- Release hygiene: 11/11; production safety scan: 21/21; deployment network safety: 10/10; provider feature-gate checks: 17/17; JSX safety: 687 files scanned; migration inventory consistency passed (105 SQL files: 77 required, 1 approval-required, 2 proposals, 25 review-required).
- Project-integrity audit regression tests: 13/13 passed after the health-version fallback and signing-key ignore additions.
- All 129 `scripts/test-*.mjs` regression scripts passed on the final rerun. The first complete rerun exposed one runbook-guidance regression; the Preview/Testnet and Production/Mainnet values were restored, the audit now enforces them, and the targeted deployment-network test passes 10/10.
- All 846 local JS/TS source files scanned by the import resolver; no unresolved relative or `@/` imports found.
- All direct npm-script references to repository scripts resolve.
- Literal internal navigation targets resolve to the current App Router pages.
- No local `.env` secrets or generated compiler/log/OS artifacts remain in the project tree; `.gitignore` also excludes common local signing-key containers.
- **Remaining warning:** `package-lock.json` is missing the resolved `node_modules/pi-backend` package graph. This is a genuine dependency metadata defect and continues to block clean installation and deployment. It must be repaired by npm in a registry-connected supported Node environment; do not hand-edit integrity hashes, delete the lockfile, or remove the SDK while A2U routes depend on it.

## Release status

The final install/build attempts in this workspace remain blocked: the lock refresh timed out while the npm registry was unavailable; `npm ci --offline` returned `ENOTCACHED` for `pi-backend`; `npm run typecheck` failed because dependencies and Node/React type declarations are absent; `npm run lint` could not find ESLint; and `npm run build` passed its JSX precheck but could not find Next.js. The lockfile was confirmed unchanged after the timed-out refresh.

This cleanup improves repository hygiene but does not make the release production-ready. A GitHub Desktop push to a review branch is possible after the operator creates/opens the local Git repository, but CI and Vercel installation are expected to fail until the dependency lock graph is repaired. Do not promote to Production before all required gates pass. The clean install, typecheck, lint, full CI, production build, real Pi Testnet, Supabase migration/concurrency, Paystack Test Mode, and rendered Pi Browser screenshots remain unverified until executed in a correctly configured environment. No database migration, GitHub push, or Vercel deployment was performed.

# Phase 6 — Testnet readiness report

**Decision: NOT CERTIFIED — controlled Testnet acceptance and dependency remediation remain required.**

## Verified in source

- GreenHaven source derivative is 0.338.104, based on the reopened 0.338.103 RUN376–RUN377 archive.
- API route inventory: 280 route files, 186 mutating routes, 186/186 domain-owner assignments, 176/186 durable mutation rate-limit controls, and explicit access classifications for the 45 routes without the ordinary session-auth marker.
- RUN378 route/access audit 9/9; RUN379 timeout/error/rate-limit gate 21/21; focused economy/curation 43/43 and anti-whale runtime 5/5.
- Core product source contracts and performance/security checks are recorded in the Phase 4 and Phase 5 reports.
- Testnet-only financial gates remain disabled by default. Daily claims/activity emission require the unapplied atomic global-demand proposal; curation redistribution requires the unapplied idempotency wrapper; automated GHPV settlement remains gated pending durable daily calibration-cap state; GHC-to-Pi withdrawal is disabled and manual.

## Blocking items

1. GitHub's previous Node 24.15.0 CI audit recorded 22 vulnerable dependency entries: 1 critical, 13 high, 6 moderate and 2 low. The audit job failed. No registry-connected lockfile remediation has been completed.
2. The prior typecheck/lint/build CI job stopped before TypeScript at the stale RUN288 pretypecheck assertion. The local order has been corrected, but a new CI run has not certified it.
3. The local workspace has Node 22.16.0 and no `node_modules`; full Node 24.15.0 dependency-backed `tsc`, ESLint and Next production build have not been run.
4. Pi Sandbox sign-in still has an external SDK rejection before an access token reaches GreenHaven. Testnet app registration, hosted URL and Pi Utilities Sandbox authorization need operator verification.
5. The Phase 4 Playwright suite needs two real Testnet accounts and an actual Preview/Pi Browser run. No live multi-user acceptance was performed.
6. The atomic emission and curation SQL proposals remain review-only and unapplied. Reconcile Testnet migration history, rehearse on disposable PostgreSQL/isolated Testnet and obtain operator approval before enabling any financial flag.
7. The Testnet ACL proposal for identity/session SELECT grants remains review-only; no database ACL mutation was made.

## Operator actions

- Run a clean Node 24.15.0 install in registry-connected CI; remediate the critical/high advisories with tested package/lockfile changes and preserve the fail-closed audit.
- Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run verify:static` on the same exact candidate commit.
- Validate Vercel Preview env values and Testnet Pi app registration; resolve Pi Sandbox authorization.
- Run `npm run test:e2e:phase4` with two isolated real Testnet sessions; complete the mobile/tablet/desktop, offline/reduced-data, media upload, wallet/rewards, membership, messaging and notification journeys.
- Reconcile the exact Testnet migration history; rehearse each proposal and ACL change before separate operator approval. Keep all financial feature flags off until the relevant evidence exists.

No deployment or live database mutation is authorized by this report.

## Live deployment observation — 2026-11-19 12:53 UTC

Vercel currently reports the latest `testnet` Preview deployment as `READY` (`dpl_Czqmaaoftb9pCqcsBptWUjmTAbrv`, commit `787ab56ef4f2b6ad4d054c4357c0fab43c684bc7`, region `dub1`). This is a platform build state only. It is not the 0.338.105 candidate assembled in the preceding pass or the 0.338.106 configuration-only derivative reviewed afterward, and no Testnet login, product journey, database operation or payment was verified against it. The 0.338.106 candidate has not been pushed or deployed. Testnet remains **NOT CERTIFIED**.

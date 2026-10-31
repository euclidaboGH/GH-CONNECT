# GreenHaven v0.157.1 — consolidated audit-truth hardening

Date: 2026-10-28
Source baseline: `GREENHAVEN-0.157.0-PHASE2-CANONICAL-IDENTITY-2026-10-28.zip`

## Audit findings and changes

- Audited the supplied archive integrity, package/lockfile metadata, migration inventory, phase documentation, source identity hydration, CI workflow and consolidated static suite.
- The baseline passed `node scripts/verify-phase14-static.mjs` with 43/43 checks. Individual Phase 1–12 source-contract checks also passed in the audit container.
- Found the consolidated Phase 1–12 report still presenting `0.151.1`/`0.152.0` as its current baseline even though the package was `0.157.0`. Updated the report to state the current baseline and clearly label old release notes as historical.
- Found the project-truth document's latest-work section linked to a v0.150.1 worklog and claimed an obsolete 27/27 result. Replaced it with the current baseline audit findings and accurately stated what remains unverified.
- Bumped patch version metadata to `0.157.1` and synchronized `package.json`, `package-lock.json`, `lib/app-release.ts`, `VERIFIED_MANIFEST.txt`, README and project-truth metadata.
- Strengthened the Phase 1–12 consolidation checker to assert the current version in the report and project-truth document, and that prior release notes are labelled historical. Updated current-version assertions in the cross-phase checks.

## Verification performed

- Source baseline ZIP integrity: passed (`ZipFile.testzip()` returned no corrupt entry).
- Baseline consolidated static suite: passed, 43/43.
- Baseline Phase 1–12 source checks: passed for Phases 1–12 and the consolidated hardening/UX checks.
- Post-change static suite: run after the v0.157.1 changes; results recorded in the delivery summary.

## Explicit limitations

- Audit environment Node.js: `22.16.0`; project runtime requirement: `24.15.0`. Dependencies are not installed in the audit environment. Therefore no supported-runtime `npm ci`, TypeScript, lint, production build, or browser E2E result is claimed.
- Migration inventory: 139 files (98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 38 REVIEW_REQUIRED). File order/classification does not prove remote application.
- No remote Supabase, Pi Platform, Vercel or production system was contacted or changed. No live migration, payment, restore, or financial acceptance is claimed.

## Next engineering gate

Continue with Phase 3 identity hydration/runtime verification from this v0.157.1 baseline, then test the identity-dependent surfaces and failure paths. Before deployment, reconcile migration history independently for Testnet and Mainnet and complete supported-runtime, browser, disposable PostgreSQL restore, security and Pi Testnet acceptance.

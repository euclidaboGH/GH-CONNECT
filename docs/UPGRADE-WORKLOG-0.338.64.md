# Run #301 — release-gate and CI hardening (0.338.64)

Date: 2026-11-13
Baseline: `GREENHAVEN-0.338.64-RUN300-RELEASE-GATE-CI-HARDENING.zip`

## Findings repaired

- Synchronized the Phase 1–12 acceptance fixture to package baseline 0.338.64.
- Synchronized the Phase 12 release-readiness fixture to 0.338.64 while retaining the explicit production NOT APPROVED boundary.
- Added the missing versioned worklog required by the Phase 1–12 request-boundary follow-up gate.
- Kept migration inventory, migration application, Pi payout execution and production deployment authority unchanged.

## Twenty safe release/CI upgrades

1. Current package baseline is explicitly recorded.
2. Phase 1–12 acceptance metadata is version-synchronized.
3. Phase 12 release metadata is version-synchronized.
4. Phase 24 release review checks the current readiness report.
5. The missing-worklog CI dependency is supplied.
6. Worklog states source-only verification scope.
7. Worklog records the required Node 24.15.0 runtime.
8. Static checks remain network independent.
9. Migration inventory remains generated from canonical SQL sources.
10. Migration manifest counts remain checked against disk.
11. Duplicate migration prefixes remain rejected.
12. Held migration classifications remain non-applying.
13. Testnet apply guidance remains explicitly non-authorizing.
14. Production status remains NOT APPROVED.
15. No automated Vercel production deployment is introduced.
16. No Supabase migration push is introduced.
17. No payout execution flag or consent rule is changed.
18. CI least-privilege workflow permissions remain required.
19. Static verification continues to include critical release gates.
20. Build-footprint diagnostics remain observational and do not delete source or dependencies.

## Verification and limits

The three reported release-gate defects were reproduced locally before repair. Re-run the full `npm run verify:static` and `npm run build` under the repository-required Node.js 24.15.0 environment. The available local runtime during this repair is Node.js 22.16.0, so a dependency-backed production build and the full Node 24 static suite are not claimed as passed here. No database, Pi provider, Vercel deployment, or production mutation was performed.

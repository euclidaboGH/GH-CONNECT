# Repository maintenance record — 0.330.48

**Baseline:** `GREENHAVEN-0.330.48-PHASE-1-WORKING-SNAPSHOT.zip`  
**Maintenance scope:** repository hygiene only; no feature rewrite, database migration, financial change, deployment, or provider operation.

## Safe cleanup completed

- Removed `.cache/tsconfig.tsbuildinfo`, a generated TypeScript incremental-build cache. The repository `.gitignore` already excludes `.cache/` and `*.tsbuildinfo`.
- Removed root-level `CI-214-REPAIR-NOTES.md`, a one-off CI incident note whose contents are superseded by the current source-of-truth and release documentation and which has no source references.
- Removed root-level `PHASE3-PATCH-APPLY-INSTRUCTIONS.txt`, a stale apply-instructions artifact for the 0.330.4 Phase 3 change. It has no source references; its historical implementation remains represented by the source tree and upgrade records.
- Corrected `scripts/check-doc-hygiene.mjs` to explicitly classify `docs/PHASE-1-FEED-EXECUTION-REGISTER.md` as a canonical active document. This was an existing hygiene-check failure, not a reason to delete the register.

## Deliberately retained

- Historical release notes and worklogs: older documents are still used as regression fixtures by the documentation hygiene contract and preserve implementation/audit history.
- Supabase migration files, proposals, manifests and checklists: these are operationally and financially sensitive. No migration was deleted, reordered, applied, or reclassified.
- Identical logo/image files: byte-identical image files may be intentional light/dark or compatibility aliases; no asset was removed without verifying every reference and rendering path.
- `docs/UPGRADE-WORKLOG-0.331.0.md`: retained because the repository's documentation hygiene contract explicitly requires it. It conflicts with the package's current `0.330.48` version context and needs a focused provenance/reconciliation review before either deletion or promotion.
- Existing legacy scripts and documents: no broad deletion was performed based only on age or filename.

## Verification performed

- ZIP integrity: passed before extraction.
- `node scripts/check-doc-hygiene.mjs`: passed after the classification fix.
- `node scripts/check-project-truth.mjs`: 10 checks passed.
- `node scripts/check-project-maintenance-150.mjs`: 22/22 checks passed; all 15 sections and 150 essentials were counted.
- Package and lockfile version, app release version, README, project-truth document, migration manifest/count, migration checklist/count, runtime pin and release-status consistency passed via the project-truth contract.

## Verification not performed

The environment provides Node `22.16.0`; the project requires Node `24.15.x`. Dependencies are not installed in this working environment. Therefore this maintenance pass does not claim a dependency-backed TypeScript check, ESLint run, Next.js production build, full prebuild suite, live Supabase/PostgreSQL validation, Pi/GHC Testnet acceptance, browser/Pi Browser/mobile testing, or production readiness.

## Next maintenance priorities

1. Reconcile the anomalous required `0.331.0` worklog with the actual `0.330.48` package/source baseline.
2. Run the full documented checks under Node `24.15.x` with a clean dependency install.
3. Continue the active Feed reliability register and 150-essential maintenance programme; close items only with evidence.
4. Review old documents in batches against script references and source references before archiving/removing them.

# Build fix — project truth & release sync (0.178.2)

## Failures
1. `check-marketplace-revenue-reconciliation`: hardcoded `0.157.27` for release sync
2. `check-project-truth`: README / PROJECT_TRUTH version lag
3. `canonical_migrations=144` vs **153** SQL files on disk
4. Migration checklist on-disk count lag

## Fixes
- Dynamic release version check in marketplace revenue reconciliation
- README + `docs/PROJECT_TRUTH.md` current source version → package version
- `VERIFIED_MANIFEST.txt` `project_version` + `canonical_migrations=153`
- `docs/MIGRATION_CHECKLIST.md` **On-disk count: 153**

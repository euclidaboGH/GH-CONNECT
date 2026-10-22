# Repository cleanup — 2026-10-22

## Changes

- Removed the transient root-level CI repair log; the current build state now lives in `PROJECT_TRUTH.md`.
- Moved dated phase/stabilization reports from the repository root into `docs/archive/historical-reports-2026-10-22/` and marked them as historical, non-authoritative records.
- Removed superseded standalone deployment/push notes and the older migration-manifest duplicate.
- Rewrote the root README and documentation index to point to current release truth and operator gates. Updated the legacy migration test to reference current status instead of requiring a dated manifest.
- Updated the deployment runbook to the current package version and latest supplied Vercel failure.
- Attempted to regenerate the migration checklist and manifest; the generator correctly blocked on duplicate version prefixes `202610210001` and `202610210002`. Existing generated inventories were not overwritten. This is now documented as an outstanding integrity issue.

## Safety boundary

No application feature source, migration SQL, package manifest, or lockfile was deleted or intentionally modified. One migration-inventory helper gained an explicit diagnostic-write mode, and a legacy source test was updated to stop depending on an obsolete dated manifest; neither change suppresses the normal duplicate-version failure. The generated migration inventory describes repository files only; it does not imply that any migration is applied remotely.

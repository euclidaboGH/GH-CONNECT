# GreenHaven 0.61.4

- Added best-effort cleanup of uploaded storage objects when durable media record creation fails, reducing orphaned files.
- Added regression assertions for the cleanup path.
- Aligned package, lockfile, and app release version.
- Regenerated and verified the migration inventory manifest.
- Preserved existing GHC economy boundaries; no issuance or ledger behavior changed.

Validation: 119/119 source test scripts passed; JSX safety and migration inventory checks passed. Build/typecheck/lint and live integration remain unverified.

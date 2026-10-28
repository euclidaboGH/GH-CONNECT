# GreenHaven v0.157.3 — Phase 4 recovery and identity integration hardening

Date: 2026-10-28
Baseline: `GREENHAVEN-0.157.2-PHASE3-PUBLIC-IDENTITY-HARDENING-2026-10-28.zip`

## Audit and implementation

- Audited the existing Phase 4 identity integration contract and recovery release gate rather than duplicating their existing functionality.
- Identified a file-path race window in restore-evidence validation: `lstat` was followed by a path-based read.
- Changed evidence validation to open the path with `O_NOFOLLOW` where supported, compare descriptor metadata (`dev`/`ino`) with preflight metadata, enforce the 256 KiB cap using `fstat`, parse from the already-open descriptor, and close the descriptor reliably.
- Kept the validator offline; it does not connect to PostgreSQL, Supabase, or production systems.
- Expanded Phase 4 regression contracts to assert descriptor-based reading, no-follow protection, bounded child processes, size enforcement, and registration of identity integration checks.
- Updated source version and release-truth metadata to `0.157.3`.

## Verification

- `node scripts/test-database-restore-evidence-validator.mjs` — 33/33 passed after the change.
- `node scripts/check-phase4-identity-integration.mjs` — to be run after this release update.
- `node scripts/check-phase4-recovery-release-gate.mjs` — source contracts run offline; operational gate remains blocked without real restore evidence.
- `node scripts/test-phase4-recovery-release-gate.mjs` — to be run after this release update.
- Supported Node.js 24.15.0 build/typecheck/lint and live PostgreSQL restore rehearsal are not claimed in this environment.

## Operational blockers retained

A source update cannot prove the backup can be restored, migration history matches a target Supabase project, RPO/RTO meet owner-approved objectives, or Pi/Testnet flows work. The strict gate must remain blocked until evidence from a real restore into an isolated disposable PostgreSQL environment is reviewed independently. No migration was added and no live system was modified.

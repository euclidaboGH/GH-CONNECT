# Upgrade worklog — 0.330.33

## Scope

Priority 8 Messages product transformation based on the authoritative 0.330.32 archive.

## Source changes

- Added a dedicated Archived inbox filter and count, with active and archived lanes kept mutually exclusive.
- Replaced device-only pin/archive/mute actions with authenticated server-backed per-member preference writes; added explicit unpin/restore/unmute operations and hydrated persisted pin/archive/mute state into the inbox across sessions/devices.
- Fixed draft lifecycle behavior so unsent conversation-scoped drafts survive closing a thread, navigating away from Messages, switching threads, and reconnect/reconciliation.
- Removed the prior-thread draft deletion when opening a different conversation.
- Made pin/archive/mute controls available on touch screens and keyboard focus; added contextual accessible names and touch-sized controls.
- Made message reply/more actions available on touch and keyboard; corrected message bubble semantics from an inert button role to a labelled group.
- Added an 8,000-character textarea maximum and an associated character counter/help description.
- Added a dedicated `npm run check:priority8-messaging` command and registered its gate in `prebuild` and `verify:static`.
- Reconciled stale governance type-regression test expectations with the already-narrowed `payload.report` implementation.
- Synchronized package, lockfile, app release, README, project-truth, migration inventory and release acceptance metadata to 0.330.33.

## Verification performed

- Priority 8 Messages transformation: 41/41 (including durable per-member preference writes and hydration).
- Legacy messaging massive-upgrade contract: 10/10.
- Phase 6 messaging inbox: 8/8.
- Message hydration/media contract: 5/5.
- Messaging bounded JSON: 28/28.
- Phase 21 private-surface durable controls: PASS (10 boundaries).
- Pass 48 accessible navigation: PASS.
- Phase 30 cross-surface reliability: 13/13.
- Repository consistency: 6/6.
- JSX safety: PASS (979 files scanned).
- Project truth: 10/10.
- Documentation hygiene: PASS.
- Migration inventory: 193 files; no migration added or applied.

## Full-suite limitations

This worklog records source-only verification; it does not claim a supported-runtime production build or live deployment acceptance.


`npm run prebuild` runs the static gates successfully until the explicit runtime check, then stops because this environment provides Node.js 22.16.0 while the repository requires Node.js 24.15.0 (package range ^24.15.0). No `node_modules` directory is present. `npm run verify:static` initially exposed stale release markers and an outdated governance type-regression assertion. Those source-of-truth/test-fixture mismatches were corrected; the final static verification run passed 57/57. Dependency-backed TypeScript, ESLint and Next.js production build are not certified. Browser, Android/Pi Browser, screen-reader and live Supabase/Testnet acceptance remain outstanding. No deployment, external API mutation, database migration, payment or financial operation was performed.

## Release status

Source increment only. **NOT APPROVED for production** until supported-runtime build and external acceptance gates pass.

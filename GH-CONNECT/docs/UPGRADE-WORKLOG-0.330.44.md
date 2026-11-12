# GreenHaven 0.330.44 — Phase 11.2.3 worklog

Date: 2026-11-08

- Baseline: `0.330.43` notification delivery architecture.
- Split account-level in-app preferences from browser/device-level alert preferences.
- Added authenticated cross-device account preference GET/PATCH API using the existing profile payload store; browser alert choices remain local to an account + browser device key.
- Updated Settings with separate In-app and This device switches and permission-state refresh on focus/visibility return.
- Preserved compatibility reads for existing preference records and kept unscoped legacy preferences confined to local Studio identity.
- No new migration, provider, subscription lifecycle or financial authority.
- Verification is source-only in this environment; Node 24.15.0 dependency-backed typecheck/lint/build is not certified.
- Focused Phase 11.2.3 source/runtime tests: 17/17 and 12/12; Phase 11.2.2 delivery: 15/15 and 14/14; previous notification action, priority, account-isolation, service-worker and RPC privilege suites passed.
- Cross-device account sync is conditional on the durable profile store. The existing profile payload read/merge/upsert is not an atomic dedicated preference store; concurrent profile writes can be last-write-wins. A dedicated table/RPC remains a possible later migration after schema reconciliation.
- Node 24.15.0 dependency-backed build, lint, typecheck, real multi-device/mobile/browser/screen-reader and live Testnet/Mainnet acceptance remain open. Production is NOT APPROVED.

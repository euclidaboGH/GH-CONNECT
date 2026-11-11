# 0.328.0 — Phase 10 Settings and platform performance

## Delivered
- Added a searchable Settings entry for Performance & data.
- Added client-only device diagnostics using browser-reported logical cores, approximate device memory when exposed, connection effective type and reduced-motion preference.
- Added a device-local reduced-data toggle. Browser/system Data Saver and constrained 2G connections take priority.
- Connected the preference to optional prefetch eligibility; no account or server data is mutated.
- Hardened shared async memoization with bounded LRU eviction, a 30-second default TTL, concurrent in-flight deduplication, and safe bypass for unserializable cache keys.
- Fenced cache expiry timers so an older timeout cannot delete a newer in-flight request under the same key.
- Added a 10-point source contract and registered it in the prebuild chain.
- Synchronized package, lockfile, app release metadata and current project documentation to 0.328.0.

## Safety and limitations
- No SQL migrations were added or applied.
- No Pi Testnet/Mainnet transaction, GHC debit/credit, refund, entitlement grant, or treasury operation was performed.
- Device capability values are browser-reported hints, not a benchmark or guaranteed hardware inventory.
- Reduced-data preference is device-local and can be unavailable in restricted/private browser storage.
- Phase 9 Membership remains active pending Node 24.15.x dependency-backed checks, disposable PostgreSQL and Pi Testnet acceptance, browser/device testing and operator approval.

## Verification
- Phase 10 Settings/performance source gate: 14/14.
- Existing mobile/accessibility quality gate: 10/10.
- Settings discovery gate: 10/10.
- Repository consistency: 6/6.
- Project truth metadata is synchronized.
- Node 24.15.x typecheck, ESLint and Next.js production build were not run because the available runtime is Node 22.16.0 and dependencies are not installed in this workspace.

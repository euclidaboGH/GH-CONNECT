# GreenHaven upgrade worklog — 0.309.0

## Phase 23 — Migration integrity and marketplace lock-scope hardening

- Audited the 176-migration 0.308.0 baseline, including clean filename/version checks, manifest synchronization, database contract source, release hygiene, project-truth checks, Phase 22 marketplace gate and the complete `verify:static` pipeline.
- Identified that `gh_marketplace_order_get` performed a global expired-reservation cleanup even when called from row-locked transition/commerce RPCs.
- Added migration `20261104170001_marketplace_order_read_cleanup_separation.sql` to make the canonical order snapshot read side-effect free.
- Updated the application `loadOrder` path to execute the cleanup RPC separately and fail closed if it is unavailable or does not confirm success.
- Added a migration-wide static integrity gate for canonical 14-digit names, duplicate versions, empty migrations and fixed `search_path` declarations on `SECURITY DEFINER` functions.
- Updated the migration source inventory and release documentation. The new migration is `REVIEW_REQUIRED`.
- No live database, Pi provider, Vercel deployment, or Testnet/Mainnet migration history was accessed or modified.

Verification in this environment is source-only: Node.js 22.16.0 is installed, while the repository requires Node.js 24.15.0. Dependencies are not installed, so this worklog does not claim a supported-runtime typecheck, lint or production build.

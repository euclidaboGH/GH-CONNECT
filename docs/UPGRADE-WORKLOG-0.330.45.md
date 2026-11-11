# GreenHaven 0.330.45 — Phase 11.2.4 Worklog

- Started from the complete 0.330.44 source tree.
- Added provider-neutral Web Push/VAPID protocol decision and explicit disabled capability truth.
- Added bounded subscription contract validation and endpoint hashing.
- Added authenticated/rate-limited subscription list/register/revoke API routes.
- Added client helper guarded by server `remoteDeliveryEnabled`; revokes server-side before browser unsubscribe.
- Added a separately located SQL proposal for subscription storage, per-device outbox, attempt records, idempotency, lease-based claims, bounded retry scheduling and expired endpoint cleanup. Proposal is not applied and is not a migration.
- Kept the service-worker push receiver distinct from local browser alerts and the in-app inbox.
- Added static architecture contracts and runtime validation tests.
- No provider sender, VAPID key, worker schedule, database migration or production enablement is claimed.

Verification is source-only in this environment. Node.js 24.15.0 is required for the supported dependency-backed typecheck, lint and production build; the available runtime is Node 22.16.0 and dependencies are not installed. No live database or real browser/provider acceptance is claimed.

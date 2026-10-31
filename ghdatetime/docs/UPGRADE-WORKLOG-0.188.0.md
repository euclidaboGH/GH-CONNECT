# Upgrade worklog — v0.188.0

## Phase 5 — shared Pi A2U coordination and cashback source gates

- Audited A2U serialization domains and identified that general earnings used `gh_pi_a2u_execution_lane` while seller/cashback used `gh_pi_a2u_sequence_lease`. Separate locks do not serialize the Pi app wallet sequence across payout types.
- Added `20261030010007_pi_a2u_shared_sequence_lane.sql`: general earnings begin/heartbeat/provider-binding/end now acquire and fence the existing shared lane, with `earnings:<request UUID>` owner namespacing and shared-lane-first lock order.
- Restricted currently enabled cashback attribution sources to `marketplace_fee`, the only audited producer with canonical payer and verified PI company-fee evidence. Membership, promotion, digital service, creator tip, refund and chargeback sources are explicitly pending rather than advertised as eligible.
- Added Phase 5 source contract checks and registered them in `prebuild` and `verify:static`.
- Updated README, project truth, Phase 1–12 acceptance, Phase 12 release report and generated migration inventory.

## Checks

- Phase 5 shared A2U lane: 12/12.
- Cashback attribution policy: 12/12.
- Phase 4 earnings execution worker: 21/21.
- Phase 4 receipt fencing: 13/13.
- Registration bonus: 18/18.
- Unified wallet: 13/13.
- Full `npm run verify:static` was attempted and exposed stale release-baseline/worklog metadata. Those metadata files were corrected; the consolidated suite must be rerun and its final result recorded before release.

## Not performed / release blockers

- No disposable PostgreSQL instance was available; shared-lane concurrency and migration execution are not claimed as passed.
- No Node.js 24.15.0 runtime or `node_modules` was available for TypeScript, lint or production build.
- No authenticated Pi Testnet provider execution was performed.
- Migration `20261030010007_pi_a2u_shared_sequence_lane.sql` is REVIEW_REQUIRED and unapplied. Mainnet remains disabled.

This is source-level verification only. Node.js 24.15.0 and a dependency installation are required for the supported-runtime typecheck, lint and production build.

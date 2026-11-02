> Engineering note — 2026-11-02

# Phase 10 — CI run #177 source-verification failure repair

## Evidence

The supplied GitHub Actions excerpt showed `npm run verify:production` exiting non-zero but stopped before the first failure. Re-running the source verification pack against this archive reproduced five failing check scripts (six assertions):

- `check-phase1-registration-topup.mjs`: stale assertion searched for the Rewards label in the wallet screen rather than verifying the claim card is mounted in Rewards.
- `check-phase2-economy-database-boundaries.mjs`: stale expression expected a narrower numeric validation expression and missed the additional null-field rejection.
- `check-phase3-pi-claim-buttons.mjs`: same stale Rewards-placement assertion.
- `check-phase5-wallet-release-gate.mjs`: two nested failures caused by the Phase 1 and Phase 3 assertions above.
- `verify-massive-messaging-upgrade.mjs`: draft-clear assertion did not match the implementation; reviewing the send path also found the draft was cleared before the send was confirmed.

## Changes

1. Updated the Phase 1 and Phase 3 source contracts to verify the registration claim card is absent from wallet balance management and is mounted in the Rewards centre.
2. Updated the economy DB contract to match the actual stricter validation: required numeric fields must be present, finite, and non-negative; the wallet identity and timestamp must also validate.
3. Fixed messaging draft durability: the composer no longer clears the draft before attempting send. It clears the in-memory and persisted draft only after the send/queue operation confirms acceptance. Rejected or ambiguous sends retain the draft for retry.
4. Updated the messaging source contract to assert that draft removal occurs after the failure/rejection branch.

No financial RPC, payment settlement, authorization, RLS policy, or database migration was changed.

## Verification

- The five previously failing check scripts now pass.
- `node scripts/verify-production-release.mjs`: exit code 0; 242 checks passed, 0 failed.
- `npm run verify:static`: exit code 0.
- ZIP integrity check passed.

## Remaining gate

The local environment is Node 22.16.0, while the repository requires Node `^24.15.0`. The source verification pack itself warns that build/operator verification remains required. This repair does not establish that typecheck, lint, production build, browser journeys, or a deployed environment passed. Re-run CI on Node 24.15.0 and inspect subsequent job steps before treating the release as ready.

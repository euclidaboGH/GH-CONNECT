# GH-CONNECT v0.61.9 — Phase 19 financial/media release hardening

## Changes made in source

- Hardened the shared GHC transfer primitive to lock sender and recipient balances in canonical order, preventing opposite-direction lock-order deadlocks and serializing recipient daily receive-limit checks. It rejects amounts with more than four decimals, enforces UTC day boundaries independently of database session timezone, and validates idempotency references against both ledger legs and the original parties/amount.
- Added a GHC tip settlement RPC that locks the durable tip intent and calls the hardened `ghc_execute_transfer` ledger RPC, then records both transaction IDs and settles the intent in the same SQL function transaction. It validates exact amount, GHC precision, tipper identity, creator identity, transfer pair, and idempotent retries. Any post-transfer ledger verification mismatch raises an exception so the transfer transaction rolls back.
- Added a default-off `GHC_TIPS_ENABLED` application gate. Even though the path is implemented in source, do not enable it until migration review, disposable PostgreSQL tests and Testnet concurrency verification pass.
- Added a funded creator reward pool. Pool funding requires an explicit database operator allowlist and transfers existing GHC from that operator's ledger account. Distribution only accepts approved GHC reward events and transfers from the actual pool ledger balance to the creator. It does not mint or create ledger rows directly. Settlement and funding have durable idempotency/movement records.
- Added privileged server endpoints for reward-pool funding and reward settlement, protected by a separate constant-time-checked operator secret, rate limits, input validation, and service-role-only RPCs. Database operator allowlisting is still mandatory.
- Changed the PI payout reconciliation secret check to constant-time comparison. GHC payout and bank payout external rails remain unsupported by the PI adapter and must not be marked paid by a free-form reference.
- Removed a legacy media-resolution bypass: media ID resolution is now owner-only and returns stable application facade paths instead of raw public Storage URLs.
- Added a read-only SQL preflight for actual Supabase migration history, bucket visibility, direct public-storage URL references across public tables, and media registry/storage-object mismatches. It does not change bucket settings or application data.
- Added a static private-media consumer audit and a two-session Testnet concurrency test plan.

## Important sequencing dependency

`202610250005_ghc_tip_and_creator_reward_atomic_settlement.sql` depends on:

1. `202609300001_gh_creator_studio.sql` (`gh_tip_intents`)
2. `202610250003_gh_lifecycle_payout_quality_foundation.sql` (`gh_creator_reward_events`)
3. `202610250004_gh_verified_tip_settlement_payout_reconciliation.sql` (PI tip settlement/payout functions and prior financial schema)
4. Existing ledger migration(s) that define `ghc_execute_transfer` and its required tables/functions.

The filename order is not proof those migrations have been applied. Inspect the target's actual history and final function definitions before applying anything. If the target has a different schema, stop and reconcile rather than modifying old migrations in place.

## What remains external and unverified

- This workspace cannot inspect the live Supabase migration history or Storage bucket/data without the user's database access/credentials. Run `supabase/phase19_readonly_preflight.sql` on Testnet and retain the output.
- The private bucket must remain unchanged until the SQL preflight reports zero unresolved direct public Storage references, zero unexplained unregistered objects, zero missing ready assets, and all viewer-audience tests pass. The source audit alone is not sufficient.
- The reward pool operator table starts empty. Register only a dedicated Testnet operator through a trusted postgres-level session; never expose an endpoint to insert operators.
- The reward funding/settlement endpoints should remain inaccessible to ordinary users and should only be deployed with a strong `GHC_CREATOR_REWARD_OPERATOR_KEY`. Rotate it if it is exposed.
- Run `supabase/tests/PHASE19_CONCURRENCY_TEST_PLAN.md` on disposable PostgreSQL and Testnet. Static tests do not prove concurrent database behavior.
- The PI payout reconciliation endpoint now requires the provider-returned A2U direction, configured Testnet/Mainnet network, recipient UID, exact amount, request metadata, completed status and verified transaction. The unsafe A2U create route now refuses to create provider-side payment IDs until durable persistence and official SDK chain submission exist. The completion route validates the provider-returned direction, network, recipient, amount, and transaction ID, but does not mark seller payouts paid. A complete A2U initiation/sign/submit/complete workflow is not yet implemented in this repository, so payout initiation must remain unavailable; the reconciler only verifies a payment ID. Pi documents A2U as Testnet-only and the official Node backend package requires the app wallet private seed. Add and lock the official backend SDK in a connected build environment, store secrets only in server-side deployment settings, and run real Testnet end-to-end evidence before enabling. GHC external payout and bank payout integrations remain pending until a real rail/provider, account mapping, webhook or status polling, idempotency, reversal handling, and reconciliation procedure are selected and verified.
- Full npm dependency installation failed in offline mode because the required `zod@3.25.67` tarball was not cached. TypeScript, ESLint, Next production build, and full `ci:verify` therefore remain unverified in this environment. The installed Node version is 22.16.0, below the repository's declared minimum `22.22.2`; run CI with Node 22.22.2+ or 24.15.0+.

## Operator sequence before GitHub/Supabase changes

1. Review all changed files and the full migration inventory.
2. On the target Testnet SQL editor, run `supabase/phase19_readonly_preflight.sql` and save results.
3. Compare the full repository migration inventory against the actual `supabase_migrations.schema_migrations` output and current schema; resolve all missing, duplicate, drifted, or already-applied versions before migration execution.
4. Apply candidate migrations on a disposable PostgreSQL database first, then Testnet in reviewed order. Do not bulk-apply all files.
5. Run static phase tests, full dependency installation, typecheck, lint, production build, and the two-session concurrency plan.
6. Leave `GHC_TIPS_ENABLED=false` until verified. Leave external GHC/bank payout rails pending. Do not switch the `gh-media` bucket private until cutover gates pass.

## Pi A2U SDK reference

The official Pi docs describe A2U as a backend flow currently available on Testnet and identify the official Node.js package as `pi-backend`. The package needs the app wallet private seed to create, submit and complete A2U payments. References for the operator implementing that final external-provider step: https://github.com/pi-apps/pi-platform-docs/blob/master/payments_advanced.md and https://github.com/pi-apps/pi-nodejs. Do not paste `PI_WALLET_PRIVATE_SEED` into chat or commit it; configure it only in the server-side secret store.

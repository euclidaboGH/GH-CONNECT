# GreenHaven combined upgrade — Phase 4 integration and release gates

## Scope

This file records what can be checked from the repository alone and what requires the live Testnet deployment. It is not a Mainnet approval.

## Repository repairs included in this candidate

- Referral ID lookup probes legacy profile ID columns independently and returns only the canonical `user_id`; it never treats a profile row ID as the user ID.
- Referral attribution UI notification no longer routes to Rewards by default.
- The static verification runner now calls existing, in-tree checks instead of nonexistent test filenames.
- Release hygiene validates the declared Node 24 runtime instead of requiring two mutually exclusive engine ranges.
- Missing CI workflow and architecture/release documents were restored from the adjacent source snapshot so the existing safety/release checks can run.
- A focused fee/referral source-contract check is included.

## Local verification performed

- `node scripts/verify-phase14-static.mjs`: 7/7 passed under the available Node runtime (static checks only).
- `node scripts/check-release-hygiene.mjs`: 11/11 passed.
- `node scripts/check-dependency-lock-integrity.mjs`: passed.
- `node scripts/scan-production-safety.mjs`: 21/21 passed.
- `node scripts/check-database-contract-source.mjs`: passed; 114 executable tables across 131 clean migrations were reported by the source checker.
- ZIP integrity check: performed after packaging.

## Not verified in this environment

- `npm ci`, `npm run typecheck`, ESLint, and `next build`: not run because the available runtime is Node 22.16.0 while the project requires Node 24.15.0 or newer in the Node 24 line, and dependencies are not installed in this working tree.
- Live Supabase migration state/RPC behavior, service-role environment configuration, RLS and Storage policies.
- Pi Browser SDK approval/completion against the registered Testnet app, and completed payment-intent reconciliation.
- Cross-account, cross-device and concurrent duplicate-payment tests.

## Required acceptance sequence before commit

1. Use Node 24.22.1 and run `npm ci --legacy-peer-deps --no-audit`.
2. Run `npm run check:dependency-lock-integrity`, `npm run check:jsx`, `npm run test:safety`, `npm run typecheck`, `npm run lint`, and `npm run build`.
3. Reconcile migration filenames with the actual Supabase Testnet migration history; do not blindly apply every file in the directory.
4. In Pi Browser Testnet, test GHC listing fee success/insufficient balance/retry, Pi listing fee success/cancel/failure/retry, community create on both rails, and verify failed or incomplete payments never activate listings/communities.
5. Test referral using a valid GreenHaven ID, unknown ID, self-referral, already-attributed account, and the invite link from a fresh second account.
6. Only commit after CI and live acceptance evidence are clean. Keep Mainnet disabled until operator approval.

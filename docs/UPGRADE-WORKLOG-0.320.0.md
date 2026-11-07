# Upgrade worklog — 0.320.0

## Product Phase 7 — Wallet reliability increment

- Continued from the newest 0.319.0 creator/business identity source baseline; did not revert those profile improvements.
- Hardened the Pi withdrawable snapshot read in `features/wallet/wallet-screen.tsx` with an `AbortController`, an eight-second timeout, cleanup on close/unmount, stale snapshot clearing before each open, explicit `res.ok` and `body.ok === true` requirements, finite/non-negative amount validation, and trimmed/type-checked linked Pi identity.
- Kept the endpoint read-only (`/api/economy/earnings/withdrawable`). The server quote and withdrawal endpoints remain authoritative. No client financial execution path was added or changed.
- Added a dedicated Phase 7 Wallet regression contract (14 assertions) and registered it once in both `prebuild` and `verify:static`.
- Added the approved ten-phase product roadmap and explicit Wallet completion order; clarified that source delivery and production acceptance are separate states.
- Updated package, lockfile, app release metadata and current source truth to 0.320.0.

## Financial and migration boundary

- No SQL migration was added, modified or applied.
- No Pi consent, wallet identity authorization, quote, withdrawal reservation/execution, payout, GHC ledger, provider, settlement, Mainnet or Testnet execution authority was changed.
- Pi and GHC remain separate assets and ledgers.

## Verification status

- Dedicated Phase 7 Wallet regression contract: passed: 14/14.
- Consolidated static verification: passed: 14/14.
- Node 24.15.0 typecheck, ESLint, full prebuild and Next.js production build require the repository-pinned runtime and installed dependencies; do not infer their success from source checks.
- Browser/device, live Supabase, Pi Testnet reconciliation, Vercel deployment and Mainnet operator acceptance are not performed by this source-only increment.
- Production remains **NOT APPROVED** until all required gates and independent financial reconciliation are complete.

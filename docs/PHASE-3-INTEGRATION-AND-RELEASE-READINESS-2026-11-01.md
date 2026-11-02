# Phase 3 — Integration Integrity and Release Readiness

**Baseline:** GH-CONNECT `0.274.3` after Phase 2  
**Date:** 2026-11-01  
**Scope:** authoritative wallet snapshot validation, truthful reconciliation metadata, transfer dual-entry identity, and release verification.

## Confirmed defect 1 — wallet reconciliation claimed success without evidence

`lib/domains/adapters/wallet-read-seam.ts` reported `availablePlusLockedEqualsLedger`, non-negative balances, and pending/ledger validity as `true` for every state, including unavailable and error states. In ready states, it also synthesized a missing ledger balance from `available + locked` and treated missing pending data as zero. Those defaults could make a partial or inconsistent session snapshot look reconciled.

### Fix

- Reconciliation flags now derive from observed values.
- An unknown locked amount or missing ledger value cannot pass the equality check.
- Missing pending values remain unknown instead of being silently converted to zero.
- Unavailable/error snapshots do not claim reconciliation success.
- This read seam remains presentation-only; no wallet mutation capability was introduced.

## Confirmed defect 2 — authoritative wallet snapshot accepted incomplete or mismatched data

`rpcWalletSnapshot()` accepted a missing `userId`, tolerated a missing `ledgerBalance` by substituting the spendable balance, and generated a current timestamp when the server timestamp was invalid. These fallbacks could conceal a stale RPC deployment or incomplete response while presenting it as a complete authoritative snapshot.

### Fix

- Require the returned `userId` to exactly match the requested account.
- Require all seven numeric snapshot fields, including `ledgerBalance`, to exist and be finite/non-negative.
- Require a valid positive server-provided `updatedAt`; do not fabricate freshness.
- Invalid snapshots fail closed as `null`.

This matches the latest source migration contract `20261022010065_ghc_wallet_snapshot_spendable.sql`, which returns `userId`, `balance`, `ledgerBalance`, `locked`, `pending`, lifetime totals, and `updatedAt`. No migration was applied or modified.

## Confirmed defect 3 — transfer response could reuse one transaction ID for both legs

Phase 2 bound each leg to the requested sender, recipient, amount, kind, status, and reference, but did not require distinct transaction IDs. A malformed RPC response could therefore represent the same transaction row as both debit and credit.

### Fix

- Reject a transfer response when debit and credit transaction IDs are equal.
- Extended the transfer RPC integrity regression checks from 10 to 11.

## Regression protection added

- `scripts/check-phase3-wallet-reconciliation-truthfulness.mjs` — 8 checks.
- `scripts/check-phase3-authoritative-wallet-snapshot.mjs` — 6 checks.
- Extended `scripts/check-phase2-transfer-rpc-result-integrity.mjs` — 11 checks.
- Registered the two Phase 3 checks in `package.json` and `npm run verify:static`.

## Verification performed

- `npm run verify:static` — **passed**.
- Transfer RPC response integrity — **11/11**.
- Wallet reconciliation truthfulness — **8/8**.
- Authoritative wallet snapshot validation — **6/6**.
- Dependency lock integrity — **passed**.
- Canonical migration cleanliness — **175 unique migrations passed**.
- Migration source manifest — **175/175 synchronized**.
- Release hygiene — **11/11 passed**.
- `package.json` parses successfully and project version remains `0.274.3`.

## Verification limitations

A locked install was attempted but could not complete in this environment. The runtime is Node `22.16.0`, while `.nvmrc` and `package.json` require Node `24.15.0`; engine warnings also confirm installed package constraints exceed the available runtime. An offline retry failed because the npm cache does not contain the required `zod@3.25.67` tarball. No usable local TypeScript, ESLint, or Next.js executables were present after the failed install. Therefore TypeScript, ESLint, and production build are **not verified** in this environment.

No live Supabase, production, or Pi Testnet requests were made. This phase did not add/apply migrations, change balance math, enable payout/payment flows, alter reward issuance, or modify package dependencies.

## Release status

**Source-level checks pass; production release remains blocked** until a clean `npm ci --legacy-peer-deps`, typecheck, lint, production build, and disposable-database/Testnet verification are run under Node `24.15.0` or the project's approved Node 24 runtime. In particular, verify the deployed `ghc_wallet_snapshot(text)` contract includes `ledgerBalance` and valid `updatedAt` before release.

# Phase 8 — Wallet and financial UX reliability (current hardening: v0.157.7; original implementation notes retained)

## Scope
Harden wallet read correctness, stale-data behavior, and transaction-history asset separation without changing financial mutation contracts or touching production data.

## Implemented
- Hardened `normalizeWalletV2Snapshot` to reject non-object snapshots, non-GHC currency, non-finite/negative balances, missing or oversized user IDs, fractional pending counts, implausible future timestamps, unsupported escrow rails, invalid categories/holds, and malformed reconciliation flags before data reaches wallet presentation state.
- Sequenced wallet snapshot refreshes. An older request cannot overwrite a newer request after overlapping refreshes.
- On transient server-read failure, preserve the last server-confirmed values and explicitly mark them stale; do not overwrite them with a potentially older local/session snapshot.
- Added an accessible wallet authority warning for error/unavailable snapshots, with server authority for all financial writes unchanged. Wallet summary responses now apply explicit no-store/no-cache headers consistently, including authentication and configuration errors.
- Filtered Pi history and its read-only feature reconciliation at the server boundary to `provider === "pi"` and `currency === "PI"`; the Pi UI also rejects malformed history payloads instead of interpreting a missing list as a valid empty history.
- Expanded the Phase 8 source regression checker to cover these contracts.

## Invariants preserved
- The client cannot mint, transfer, spend, claim, refund, or complete payments through this read-only work.
- GHC ledger activity and Pi payment intents remain separate rails and currencies.
- History and reconciliation remain authenticated, user-scoped, no-store reads.
- Reconciliation is diagnostic only; it does not mutate payment, order, membership, or ledger state.
- No migration, live database write, provider call, or production setting was changed.

## Verification
- `node scripts/check-phase8-wallet-history-foundation.mjs` — 20 source-contract checks, including the new validation and cache-header safeguards.
- `node scripts/check-phase9-wallet-transaction-integration.mjs` — adjacent transaction contracts.
- `node scripts/verify-phase14-static.mjs` — consolidated static suite.
- `node scripts/check-project-truth.mjs` and `node scripts/check-release-hygiene.mjs` — release metadata and hygiene.

## Remaining acceptance
Browser/device validation, real Supabase schema/RLS verification, authenticated multi-user checks, refresh-race integration tests, Testnet payment lifecycle verification, and TypeScript/lint/production build on supported Node.js 24 remain outstanding. Static source checks do not prove live financial correctness.

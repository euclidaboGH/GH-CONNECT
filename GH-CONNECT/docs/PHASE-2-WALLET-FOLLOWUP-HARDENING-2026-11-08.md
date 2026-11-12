# Phase 2 Wallet & Payments — Follow-up hardening

**Baseline:** GreenHaven `0.330.48`  
**Date:** 2026-11-08  
**Status:** Implemented, awaiting verification

## Scope

This is a second engineering pass over the existing Phase 2 wallet and payments implementation. It does not replace the existing ledger, payment-intent, Pi authorization, escrow, withdrawal, or reconciliation architecture.

## 23 gaps closed

1. Wallet history reads now use durable per-user rate limiting and fail closed if the limiter is unavailable.
2. Wallet summary reads now use durable per-user rate limiting.
3. Wallet summary RPC exceptions are converted to a safe unavailable response instead of escaping as an unhandled route error.
4. Wallet summary rejects non-object/array RPC payloads.
5. GHC withdrawal quote/history reads now use durable rate limiting.
6. GHC withdrawal creation now uses a stricter durable per-user rate limit.
7. Pi wallet authorization status reads use durable rate limiting.
8. Pi wallet authorization grants use durable rate limiting.
9. Pi wallet authorization revocations use durable rate limiting.
10. Pi payment completion uses durable per-user rate limiting before parsing or provider work.
11. All Pi payment-completion responses now carry private no-store headers.
12. Economy policy reads have an eight-second abort deadline.
13. Economy policy data is validated before being admitted into wallet UI state.
14. Automatic matured-reward claim requests are time bounded.
15. Automatic authoritative wallet refresh is single-flight to avoid overlapping claim/snapshot work.
16. Pi intent history and its reconciliation follow-up share an abortable 12-second request budget.
17. Reconciliation count fields must be non-negative safe integers.
18. Old reconciliation findings are cleared before a new load, preventing stale findings from being shown as current.
19. Reward claim requests are time bounded; a detached timer can no longer unlock the claim action while the request is still running.
20. Ambiguous claim transport failures now tell the user to refresh and confirm the outcome rather than falsely asserting that no reward change occurred.
21. Wallet CSV exports now quote fields correctly and neutralize formula-like untrusted text while preserving numeric negative amounts.
22. CSV object URLs are revoked after a short delay so mobile browsers can consume the download.
23. Transfer request history rows with invalid statuses, amounts, timestamps, or missing identity/reference fields are rejected rather than silently coerced into pending rows/current timestamps.

Additional efficiency improvement: the read-only wallet provider now skips periodic refreshes while the browser tab is hidden or offline and refreshes when visibility/network connectivity returns.

## Automated evidence

- Follow-up wallet hardening source gate: **23/23**.
- Wallet CSV safety runtime test: **9/9**.
- Shared GHC spend RPC contract gate: **10/10**.
- Wallet security hardening: **11/11**.
- Pi wallet authorization: **27/27**.
- Wallet transfer integrity: **8/8**.
- Payment request body bounds: **20/20**.
- Economy RPC timeout controls: **11/11**.
- Wallet product transformation: **14/14**.
- Wallet completion: **12/12**.
- Wallet ledger resilience: **17/17**.
- Cross-feature wallet reconciliation: **32/32**.
- Wallet premium home: **9/9**.
- Wallet asset/history: **11/11**.
- Wallet withdrawal journey: **11/11**.
- Wallet release gate: **19/19**.
- TypeScript transpilation syntax checks: **8/8 changed TypeScript/TSX files**.

The new source gate and CSV runtime test are registered in `prebuild` and `verify:static`.

## Boundaries and remaining verification

- No Supabase migration was added, edited, applied, reordered, or removed.
- No financial ledger rows, balances, payment intents, escrow records, or withdrawal requests were rewritten.
- No real Pi payment, refund, withdrawal, A2U payout, or Testnet transaction was initiated.
- No production deployment was performed.
- The workspace has Node `22.16.0`; the project pins Node `24.15.0`. Dependencies are not installed.
- A full Node 24 dependency install, TypeScript project typecheck, production build, browser/mobile flow, authenticated Supabase integration, concurrent/idempotency testing against the target database, and Pi Testnet acceptance remain outstanding.

Phase 2 remains **Implemented, awaiting verification**. Static checks and syntax transpilation do not prove live settlement or database atomicity.

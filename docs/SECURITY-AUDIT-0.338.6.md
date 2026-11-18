# Security audit — GreenHaven 0.338.6 (2026-11-09)

Scope: static review of API routes, auth, operator endpoints, migrations, deployment headers and dependencies.
No critical or exploitable authentication bypass was found. The items below are hardening fixes.
Source-level only: nothing here proves deployment, and typecheck/lint/build must still run on Node 24.15.x.

## Fixes
1. Shared operator-key verifier: `lib/server/security/operator-key.ts` (constant-time, minimum length).
2. Seven payout routes under `marketplace/payouts/[requestId]/` accepted keys of any length; now >= 32 bytes.
3. `payments/a2u/create` and `/complete` accepted keys of any length; now >= 16 bytes (shared executor key floor).
4. `a2u/create`, `a2u/complete`, `creator-rewards/fund` use the durable fail-closed rate limiter.
5. `app/share` no longer buffers large or unknown-length multipart bodies.
6. `verification/request`, `connections/accept`, `connections/decline` use `readBoundedJson`.
7. `readBoundedText` replaces unbounded `request.text()` in auth/pi, profile/me, rewards/claim, payments/intents, analytics events and vitals, the Paystack webhook and withdrawals/process.
8. Fifteen money-moving routes enforce a durable per-user throttle (12/min; 30/min for payments fulfill and incomplete), fail-closed.
9. Twenty social/account mutation routes enforce a durable per-user throttle (60/min; 10 verification; 20 reports).
10-13. Detailed output of `health/withdrawals`, `economy/health`, `payments/health`, `release/beta-readiness`, `release/final-audit` requires `x-ghc-operator-key` or `GHC_PUBLIC_DIAGNOSTICS=1`.
14. CSP adds `object-src 'none'; base-uri 'self'; form-action 'self'`.
15. HSTS adds `includeSubDomains`.
16. `@swetate/*` pinned to `0.1.0`; lockfile root synced.
17. Two feed gate scripts updated to match the current feed implementation.
18. `scripts/check-security-audit-20261109.mjs` guards all of the above.

## Operator actions
- Set `GHC_PAYOUT_RECONCILIATION_KEY` to >= 32 random characters.
- Rotate `GHC_A2U_ADMIN_KEY` to >= 32 characters, give the executor its own `PI_EARNINGS_EXECUTOR_KEY`, then raise `SHARED_WORKER_KEY_MIN_BYTES` to 32.
- Use `x-ghc-operator-key` for diagnostics, or set `GHC_PUBLIC_DIAGNOSTICS=1` temporarily on Testnet.

## Not changed (recommendations)
Split the shared A2U key; add CSP `script-src` with nonces; slim `prebuild`; enforce lint warnings; review Preview deployments with `PI_ALLOW_UNBOUND_APPROVE`; replace in-memory limiters on analytics endpoints.

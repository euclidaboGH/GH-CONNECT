# Pass 44 — Durable abuse-control hardening

**Source baseline:** `0.265.0`  
**Verification class:** source-level and network/database independent  
**Production status:** **NOT APPROVED**

## Objective

Remove per-process rate-limit state from the highest-impact financial and payment mutation paths. An in-memory map is not a globally consistent abuse-control boundary across serverless instances, cold starts, or regions.

## Integrated changes

The following authenticated routes now call the existing Supabase security control-plane RPC through `checkDurableRateLimit`, await the result, and use `onUnavailable: "deny"`:

- GHC transfers and ledger spends
- Daily reward claims, pending reward claims, and matured reward claims
- Pi cashback claims
- GHC pack purchases, including the per-day purchase cap
- Pi payment-intent creation and authenticated intent listing
- Pi earnings payout requests and payout execution

The route limits and per-user bucket identities are preserved. The change does not alter ledger amounts, reward eligibility, payment intent semantics, Pi provider execution, or GHC/Pi asset separation.

## Regression protection

- Added `scripts/check-pass44-durable-abuse-controls.mjs`.
- Registered it as `npm run check:pass44`.
- Added it to `verify:static` and `prebuild` so future changes cannot silently move these protected routes back to process-local rate limiting.
- Updated the daily-claim UX regression contract to assert the durable fail-closed behavior.

## Verification

- `npm run check:pass44` — PASS; all 10 protected routes checked.
- `npm run verify:static` — PASS, 57/57 registered static checks.
- Migration source manifest — PASS, 170/170 synchronized.

## Operational boundary and follow-up

The control-plane migration `20261023040002_gh_security_control_plane_v2.sql` must be confirmed applied in each target Supabase environment. This source change deliberately denies protected writes when the durable RPC is unavailable; operators must not disable fail-closed behavior to work around a missing migration.

The durable rate-limit bucket table also needs an operator-reviewed retention/cleanup strategy before very high-volume global operation. Do not add unbounded scheduled deletion or broad service-role grants without a migration review and concurrency tests. The existing local limiter remains for lower-risk routes and is not represented as globally distributed protection.

No live Supabase migration, Pi transaction, payout, Vercel deployment, or production data mutation was performed. Node.js `24.15.x` typecheck, lint, production build, and browser E2E remain required before release approval.

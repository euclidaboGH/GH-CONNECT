# Pass 45 — Security Control-Plane Retention and Contract Hardening

**Source baseline:** `0.265.0`  
**Status:** source changes and static contracts only; production remains **NOT APPROVED**.

## Scope

Pass 45 addresses a lifecycle gap discovered during review of Pass 44: durable rate-limit buckets and security events had no bounded retention execution path. The new additive migration `20261101010001_gh_security_control_plane_retention.sql` adds an `updated_at` index and extends the existing atomic consume RPC with opportunistic cleanup. Cleanup runs on approximately 1/256 of distinct hashed bucket keys and deletes at most 500 expired rate-limit rows and 500 expired security-event rows per invocation. Rate-limit rows are retained for at least two days, longer than the maximum supported one-day window. Event rows are removed only when an explicit expiry is present and due.

New server-appended security events receive a 90-day default expiry. Existing legacy events with NULL expiry are intentionally preserved; no historical retention policy is inferred or retroactively imposed.

The TypeScript control-plane adapter now validates bucket key length, limit/window bounds, and RPC result shape before accepting a result. Malformed responses are treated as unavailable, so callers configured with `onUnavailable: "deny"` remain fail closed. Input configuration errors throw rather than being silently clamped by the SQL function.

## Security and compatibility boundaries

- Existing atomic `INSERT ... ON CONFLICT` rate-limit consumption is retained.
- Existing service-role-only RPC ACLs are explicitly preserved.
- Client roles remain unable to read or mutate security-control-plane tables.
- No GHC balances, reward amounts, eligibility, Pi payment authority, or payout state are changed.
- The migration is classified `REVIEW_REQUIRED`; it is not an instruction to apply automatically.

## Verification

`test-pass45-rate-limit-contract.mjs` executes behavior tests for valid/invalid inputs and malformed RPC payload rejection. `check-pass45-security-retention.mjs` additionally asserts 90-day expiry defaults, bounded cleanup, and service-role ACL preservation. Both checks are wired into static verification and production prebuild.

## Operator gates

Before applying the migration, reconcile Testnet and Mainnet migration history independently. Validate PostgreSQL syntax, cleanup query plans, invocation frequency, row-lock behavior, event expiry, and service-role execution on a disposable database. This source report does not establish that any migration has been applied or that production runtime behavior has been tested.

# Run #246 — Supabase 403, PIN recovery 503 and account hydration reliability

Date: 2026-11-10  
Source: `GREENHAVEN-0.338.20-RUN245-15-ESSENTIAL-UPGRADES.zip`  
Release identity retained: `0.338.20`

## Findings

### 1. Earnings withdrawal process — HTTP 500 / `SUPABASE_HTTP_403`

The payout worker issued a direct PostgREST SELECT against `public.gh_pi_earnings_payout_requests`. The canonical migration `20261030010002_pi_earnings_payout_requests.sql` explicitly revokes direct table privileges from `service_role`, because financial records must be accessed through narrow SECURITY DEFINER RPCs. This source mismatch explains the observed permission failure when the request lookup is reached. The worker now calls `gh_pi_earnings_payout_get_owned(request_id, authenticated_user_id)`, which checks both values and returns only the minimal execution fields. It does not grant direct table SELECT back to the service role.

The source fix does not prove the exact remote cause of every 403. If the new RPC also returns 403 after its migration is approved and applied, verify that Vercel `SUPABASE_SERVICE_ROLE_KEY` is the actual service-role key for the same Supabase project and that the RPC ACL/schema cache are current. Never replace it with an anon key or expose the secret.

### 2. PIN recovery — HTTP 503 / Supabase 403

The recovery service previously used direct PostgREST table reads and writes. The migration granted `service_role` access, but a missing/unapplied migration, stale ACL or wrong project key could still cause a permission failure. Run #246 moves recovery status/setup/failure/reset operations to narrow service-role-only RPCs, reasserts PIN-table service-role grants, and keeps direct recovery-table access revoked. A 24-hour reset cooldown remains in force.

The new RPC migration is REVIEW_REQUIRED. The 503 cannot be confirmed fixed in the remote project until the target's migration history and service-role key are checked and the approved migration is applied.

### 3. Account hydration — intermittent HTTP 429

Run #245 already added in-flight deduplication and a short failure cache. Run #246 separates a prior server-confirmed immutable account anchor from the legacy profile-hint cache. Only a server-confirmed value can suppress the repeat anchor POST. This is a client UX optimization; server-side entitlement decisions remain authoritative.

### 4. Other supplied endpoints

The supplied `GET /api/messaging/conversations`, `GET /api/payments/intents` and `GET /api/payments/reconciliation` samples returned HTTP 200. These samples show successful route responses, not proof of payment completion or Pi settlement. No unrelated rewrites were made to those paths.

## Fifteen essential upgrades

1. Ownership-scoped payout request lookup RPC.
2. Continued direct payout-table ACL revocation.
3. Minimal payout execution projection.
4. Canonical UUID validation before database calls.
5. Sanitized retryable storage failure response.
6. Safe Supabase status/SQLSTATE diagnostics.
7. Explicit server-only PIN table grants and schema usage.
8. RPC-only recovery status access.
9. Insert-only recovery setup with database validation.
10. Atomic failed-answer accounting.
11. Atomic PIN reset + recovery unlock + 24-hour cooldown.
12. Persisted recovery-answer schema validation.
13. Durable fail-closed GET rate limiting for recovery status.
14. Read-only health probes for payout/recovery RPC grants.
15. Server-confirmed account-anchor cache to reduce repeat 429s.

## Verification

- Run #246 focused source contract: 18/18.
- Full `npm run verify:static`: exit 0 on the available Node.js 22.16.0 source-check environment.
- Withdrawals health source contract: 23/23.
- Run #245 account hydration regression: 16/16.
- Pi identity/withdrawal source contract: 10/10.
- Phase 4 payout execution worker contract: 21/21.
- Phase 1–10 upgrade pack: 20/20.
- Project truth: 11/11; repository consistency: 6/6; documentation hygiene: PASS.
- Migration source manifest: 200/200; SQL lexical integrity: PASS across all 200 migration files.
- TypeScript syntax transpilation: all five modified TypeScript files passed. This is not a full typecheck.

## Read-only postflight

After the migration is approved and applied to the intended Testnet project, run `supabase/tests/verify_run246_withdrawal_rpc_acl.sql` in the SQL editor. It checks effective table/function privileges and RLS from system catalogs only; it does not inspect user rows or mutate data.

## Release and operational boundary

The new migration is present in the repository and classified REVIEW_REQUIRED. It has **not** been applied to Supabase. The canonical migration inventory is a repository source inventory only and does not prove remote applied state. Reconcile Testnet and Mainnet migration histories independently, rehearse the migration on disposable PostgreSQL with Supabase roles/PostgREST, then approve/apply one migration at a time. Do not run `supabase db push` as a shortcut.

No Pi payment was created/submitted/completed, no GHC/Pi ledger or balance was modified, no payout was released, no GitHub push was made, and no Vercel deployment was performed. Node 24.15.0 dependency-backed typecheck/lint/build and live Testnet acceptance remain required. The current environment is Node 22.16.0 with no `node_modules`, so no full ESLint, TypeScript typecheck or Next.js build is claimed. Production remains NOT APPROVED.

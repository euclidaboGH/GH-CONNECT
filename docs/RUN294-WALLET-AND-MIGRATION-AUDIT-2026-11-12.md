# Run #294 — Wallet release-copy repair and Testnet migration audit

**Source:** GreenHaven / GH-CONNECT `0.338.55` (Run #293 project bundle)  
**Audit date:** 2026-11-12  
**Target database:** Testnet project `tpckwgdsjlkzscjlxiwe`  
**Release status:** NOT APPROVED

## 1. Wallet release explanation and CI regression repair

The Priority 3 wallet contract and the older Run #278 release-reserved contract asserted two different exact phrases for the same safety boundary. The UI already explained that uncertain and processing payouts remain reserved, but the newer copy no longer contained the legacy Run #278 phrase `never started provider execution`, and it did not include the Priority 3 phrase `not spendable while a request is unresolved`.

The wallet explanation now explicitly states:

- reserved funds are held for incomplete withdrawal requests;
- they are not spendable while a request is unresolved;
- return is limited to a never-started request that never started provider execution;
- processing and uncertain requests remain reserved until authoritative Pi reconciliation;
- a missing payment ID alone is not proof that no payment exists.

No balance calculation, provider call, payout state transition, cancellation predicate, settlement path, or ledger mutation was changed.

## 2. Run #251 — SECURITY DEFINER RPC ACL hardening

**Local source candidate:** `supabase/migrations/20261110160001_security_definer_rpc_server_only_acl_hardening.sql`  
**Local classification:** `REVIEW_REQUIRED`  
**Testnet history entry:** `20261110092119 / server_only_security_definer_rpc_acl_hardening`

### Source review

- Scope is limited to functions in `public` with `prosecdef = true`.
- Revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
- Does not grant new `service_role` permissions; existing service-role ACLs are preserved.
- Sets the default function ACL for future `postgres`-owned public functions to exclude `PUBLIC`, `anon`, and `authenticated`.
- Does not re-enable the intentionally disabled generic reward staging function.
- Source checks confirm browser components, hooks, contexts, and features do not call Supabase RPC directly.

### Live Testnet postflight

The current catalog snapshot (2026-11-12) reports **303** public `SECURITY DEFINER` functions, **0** executable by `anon` or `authenticated`, and **298** executable by `service_role`. Five functions remain non-service-role-executable, consistent with disabled, legacy, or trigger/internal use:

- `gh_pi_wallet_authorization_grant(text,text,text)` — legacy grant overload, intentionally not service-role enabled;
- `gh_story_view(text,text)` — legacy story-view RPC revoked by the privacy migration;
- `gh_treasury_financial_report_phase7_base(timestamptz,timestamptz)` — internal base function;
- `ghc_membership_entitlement_event_capture()` — trigger function;
- `ghc_stage_pending(...)` — generic reward staging function intentionally disabled by policy.

The live `postgres` default function ACL for `public` grants execution only to `postgres` and `service_role`; it excludes `anon` and `authenticated`. The SQL inspection connection reported `current_user = postgres`, matching the role whose defaults this migration hardens. The separate `supabase_admin` default ACL remains outside this migration's scope; any future process creating public functions as that role must be separately reviewed.

### Version reconciliation boundary

Testnet records the operation under version `20261110092119`, while this archive's local candidate uses version `20261110160001`. The operation's postflight effects are confirmed, but the exact SQL text originally applied under `20261110092119` was not recoverable from migration history alone. Do not rename, mark applied, or replay the local candidate based only on matching names/effects. Keep it `REVIEW_REQUIRED` until the original applied SQL is restored or a separately approved history reconciliation is completed.

## 3. Run #252 — function search_path hardening

**Local source candidate:** `supabase/migrations/20261110170001_function_search_path_hardening.sql`  
**Local classification:** `REVIEW_REQUIRED`  
**Testnet history entry:** `20261110092226 / function_search_path_hardening`

### Source and live review

The migration changes only the function configuration of two `SECURITY INVOKER` helpers and does not replace their bodies or update financial/application rows:

- `public.ghc_available_balance(text)` now has `search_path = pg_catalog`. Its body fully qualifies `public.ghc_transactions`. The table has RLS enabled; its SELECT policy restricts visible rows to `user_id = auth.uid()`, and client write policies explicitly deny INSERT, UPDATE, and DELETE.
- `public.gh_reputation_level_from_points(integer)` now has `search_path = pg_catalog` and uses only built-in SQL expressions.

Both live function definitions were inspected and their configurations match the candidate migration. The Testnet history version is `20261110092226`, not the local filename version `20261110170001`; exact historical SQL is still unavailable. Keep the local candidate `REVIEW_REQUIRED` and do not replay it.

## 4. Existing migration-source audit

The archive contains **221** canonical SQL migration files. The following source-level checks passed:

- SQL lexical integrity: 221/221 files (balanced strings, comments, dollar quotes and parentheses);
- migration source manifest: 221/221 synchronized;
- clean migration filenames: 221 unique 14-digit versions;
- migration release-readiness chronology checks;
- Runs #250–#255 migration contract checks;
- project truth: 11/11;
- release hygiene: 15/15;
- Vercel build hygiene: 17/17.

The current Testnet migration catalog contains **40** history rows. This does not mean all 221 local migrations are applied. The project still has known historical source/version drift; do not bulk-apply, `db push`, rename migrations, or run `migration repair` based on filename order or matching migration names. Testnet and Mainnet must be reconciled independently.

## 5. CI verification

`npm run verify:static` completed successfully (exit code 0) after the wallet copy repair. This runs the repository's registered static contracts, including Priority 3, Run #278, Run #251, Run #252, and Run #291 checks.

The available local runtime is Node `22.16.0`, while the project pins Node `24.15.0`. Therefore the full Node 24 prebuild, typecheck, ESLint, dependency-backed Next.js production build, and disposable-PostgreSQL migration rehearsal were not run in this environment. These remain required before release approval.

## 6. Operations not performed

- No Supabase migration was applied or replayed during this audit.
- No migration history row was inserted, renamed, repaired, or deleted.
- No Mainnet database was accessed or changed.
- No payout, Pi payment, GHC credit, or financial settlement was executed.
- No GitHub push or Vercel deployment was performed.

**Decision:** the two migrations have passed source review and their corresponding Testnet postflight effects are confirmed. Their exact historical SQL/version mapping remains unresolved, so the local migration files remain `REVIEW_REQUIRED`. Static CI is green; production/Testnet release approval remains blocked on Node 24.15.0 full build and database migration rehearsal/history reconciliation.

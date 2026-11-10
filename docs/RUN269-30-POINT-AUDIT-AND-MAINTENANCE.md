# GREENHAVEN Run #269 — 30-point system audit and maintenance

**Source baseline:** `GREENHAVEN-0.338.29-RUN268-STATIC-GATES-FIX.zip`  
**Working release:** `0.338.30`  
**Audit date:** 2026-11-10  
**Live database target changed:** GH Connect Testnet only (`tpckwgdsjlkzscjlxiwe`)  
**Production status:** NOT APPROVED

This is a 30-point audit register, not a claim that 30 independent production incidents were reproduced. It separates confirmed defects repaired in source, a live Testnet permission repair, and external release blockers that must remain held rather than being “fixed” through unsafe data or provider mutations.

## 30 findings and actions

| # | Finding | Severity | Result |
|---:|---|---|---|
| 1 | The consolidated Phase 1–12 acceptance fixture still identified `0.338.27` while the package was `0.338.29`. | High | Corrected; advanced to `0.338.30`. |
| 2 | The request-boundary regression required `docs/UPGRADE-WORKLOG-0.338.29.md`, which was missing from the GitHub checkout. | High | Run #268 worklog added; current check now resolves the package-versioned worklog. |
| 3 | The Phase 12 acceptance fixture did not identify the current source baseline. | High | Corrected and version-synchronized. |
| 4 | The Phase 12 final release fixture did not identify the current release. | High | Corrected and version-synchronized; production no-go remains. |
| 5 | The visual-cohesion prebuild check expected an obsolete `gap-y-1.5` action layout while the current toolbar correctly uses `gap-y-2`. | High | Assertion updated to the current semantic toolbar/dock structure. |
| 6 | The social-loop check expected a literal `aria-label="Comment"`, but the current control includes the live comment count in its accessible name. | Medium | Assertion updated to the dynamic accessible label and retained Share semantics. |
| 7 | The social-loop check expected `role="article"` even though the component uses a native `<article>` element. | Medium | Assertion updated to native article semantics, keyboard activation and visible focus. |
| 8 | Those two prebuild UI checks were not included in `verify:static`, allowing static verification to pass while Vercel prebuild failed. | High | Both checks now run in prebuild and static verification. |
| 9 | The release-gate runner did not enforce parity for those UI checks. | High | Added a prebuild/static parity contract. |
| 10 | The Run #267 header/wallet check hard-coded package version `0.338.29`, creating the next version-bump failure. | High | Changed to semantic-version and package/lockfile synchronization. |
| 11 | `PROJECT_TRUTH.md` still identified Run #267 / `0.338.29` as the current source increment. | Medium | Updated to Run #269 / `0.338.30`. |
| 12 | `SOURCE_OF_TRUTH.md` still described the older `0.338.23` archive as the current user baseline. | High | Updated to the corrected Run #268 `0.338.29` archive and its SHA-256. |
| 13 | The current source migration inventory counted 209 files before the Run #269 security migration. | High | Added the 210th canonical migration and regenerated the source inventory. |
| 14 | The Testnet reconciliation snapshot listed 11 generated history records before the new permission migration. | Medium | Updated the current snapshot to 13 generated records; historical snapshots remain labelled historical. |
| 15 | The migration checklist reported 117 unused-index candidates while the current Testnet advisor reports 111. | Medium | Current inventory updated; no unused index was dropped. |
| 16 | The current migration snapshot listed one uncertain Pi payout, while live Testnet now contains three. | Critical | Current snapshot updated; all three remain reserved pending provider reconciliation. |
| 17 | `anon` had direct INSERT/UPDATE/DELETE privileges on 99 public tables despite the application using server-side mutation routes. | Critical | Revoked on Testnet; 0/140 public tables retain client write privileges. |
| 18 | `authenticated` had direct INSERT/UPDATE/DELETE privileges on the same 99 public tables. | Critical | Revoked on Testnet; service-role mutation paths preserved. |
| 19 | `anon` had TRUNCATE on 99 public tables; RLS does not protect TRUNCATE. | Critical | Revoked on Testnet. |
| 20 | `authenticated` had TRUNCATE on 99 public tables; RLS does not protect TRUNCATE. | Critical | Revoked on Testnet. |
| 21 | `anon` had REFERENCES/TRIGGER privileges on 99 public tables, which are unnecessary for the browser/API architecture. | High | Revoked on Testnet. |
| 22 | `authenticated` had REFERENCES/TRIGGER privileges on 99 public tables. | High | Revoked on Testnet. |
| 23 | `anon` had USAGE/SELECT/UPDATE on all nine public sequences. | High | Revoked on Testnet. |
| 24 | `authenticated` had USAGE/SELECT/UPDATE on all nine public sequences. | High | Revoked on Testnet. |
| 25 | The postgres-owned default table ACL automatically granted client privileges to future public tables. | Critical | Default table privileges changed to fail closed for `anon` and `authenticated`. |
| 26 | The postgres-owned default sequence ACL automatically granted client privileges to future public sequences. | High | Default sequence privileges changed to fail closed for `anon` and `authenticated`. |
| 27 | No dedicated regression gate protected the public-table and sequence ACL contract. | High | Added Run #269 ACL regression check to prebuild and static verification. |
| 28 | No source gate prevented future browser-side Supabase clients/direct PostgREST table calls from bypassing server mutation boundaries. | High | Added a browser-surface guard; current application browser surfaces contain no Supabase SDK or direct PostgREST client. |
| 29 | Mainnet Supabase is inactive, and the production Vercel project's Supabase URL maps to that inactive Mainnet project. | Release blocker | Not changed. Do not unpause Mainnet or promote Testnet without an explicit operator release decision and full reconciliation. |
| 30 | Testnet still has three provider-uncertain payout requests, two APPROVED but unfulfilled membership intents, and only 13 generated migration-history records against 210 canonical source migrations. | Critical / release blocker | No payout, entitlement or migration replay was performed. Reconcile exact Pi provider state and complete migration history before any financial recovery or broader migration deployment. |

## Testnet migration applied

`20261110174922_revoke_client_table_write_and_sequence_privileges.sql` was applied to active Testnet through the connected Supabase migration operation and recorded as generated history version `20261110174922`.

The migration:

- revokes `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` from `anon` and `authenticated` on existing public tables;
- revokes `USAGE`, `SELECT` and `UPDATE` from those roles on public sequences;
- removes postgres-owned default grants for future public tables and sequences;
- preserves existing SELECT grants and RLS policies, as well as service-role privileges.

Postflight confirmed 140/140 public tables still have RLS, zero public tables grant client write/DDL-adjacent privileges, and zero of nine public sequences grant client privileges. `service_role` retains SELECT on 121 public tables; the 99 pre-existing anon SELECT grants remain RLS-governed. No business rows or financial records were modified. Mainnet was not accessed.

The separate `supabase_admin` default ACL remains platform-managed because the `postgres` migration role is not a member of `supabase_admin`. All current public tables are postgres-owned; this residual default-privilege path requires a platform-admin review before any future `supabase_admin`-owned public objects are created.

## Verified security and database controls retained

- 140/140 public tables have RLS enabled.
- Thirteen RLS-enabled tables intentionally have no policies and therefore deny client access; no generic policies were added.
- The two unconditional public SELECT policies expose only the public identity projection and economy-limit configuration; their existing SELECT access remains.
- 0/290 public `SECURITY DEFINER` functions are executable by `anon` or `authenticated`; 286 remain service-role executable.
- No public function was found missing a fixed search path.
- No public view was found missing `security_invoker`.
- No missing foreign-key index was found in the application `public` schema.
- No duplicate-index, auth RLS initplan or multiple-permissive-policy advisor findings remain.
- The 111 unused-index candidates were not dropped because low-traffic Testnet statistics are insufficient evidence for safe removal.
- Supabase health advisor returned no lints.

## Remaining verification and release limits

- The two latest Testnet Vercel preview builds failed at the stale prebuild assertions corrected in this increment. A successful new Node 24 preview build is still required.
- An older deployment had an out-of-memory build event; the latest failed builds stopped at prebuild assertions and did not reproduce that OOM. Monitor the next successful build before changing build-machine or concurrency settings.
- The available local runtime is Node 22.16.0, while the project requires Node 24.15.0; `node_modules` is absent. Full dependency-backed typecheck, lint and production build must run in the pinned Node 24 CI/Vercel environment.
- Three uncertain payout requests have no provider payment ID, txid, receipt or provider verification; no active lease; and three total attempts across the set. Do not release, settle or retry them without authoritative Pi provider evidence.
- Two APPROVED membership intents have no txid, completion timestamp or fulfilment timestamp. Do not grant entitlements without provider verification.
- Testnet has 13 generated migration records against 210 canonical source files. Do not run `supabase db push`, repair history or replay historical migrations until a complete source/remote reconciliation is approved.
- Mainnet is inactive. Production remains NOT APPROVED.

## Additional Testnet/hosting configuration review

- The Testnet preview Vercel project has neither password protection nor SSO protection. It is therefore publicly reachable as a preview deployment. This may be intentional for external Testnet testers; it was not restricted because that could block intended testers. Confirm whether public preview access is required.
- Testnet `PI_EARNINGS_AUTO_EXECUTE` is enabled, but payout-request creation, payout execution and A2U feature flags are disabled. The execution path remains closed by the independent server-side gates. I did not change these operator-controlled flags.
- Testnet `GHC_CURATION_REDISTRIBUTE_ENABLED` is enabled. This is a user-initiated, balance-funded redistribution path, not GHC minting; it can move existing GHC between participants. It was left unchanged pending product-policy confirmation.
- The production Vercel project retains SSO protection and has no Testnet payout-execution flags. Its configured Supabase target is the inactive Mainnet project, so the production deployment is not a valid live acceptance signal.

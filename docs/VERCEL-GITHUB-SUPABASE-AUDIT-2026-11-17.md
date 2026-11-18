# GREENHAVEN Vercel, GitHub and Supabase audit — 2026-11-17

## Scope and authority

- Project package: `gh-connect@0.338.92`; user-facing brand: GREENHAVEN.
- Authoritative source archive: `GREENHAVEN-0.338.92-TESTNET-QUARANTINE-ENV-PREP-2026-11-17-1.zip`.
- Authoritative archive SHA-256: `90cb8260f2b5a7fdf345135c636c250b591eb4a0be625d86b61eae988e12b578`.
- GitHub repository/branch under investigation: `euclidaboGH/GH-CONNECT`, `testnet`.
- Release status: NOT APPROVED. This review did not apply a Supabase migration, change Mainnet, alter wallet balances, execute a Pi transaction, or deploy to production.

## 1. Vercel build failure

The deployment from commit `cecff93b5995a10665bb893fa6f70826a6830533` stops in prebuild check 004/358. The failed Run #300 assertions are:

1. `.github/workflows/ci.yml` exists and is readable.
2. CI permissions are read-only for repository contents.
3. Both CI jobs pin Node `24.15.0`.
4. Each CI install job verifies dependency-lock integrity before `npm ci`.

The GitHub Contents API confirms that `.github/workflows/ci.yml` is absent from `testnet` and present on the default branch. The trusted default-branch workflow was copied unchanged into this local remediation candidate. It uses `contents: read`, Node `24.15.0`, dependency-lock checks before both installs, static/RLS/SECURITY DEFINER checks, typecheck, lint, safety scan and build. It does not apply migrations or deploy Vercel production.

The archive-derived candidate also repairs malformed Supabase transport calls found in identity, session, step-up, WebAuthn, withdrawal PIN, messaging, membership, media ownership, cashback and ledger helpers. Dynamic RPC names are passed as expressions (not literal interpolation strings), and each RPC body is restored from its SQL signature. Identity insert-only semantics, server-side media ownership, conversation membership checks and non-spending membership recovery boundaries are preserved. The RLS source checker now understands the reviewed dynamic table loop only when RLS enablement, client-role revocation and the service-role grant are all present in the same block.

The local candidate passes:

- Run #300 release integrity: 22/22.
- Run #301 release-gate hardening: 20/20.
- Run #250 identity integrity: 10/10.
- Database RLS source coverage: 174 table names.
- SECURITY DEFINER source audit: 481 declarations.
- Migration source manifest: 229/229.
- Project truth: 11/11.
- Vercel build hygiene: 17/17.
- Phase 4 identity snapshot: 8/8 plus 13 runtime assertions.
- Dependency lock integrity: PASS.
- Strict merge-conflict marker scan: PASS.

The current GitHub branch remains unchanged because the connected GitHub write operation returned HTTP 403 (`Resource not accessible by integration`). The candidate fix is therefore not yet present on `testnet`, and Vercel will continue to build the old branch head until the repository write permission is restored and the change is committed.

## 2. Additional GitHub source-integrity blocker

Inspection of the `cecff93` commit diff found unresolved merge-conflict markers committed into source and documentation. Confirmed affected paths include:

- `MIGRATION-SOURCE-MANIFEST.csv`
- `VERIFIED_MANIFEST.txt`
- `docs/ARCHIVE-HIDDEN-METADATA-GAP.md`
- `docs/MIGRATION_CHECKLIST.md`
- `docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md`
- `docs/PHASE-1-CONSOLIDATED-AUDIT-AND-IMPLEMENTATION-REGISTER-2026-11-09.md`
- `docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md`
- `docs/PROJECT_TRUTH.md`
- `docs/SOURCE_OF_TRUTH.md`
- `docs/UPGRADE-WORKLOG-0.338.92.md`
- `lib/navigation/service-registry.ts`
- `lib/server/social/rpc.ts`
- `scripts/generate-migration-inventory.mjs`
- `supabase/TESTNET_APPLY_ORDER.md`

This is not just a cosmetic documentation issue. Conflict markers affect the canonical migration classification, release baseline, service registry destination and social RPC/REST transport implementation. The authoritative archive-derived local candidate contains no Git conflict markers in executable source. The exact authoritative files should replace the conflicted branch copies; do not manually choose one side of the conflict without reconciling against the 0.338.92 source of truth.

## 3. Dependency and npm warnings

The reported install completed, but npm reported 22 vulnerabilities: 1 low, 6 moderate, 13 high and 2 critical. It also warned about:

- `isomorphic-dompurify@3.20.0` — upstream semver/runtime mismatch; Node 24.22.3 meets the project's Node 24.15+ runtime floor, but the package still needs a deliberate major upgrade and regression run.
- `eslint@9.39.5` — unsupported release line; moving to ESLint 10 requires migration and lint-config compatibility checks.
- `js-xdr@1.3.0`, `stellar-base@8.2.2`, `stellar-sdk@10.4.1` — deprecated/moved packages pulled transitively through `pi-backend@0.1.3`.

No lockfile-only overrides were applied. The Stellar packages are on the Pi payment/signing/XDR dependency path; replacing them without a compatible Pi adapter and Testnet transaction/XDR acceptance could break financial functionality. A fresh `npm audit --json`, dependency graph review, lockfile regeneration and tests must be completed in a registry-connected Node 24 environment before these are declared resolved. Do not run `npm audit fix --force` as a blanket repair.

The current build log does not show a memory/disk exhaustion problem. The large files reported are Vercel cache/SWC artifacts, not evidence of oversized committed application assets. The `.vercelignore` removal of Git internals is expected upload filtering.

## 4. Supabase Testnet audit

The connected `GH Connect Testnet Supabase` project reports `ACTIVE_HEALTHY`. Its applied migration history currently ends with `20261116171144_gh_research_studio_public_forms`; the three newer research/evidence migrations remain unapplied and `REVIEW_REQUIRED` in the authoritative source inventory.

The Security Advisor returned 16 INFO findings for tables with RLS enabled but no policies. Read-only catalog inspection confirmed all 16 have RLS enabled and zero policies. Their direct ACLs split into:

- 5 explicitly service-role-only tables;
- 3 tables with no explicit API-role grants;
- 8 tables whose ACL includes anon/authenticated/service_role, but RLS with zero policies still denies row access.

This is fail-closed at the row-policy layer, but the eight broadly granted/no-policy tables deserve explicit owner and intended-access review. Do not add permissive policies merely to silence the advisor. For each table, choose and test one of: service-role-only with client grants revoked; narrowly scoped authenticated policies; or a documented intentional deny-all table. Confirm app routes use server-side identity and service-role access only where intended.

The Performance Advisor returned 120 `unused_index` INFO findings. Do not drop these indexes automatically: advisor usage can be affected by database age, workload coverage, and statistics resets. Compare index size and `pg_stat_user_indexes` over a representative Testnet workload, identify duplicate/overlapping indexes, and remove only after query-plan and write-cost validation.

The Health Advisor returned no findings.

## 5. Supabase Mainnet audit boundary

The connected `GH Connect Mainnet Supabase` project is reported `ACTIVE_HEALTHY`. Its Security Advisor flagged `public.rls_auto_enable()` as a `SECURITY DEFINER` function executable by `anon` and `authenticated`. Catalog inspection confirmed its `search_path` is pinned to `pg_catalog`, but its execute ACL includes those roles. This should be reviewed and hardened through a reviewed, reversible SQL migration after confirming the event-trigger binding and required owner privileges.

No Mainnet change was made. The Mainnet migration list and exposed-table listing returned empty in this connector inspection, so do not infer that the Testnet schema or migrations are present there. Mainnet must remain untouched until its schema, migration history, backup/restore posture and intended event-trigger execution are independently reconciled and the target-specific change is authorized.

## 6. Required repair order

1. Restore GitHub write permission for the connected integration, or have a repository maintainer apply the attached candidate changes.
2. Repair the 14 conflict-marked branch files from the authoritative 0.338.92 archive and add the trusted CI workflow. Verify there are no `<<<<<<<`, `=======`, or `>>>>>>>` conflict markers in executable files or release metadata.
3. Re-run Run #300, Run #301, migration inventory, source-truth, social transport and route ownership checks.
4. Run a clean Node 24.15+ install and the complete 358-check prebuild, typecheck, lint, safety suite and Next.js production build. The current log stops before the rest of the 358 checks; no full build has passed yet.
5. Produce a current npm audit report and resolve each advisory through tested compatible dependency updates.
6. Review Testnet RLS findings table-by-table and unused indexes against real workload/query plans.
7. Separately review the Mainnet event-trigger function ACL and stage any change for explicit approval; do not run it as part of this Testnet repair.
8. Keep the three research/evidence migrations unapplied until disposable-database rehearsal, exact Testnet schema/history reconciliation and explicit migration approval.
9. Keep the evidence scanner quarantined until a trusted scanner provider is deployed and callback/hash-chain verification passes.
10. Rebuild Vercel Preview from the corrected `testnet` commit; inspect the full 358-check result, typecheck, lint, Next build and post-build logs before any release decision.

**Conclusion:** The immediate Vercel blocker is a missing branch workflow. The branch also contains committed merge-conflict markers, making source reconciliation a P0 prerequisite. The dependency warnings and vulnerabilities remain unresolved. Supabase Testnet is active but has RLS-policy and index-review items; Mainnet has a separate SECURITY DEFINER ACL finding that is deliberately not modified. Production remains NOT APPROVED.

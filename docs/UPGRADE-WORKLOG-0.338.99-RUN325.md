# Upgrade worklog — 0.338.99 / RUN325 full audit and referral schema repair

## Baseline and disposition

- User-designated source archive: `GREENHAVEN-0.338.99-RUN324-PHASE2-EXAMS-ELECTIONS-PHASE3-QUALITY.zip`.
- Baseline archive SHA-256: `c0fed818a0cd037b0af61e7406e01696dcfc30d8e3515e77a2d29c1343ca7c5c`.
- Working derivative: RUN325; package version remains `0.338.99` because this is a surgical maintenance increment, not a certified product release.
- Disposition: local source candidate only; production remains NOT APPROVED.

## Confirmed live infrastructure findings

### Vercel

- Deployment `dpl_FXocaq5bc4cJ3P9ZDMvFJoE8zVRK` is READY on Preview / `testnet`, project `gh-connect-5p3o`.
- The deployment cloned commit `2f5010d43056ac6f0cc3d32ed4c7929a4095db30` and used Node `24.22.3`, Next.js `15.5.26`, Vercel CLI `65.15.0`.
- Vercel build output confirms 365 prebuild checks executed and the Next.js build emitted its route output. This is deployment evidence for that commit; it does not by itself prove the uploaded archive is byte-identical to that commit.
- Install output reported 29 vulnerabilities: 1 low, 5 moderate, 21 high, 2 critical. Deprecation warnings included `isomorphic-dompurify@3.20.0`, `js-xdr@1.3.0`, `stellar-base@8.2.2`, `stellar-sdk@10.4.1`, and `eslint@9.39.5`.
- Runtime log retrieval beyond one hour is unavailable on the connected Hobby plan. The supplied GET `/` was a cache HIT aged 42m10s, so HTTP 200 is not evidence of a fresh uncached application render.

### Supabase Testnet (read-only inspection)

- Project `tpckwgdsjlkzscjlxiwe` is ACTIVE_HEALTHY on PostgreSQL 17.11.
- Public schema inventory: 151 tables, all 151 with RLS enabled; 141 policies; 340 public functions; migration history table present.
- Security advisor: 16 RLS-enabled tables without policies. Catalog inspection shows eight of those have anon/authenticated SELECT grants but no policies; RLS currently denies row access, but grants should be removed or explicitly justified for server-only tables. No broad policies were added.
- Performance advisor: 118 unused-index notices. No indexes were dropped; usage must be evaluated against workload and infrequent financial/security operations.
- Health advisor returned no findings.
- PostgreSQL logs in the supplied 24-hour window showed 13 occurrences of SQLSTATE `42703`: `column ghc_referral_attributions.created_at does not exist`.
- The live table has `attributed_at`, not `created_at`. The source referral service selected the nonexistent `created_at` field, causing its referred-by lookup request to fail.
- Live migration history records `20261116170409_gh_field_reports_public_intake` and `20261116171144_gh_research_studio_public_forms`, but does not record the three later Research Intelligence / Media Evidence / Scoped Upload migrations. No database mutation was performed.
- Mainnet project `rrrtjowuldcpbjobbpic` was identified but not queried or modified.

## Source repair

- Updated `lib/server/referral/referral-service.ts` to select `referrer_user_id,attributed_at`, matching the deployed table schema.
- Extended `scripts/test-fee-referral-contract.mjs` with a regression assertion that rejects the stale `created_at` selection.
- Registered the referral contract in `prebuild:checks` and `verify:static`.
- Corrected the active source-of-truth documentation to identify the user's actual RUN324 archive, rather than the stale RUN322 pointer.
- No migration, table, policy, grant, index, wallet, ledger, reward, payout, payment, entitlement, Pi setting, GitHub branch, or Vercel deployment was changed.

## Verification

- `npm run verify:static`: PASS in the available Node `22.16.0` environment, including the new referral regression assertion.
- Referral/fee contract: 10/10.
- Phase 2 exam/election contract: 22/22.
- Research integrity hardening: 12/12.
- Field-intake hardening: 7/7.
- Research membership API: 13/13.
- Research Intelligence foundation: 20/20.
- Scoped evidence engine: 25/25.
- Evidence file signatures: 16/16.
- Community pagination: 12/12.
- Community completion: 21/21.
- Community poll accessibility: 10/10.
- Marketplace search quality: 6/6.
- Feed quality contract/runtime: 25/25 plus runtime PASS.
- Durable feed preferences contract/runtime: 13/13 plus runtime PASS.
- Run 318 Pi auth reliability: 11/11.
- Run 317 browser-safe crypto source/runtime: 9/9 and 7/7.
- Run 300 release integrity: 22/22; Run 301 release-gate hardening: 20/20.
- `npm ci --legacy-peer-deps` could not complete within the available workspace execution window. The local runtime is Node `22.16.0`, below the project requirement `^24.15.0`; full local dependency-backed typecheck, lint and Next.js build are therefore NOT claimed.

## Remaining release blockers

1. Obtain the complete online `npm audit --json` report and remediate the 2 critical and 21 high findings with smallest compatible dependency changes. Do not run `npm audit fix --force`; the Stellar/Pi backend chain requires Pi Testnet compatibility tests.
2. Complete supported Node 24.15+ clean install, typecheck, lint, full prebuild and production build on the exact RUN325 source.
3. Review all 16 RLS/no-policy tables individually. Revoke direct anon/authenticated grants on intentionally server-only tables through reviewed migrations; do not add broad RLS policies just to silence the advisor.
4. Review the 118 unused-index findings against query plans and infrequent operational workloads; do not bulk-drop.
5. Rehearse the three held Research Intelligence / Media Evidence / Scoped Upload migrations on disposable PostgreSQL, verify dependency order and rollback/partial-failure behavior, reconcile Testnet migration history, then obtain explicit approval before any Testnet application.
6. Implement and test atomic election tally submission and candidate-vote persistence before calling the election workflow complete.
7. Configure and verify a trusted evidence scanning provider/worker; evidence must remain quarantined until a matching digest is attested clean.
8. Complete populated geography-data validation and real Pi Browser / Android / exam / election / Feed / Community / Messaging / Marketplace acceptance.
9. Reconcile the connected GitHub branch/workflow state with the Vercel commit; do not infer that a READY deployment means the exact uploaded RUN324/RUN325 archive has been deployed.

## Safety boundary

No GitHub push, Vercel deployment/promotion, Supabase mutation, SQL migration application, Mainnet operation, wallet/payment/payout operation, reward issuance, or user-account mutation was performed. Production remains NOT APPROVED.

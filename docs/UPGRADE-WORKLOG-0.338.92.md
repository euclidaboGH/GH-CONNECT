# Upgrade worklog — GreenHaven 0.338.92

## Scope

This source increment corrects the fail-closed evidence scanner defaults in `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql`. Both research and field-report `scan_status` columns now default to `pending`, never `clean`. This ensures new and legacy evidence is not considered malware-scanned without a trusted scanner attestation.

## Testnet Vercel environment preparation

The existing Vercel project `gh-connect` has branch-scoped Preview variables for branch `testnet`: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `GH_MEDIA_BUCKET=gh-media`. These point only to the Testnet Supabase project. Production variables were not changed, and no Production secrets were copied into Preview.

## Remaining operator prerequisites

- Add the Testnet `SUPABASE_SERVICE_ROLE_KEY` as a sensitive Preview variable scoped to branch `testnet`; it cannot be obtained through the available Supabase API-key connector and must never be copied from Production.
- Set `GHC_FIELD_ADMIN_USER_ID` to the intended central administrator's authenticated user ID.
- Configure `GHC_EVIDENCE_SCANNER_SECRET` only when a trusted malware-scanner worker is deployed and ready to sign callbacks.
- Apply the three migrations to Testnet in dependency order only after exact SQL payloads are reconciled against the live database.

## Database status

No migration was applied by this source increment. The connected GitHub `testnet` branch did not contain the three migration files, so its file API could not supply the exact SQL payloads to the Supabase migration runner. No database DDL was executed. Mainnet remains untouched.

## Deployment status

No GitHub commit, Vercel deployment, Mainnet change, or scanner activation was performed.


## Vercel and GitHub release-integrity remediation

1. Reconciled the actual GitHub default-branch CI workflow against the Testnet branch; the Testnet branch returned 404 for `.github/workflows/ci.yml`, while the default branch contains the repository's read-only CI workflow.
2. Restored the repository CI workflow into the release candidate without changing GitHub directly.
3. Kept CI permissions least-privilege with `contents: read`.
4. Kept CI pinned to Node.js 24.15.0 in both jobs, matching the package engine contract.
5. Kept dependency-lock verification before both clean `npm ci --legacy-peer-deps` installs.
6. Preserved static verification, database RLS coverage and SECURITY DEFINER ACL checks.
7. Preserved explicit typecheck, lint, production safety scan and production build steps.
8. Verified the workflow does not apply Supabase, Prisma or Drizzle migrations and does not trigger Vercel production deployment.
9. Hardened Run #300 so missing workflow metadata produces explicit failed assertions rather than an uncaught filesystem exception; corrected case-insensitive release no-go assertions.
10. Synchronized the current release pointers in the consolidated audit register, Phase 1–12 acceptance fixture and Phase 12 readiness fixture without rewriting their historical snapshots.

## Source-only verification limits

The source-only verification scope covers repository metadata and static source contracts only; it does not establish a successful clean production build or live environment acceptance.

This is source-only verification. The supplied Vercel log confirms the immediate failure was the absent `.github/workflows/ci.yml` file on the deployed `testnet` commit `f4ef11f`. The restored workflow and release checks were verified locally with Node.js 22.16.0 where the scripts permit it. The project requires Node.js 24.15.0; a clean Node 24 install, complete 358-check prebuild, TypeScript, lint, Next.js build and browser/device acceptance have not been executed in this environment.

The registry was unreachable from the local environment during dependency investigation. Therefore the reported 22 npm vulnerabilities and deprecation notices are not represented as resolved. The Pi backend's legacy Stellar packages are transitive through `pi-backend@0.1.3`; no unverified npm override or SDK replacement was made on the Pi payment path. Obtain a fresh `npm audit --json` from a registry-connected Node 24 environment before selecting non-breaking remediations.

Required Node runtime: Node.js 24.15.0 or a compatible later Node 24 release satisfying `package.json`.

No GitHub push, Vercel deployment, database migration, financial mutation, scanner activation, or Mainnet operation was performed. Production remains NOT APPROVED.

## Verification results for the remediation candidate

- Run #300 release integrity: 22/22 passed.
- Run #301 release gate: 20/20 passed.
- Phase 1–10 upgrade pack: 20/20 passed.
- Project truth: 11/11 passed.
- Migration source manifest: 229/229 passed.
- Vercel build hygiene: 17/17 passed.
- Run #262 build memory budget: 6/6 passed.
- Settings account-switch guard: 9/9 passed.
- Profile identity snapshot source contract: 8/8 passed; runtime test: 13 assertions passed.
- Dependency lock coverage and root version: passed.
- Node runtime gate correctly rejected the local Node.js 22.16.0 runtime because the project requires Node.js ^24.15.0. The required-runtime prebuild and dependency-backed build were therefore not run locally.

## Follow-up audit of Vercel commit `cecff93` — 2026-11-17

The newer Vercel log is from `testnet` commit `cecff93b5995a10665bb893fa6f70826a6830533`, not the earlier `f4ef11f` log. It confirms the same missing-CI-workflow failure and four failed Run #300 assertions. The connected GitHub write request returned HTTP 403 (`Resource not accessible by integration`), so this source candidate could not be committed to the live branch.

The commit diff also exposed unresolved merge-conflict markers in 14 release/source files, including the migration manifest, verified manifest, source-of-truth and release docs, service registry, social RPC transport, migration inventory generator and Testnet apply-order guide. The archive-derived candidate is reconciled against the authoritative 0.338.92 source and passes a strict conflict-marker scan. Replace the conflicted branch copies from the authoritative candidate; do not choose one side of the conflict by hand.

A deeper static source review found malformed Supabase RPC/REST call expressions in identity, session, step-up, WebAuthn, withdrawal PIN, messaging, membership, media authorization, cashback and ledger helpers. Repairs restore typed shared `supabaseRpc`/`supabaseRest` calls and explicit parameter objects based on the checked-in SQL function signatures. Variable RPC names are now passed as variables rather than the literal strings `'${fn}'`, `'${name}'`, etc. This matters at runtime even where the previous source parsed successfully. The repair preserves identity insert-only behavior, session revocation ordering, server-side ownership checks, message membership checks and the non-spending membership orphan-recovery boundary.

The static RLS coverage checker now recognizes the reviewed Research/Field/Evidence migration's explicit `FOREACH` table list only when the same loop enables RLS, revokes PUBLIC/anon/authenticated access and grants service_role. The SECURITY DEFINER source checker now recognizes valid name-level PUBLIC revokes where PostgreSQL migration SQL intentionally omits an argument signature. This is source-analysis coverage only, not live database policy proof.

Additional local checks now pass: Run #250 identity integrity 10/10; database RLS source coverage 174 table names; SECURITY DEFINER source audit 481 declarations; migration source manifest 229/229; Run #300 20/20; Run #301 20/20; project truth 11/11; Vercel hygiene 17/17; Phase 4 identity snapshot 8/8 and 13 runtime assertions. TypeScript syntax parsing reports no TS1005/TS1136/TS1128/TS1472/TS1109 syntax diagnostics after repairs.

The full dependency-backed typecheck, lint and Next build remain unverified because this environment has no installed `node_modules` and cannot complete a registry-connected Node 24 clean install. A local global `tsc` invocation without project dependencies reports expected missing React/Next/Node package types and is not a valid substitute for the required clean build. npm's 22 reported vulnerabilities and the package deprecation warnings remain unresolved pending a current registry-connected audit and tested lockfile regeneration.

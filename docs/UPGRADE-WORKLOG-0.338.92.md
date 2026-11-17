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
<<<<<<< Updated upstream
=======


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

- Run #300 release integrity: 20/20 passed.
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
>>>>>>> Stashed changes

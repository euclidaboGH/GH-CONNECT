# GreenHaven source authority — 0.338.92 (2026-11-17)

**Current source version:** `0.338.92`
**SHA-256:** `90cb8260f2b5a7fdf345135c636c250b591eb4a0be625d86b61eae988e12b578`  
**Authoritative archive:** `GREENHAVEN-0.338.92-TESTNET-QUARANTINE-ENV-PREP-2026-11-17-1.zip`  
**Package identity:** `gh-connect@0.338.92` (user-facing brand: GREENHAVEN).

This is the exact archive supplied by the user on 2026-11-17 and is the sole authoritative source for subsequent work. Its project history identifies it as an in-place derivative of the prior 0.338.90 source. Continue in place; use the existing GitHub repository and Vercel project. Preserve existing hidden CI files from the actual repository because the supplied archive omits `.github/workflows/ci.yml` and `.gitignore`.

## Latest implementation

Public respondent and field-session scoped evidence uploads are implemented in source, with signed upload URLs, project/report-bound tokens, streamed SHA-256, file signature checks, quarantine-first storage records, central admin review UI, scanner queue/HMAC callback contract, active geographic-unit validation and append-only SHA-256 evidence event chains. The scanner provider itself is not deployed or configured, so uploads remain quarantined until an external trusted scanner is connected and reports clean. Do not claim malware scanning is operational.

## Held migrations

`20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql` and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` are REVIEW_REQUIRED and unapplied. They must be applied in dependency order after target migration-history reconciliation and schema validation. Testnet's earlier Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Release controls

No push or deployment was performed. Full Node 24.15.0 install/typecheck/lint/build, browser/device acceptance, scanner integration, live Testnet upload/hash/chain verification and populated geographic hierarchy checks remain required. Production NOT APPROVED.

## 2026-11-17 Vercel/GitHub remediation candidate

A local, unpushed remediation candidate restores the existing default-branch `.github/workflows/ci.yml` into the `testnet` source tree because the deployed `testnet` commit lacked that file and the release-integrity prebuild crashed with `ENOENT`. It also adds a root `.gitignore`, makes Run #300 report missing CI metadata cleanly, fixes its case-insensitive `NOT APPROVED` assertions, and synchronizes current release pointers in the audit/acceptance fixtures. The authoritative source archive and SHA-256 above remain the baseline from which this candidate is derived; this addendum does not claim the candidate has been pushed or deployed.

Dependency upgrades are not yet applied: the registry was unreachable, so no refreshed npm audit JSON or reproducible package-lock update could be generated. The deprecated Stellar packages remain transitive through `pi-backend@0.1.3` and must not be overridden without Pi Testnet compatibility evidence. Full Node 24.15.0 install, all 358 prebuild checks, typecheck, lint, build and browser/device acceptance remain required. Production remains NOT APPROVED.

## 2026-11-17 follow-up audit of GitHub `testnet` commit `cecff93`

The newer Vercel log is for `cecff93b5995a10665bb893fa6f70826a6830533`. It confirms the missing CI workflow on `testnet` and four failed Run #300 assertions. The commit diff additionally contains unresolved merge-conflict markers across 14 files covering the migration manifest, verified manifest, source-of-truth/release docs, service registry, social RPC transport, migration inventory generator and Testnet apply-order guide. The archive-derived candidate is clean; those branch files must be reconciled from this authoritative 0.338.92 source rather than manually choosing conflict sides.

The candidate restores the trusted read-only CI workflow and `.gitignore`, hardens Run #300, repairs malformed shared Supabase RPC/REST call sites and dynamic RPC-name interpolation, and extends source checks for conflict markers and malformed dynamic RPC names. It preserves identity immutability, server-owned media authorization, conversation membership authorization, ledger authority and non-spending membership recovery. Candidate verification: Run #300 22/22; Run #301 20/20; Run #250 10/10; RLS source coverage 174 tables; SECURITY DEFINER source audit 481 declarations; migration manifest 229/229; project truth 11/11; Vercel hygiene 17/17; Phase 4 identity snapshot 8/8 plus 13 runtime assertions; dependency-lock integrity PASS.

GitHub's connected write operation returned HTTP 403 (`Resource not accessible by integration`), so the candidate remains local and the live `testnet` branch and Vercel deployment have not been changed. Reauthorize the GitHub integration with repository Contents/commit write access or have a repository maintainer apply the candidate. Supabase inspection was read-only: Testnet has 16 live RLS/no-policy INFO findings and 120 unused-index INFO findings requiring workload-aware review; Mainnet has a SECURITY DEFINER execute-ACL warning for `public.rls_auto_enable()`. No database change was made. Mainnet and all three held migrations remain untouched.

The Vercel npm report's 22 vulnerabilities and package deprecation warnings remain unresolved pending a registry-connected Node 24 clean install, current `npm audit --json`, tested dependency/lockfile updates and full 358-check/typecheck/lint/Next build. The project remains NOT APPROVED for production.


## 2026-11-17 Quiet Premium transformation candidate — 0.338.93

The local source-only derivative is now `gh-connect@0.338.93`, based on the authoritative 0.338.92 archive above. It adds the Quiet Premium design layer for the eleven approved product priorities and a responsive, six-workstream Coming Soon development brief for all 30 unreleased ecosystem services. Registry state remains 42 services / 12 Active / 30 Coming Soon; every Coming Soon destination remains `none`. This is not a feature activation or release-readiness claim. See `docs/QUIET-PREMIUM-TRANSFORMATION-0.338.93.md`. Node 24.15.0 dependency-backed checks and browser/device visual acceptance remain outstanding. GitHub write authorization is still blocked: the connected identity exposes no accessible App installations or repositories and the earlier write returned HTTP 403. No push, deployment, Supabase mutation, migration application or Mainnet change occurred. Production remains NOT APPROVED.

The 0.338.93 candidate adds one independently registered UI regression gate to the prebuild manifest; the current manifest now enumerates 359 checks (dry-run enumeration only, not execution). The new gate verifies the eleven priority-module roots, shared theme-aware premium tokens, focus/reduced-motion support, the 30-track Coming Soon disclosure, and the unchanged 12 Active / 30 Coming Soon registry.

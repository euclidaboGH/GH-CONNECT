# GreenHaven source authority — 0.338.92 (2026-11-17)

<<<<<<< Updated upstream
**Current working candidate:** `0.338.92`  
**Authoritative archive:** `GREENHAVEN-0.338.92-SCOPED-EVIDENCE-2026-11-17.zip`  
**Package identity:** `gh-connect@0.338.92` (user-facing brand: GREENHAVEN).

This archive is an in-place derivative of the user's supplied 0.338.90 archive. Continue in place; use the existing GitHub repository and Vercel project. Preserve existing hidden CI files from the actual repository because the supplied archive omits `.github/workflows/ci.yml` and `.gitignore`.
=======
**Current source version:** `0.338.92`
**SHA-256:** `90cb8260f2b5a7fdf345135c636c250b591eb4a0be625d86b61eae988e12b578`  
**Authoritative archive:** `GREENHAVEN-0.338.92-TESTNET-QUARANTINE-ENV-PREP-2026-11-17-1.zip`  
**Package identity:** `gh-connect@0.338.92` (user-facing brand: GREENHAVEN).

This is the exact archive supplied by the user on 2026-11-17 and is the sole authoritative source for subsequent work. Its project history identifies it as an in-place derivative of the prior 0.338.90 source. Continue in place; use the existing GitHub repository and Vercel project. Preserve existing hidden CI files from the actual repository because the supplied archive omits `.github/workflows/ci.yml` and `.gitignore`.
>>>>>>> Stashed changes

## Latest implementation

Public respondent and field-session scoped evidence uploads are implemented in source, with signed upload URLs, project/report-bound tokens, streamed SHA-256, file signature checks, quarantine-first storage records, central admin review UI, scanner queue/HMAC callback contract, active geographic-unit validation and append-only SHA-256 evidence event chains. The scanner provider itself is not deployed or configured, so uploads remain quarantined until an external trusted scanner is connected and reports clean. Do not claim malware scanning is operational.

## Held migrations

`20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql` and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` are REVIEW_REQUIRED and unapplied. They must be applied in dependency order after target migration-history reconciliation and schema validation. Testnet's earlier Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Release controls

No push or deployment was performed. Full Node 24.15.0 install/typecheck/lint/build, browser/device acceptance, scanner integration, live Testnet upload/hash/chain verification and populated geographic hierarchy checks remain required. Production NOT APPROVED.
<<<<<<< Updated upstream
=======

## 2026-11-17 Vercel/GitHub remediation candidate

A local, unpushed remediation candidate restores the existing default-branch `.github/workflows/ci.yml` into the `testnet` source tree because the deployed `testnet` commit lacked that file and the release-integrity prebuild crashed with `ENOENT`. It also adds a root `.gitignore`, makes Run #300 report missing CI metadata cleanly, fixes its case-insensitive `NOT APPROVED` assertions, and synchronizes current release pointers in the audit/acceptance fixtures. The authoritative source archive and SHA-256 above remain the baseline from which this candidate is derived; this addendum does not claim the candidate has been pushed or deployed.

Dependency upgrades are not yet applied: the registry was unreachable, so no refreshed npm audit JSON or reproducible package-lock update could be generated. The deprecated Stellar packages remain transitive through `pi-backend@0.1.3` and must not be overridden without Pi Testnet compatibility evidence. Full Node 24.15.0 install, all 358 prebuild checks, typecheck, lint, build and browser/device acceptance remain required. Production remains NOT APPROVED.
>>>>>>> Stashed changes

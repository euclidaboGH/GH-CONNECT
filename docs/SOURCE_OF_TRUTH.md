# GreenHaven source authority — 0.338.92 (2026-11-17)

**Current working candidate:** `0.338.92`  
**Authoritative archive:** `GREENHAVEN-0.338.92-SCOPED-EVIDENCE-2026-11-17.zip`  
**Package identity:** `gh-connect@0.338.92` (user-facing brand: GREENHAVEN).

This archive is an in-place derivative of the user's supplied 0.338.90 archive. Continue in place; use the existing GitHub repository and Vercel project. Preserve existing hidden CI files from the actual repository because the supplied archive omits `.github/workflows/ci.yml` and `.gitignore`.

## Latest implementation

Public respondent and field-session scoped evidence uploads are implemented in source, with signed upload URLs, project/report-bound tokens, streamed SHA-256, file signature checks, quarantine-first storage records, central admin review UI, scanner queue/HMAC callback contract, active geographic-unit validation and append-only SHA-256 evidence event chains. The scanner provider itself is not deployed or configured, so uploads remain quarantined until an external trusted scanner is connected and reports clean. Do not claim malware scanning is operational.

## Held migrations

`20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql` and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` are REVIEW_REQUIRED and unapplied. They must be applied in dependency order after target migration-history reconciliation and schema validation. Testnet's earlier Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Release controls

No push or deployment was performed. Full Node 24.15.0 install/typecheck/lint/build, browser/device acceptance, scanner integration, live Testnet upload/hash/chain verification and populated geographic hierarchy checks remain required. Production NOT APPROVED.

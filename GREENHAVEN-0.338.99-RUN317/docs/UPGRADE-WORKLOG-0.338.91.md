# Upgrade worklog — GreenHaven 0.338.91

Date: 2026-11-17  
Baseline: `GREENHAVEN-0.338.90-MEDIA-EVIDENCE-2026-11-16.zip`  
Scope: complete the next source tranche of the private Media Evidence Engine.

## Implemented

1. Public respondent upload intent and completion APIs under the published research slug. Sessions are bound to one project and a random per-submission key, expire after one hour, store only a SHA-256 token digest, and accept at most five uploads per submission key. Completion uses deterministic media identity and supports safe retry after interrupted responses.
2. Direct field-agent upload intent and completion APIs. The report must have been created by the same field-session JTI; upload completion checks both report ID and JTI.
3. Reused private `gh-media` Storage, signed upload URLs, canonical owner-path validation and `gh_media_asset_create` rather than exposing Storage credentials to clients.
4. Streamed server-side SHA-256 hashing at completion, exact byte-count validation and magic-byte/MIME consistency checks for supported image, video, audio and PDF formats.
5. Public submission binds only the matching project's unbound evidence rows to the response that uses the exact submission key.
6. Added a central administrator Evidence Review Centre, server-side list/review APIs, and secure open links. Research and Field Desk evidence is accessible only after `scan_status=clean`.
7. Added scanner queue and HMAC-authenticated scan-result callback contracts. Scanner result must match the stored SHA-256. Clean scanning clears security quarantine but does not automatically mark evidence verified; human review remains separate.
8. Added optional active geographic-unit validation; election-observation uploads with a supplied unit require a `polling_unit` level. No geography dataset or GPS capture was added.
9. Added append-only evidence chain events with SHA-256 previous-hash linkage and database triggers for evidence creation, scan outcomes and review changes.
10. Updated migration inventory and source documentation; fixed the challenge participation function forward dependency by placing its definition after the referenced challenge tables.

## Database migration

`20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` depends on `20261116182000_gh_research_intelligence_platform_foundation.sql` and `20261116190000_gh_media_evidence_engine.sql`. All three are REVIEW_REQUIRED and were not applied in this source increment. Existing Testnet Field Reports and Research Studio migrations remain applied. Mainnet untouched.

## Security posture

- Public respondent session token is random 256-bit material; only its SHA-256 digest is stored.
- Field agent session JTI binds uploads to a durable report created by that session.
- No anon/authenticated database or bucket privileges are added.
- Unscanned evidence is quarantined and content delivery returns a locked response.
- Scanner callback requires `GHC_EVIDENCE_SCANNER_SECRET` (minimum 32 characters) and HMAC-SHA256 over the exact raw request body.
- The scanner is not included or configured. Without an external trusted scanner, evidence remains quarantined. Magic-byte checks are not malware scanning.
- Evidence chain hashes provide tamper-evident event linkage, not proof of original capture authenticity or legal certification.

## Verification

- Pure file signature tests: 16/16 PASS.
- Additional source contracts and existing release gates are run before packaging; exact results are recorded in the delivery report.
- Full Node 24.15.0 dependency-backed typecheck/lint/build and browser/device acceptance remain outstanding because the workspace is Node 22.16.0 and has no installed dependencies.
- Live signed uploads, scanner integration, Testnet migration application and chain postflight were not performed.

## Deployment

No GitHub push, Vercel deployment, Mainnet migration or financial-state change. Production remains NOT APPROVED.

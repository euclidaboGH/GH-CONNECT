# GreenHaven Scoped Evidence — User & Operator Guide

## Public research respondents

1. Open the published GreenHaven research link in any modern browser; no GreenHaven account is required.
2. Provide the requested answers and consent.
3. If the owner has enabled evidence uploads, attach up to five supported image, video, audio or PDF files.
4. Files upload to a private bucket through short-lived signed URLs and are associated with the current project/submission key.
5. Submit the form. The server binds the exact submission's evidence to the saved response.

A file being uploaded does not mean it is safe or verified. New files remain quarantined until a configured scanner reports a clean result. Human review is a separate step.

## Field agents

1. Unlock `/field` with a configured access code.
2. Submit a field report or survey.
3. Attach evidence to the report created in that same field session.
4. A session cannot attach files to a report created by a different session. Up to ten evidence files can be attached to one report.

Field codes do not grant GreenHaven account, wallet, or administrator access.

## Central administrator

Open `/field/admin/evidence` while signed in as the user configured in `GHC_FIELD_ADMIN_USER_ID`. The workspace shows Research and Field Desk evidence, scanner status, review status, SHA-256 digest and optional geographic-unit reference. Only security-cleared evidence can be opened or marked verified.

## Scanner operator integration

A trusted scanner worker must:

1. Poll `GET /api/internal/evidence/scan-queue` using `Authorization: Bearer <GHC_EVIDENCE_SCANNER_SECRET>`.
2. Fetch the short-lived private `downloadUrl`, scan the exact bytes, and calculate SHA-256.
3. POST `{evidenceType,evidenceId,sha256,verdict,engine}` to `/api/internal/evidence/scan-result` with `X-GH-Evidence-Signature: sha256=<hex HMAC-SHA256>` where the HMAC is computed over the exact raw JSON request body using the same secret.
4. Use `verdict` `clean`, `infected` or `error`. A clean scanner result moves the item to `scan_status=clean` but leaves `verification_status=pending` for human review.

Do not expose the scanner secret to browsers or public clients. Until a trusted scanner is configured and tested, all new uploads remain quarantined and cannot be opened.

## Geographic references

Upload intent accepts an optional `geoUnitId` only when it resolves to an active `gh_research_geo_units` record. For projects of type `election_observation`, a supplied geographic unit must have `level_key='polling_unit'`. The national Nigeria hierarchy must be imported from a verified, versioned source before this field can be used as a comprehensive polling-unit validator.

## Limits and caveats

- Up to five public evidence files per submission key.
- Existing `gh-media` bucket policy caps uploads at 50 MB; videos are further limited by the canonical media path policy.
- Supported formats are JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, QuickTime/MOV, supported audio MIME types and PDF.
- Magic-byte checks reject obvious MIME mismatches; they do not replace antivirus scanning, content disarm/reconstruction, transcoding or authenticity checks.
- SHA-256 and append-only event hashes help detect later alteration; they do not prove a photo was captured at the stated time/place.
- Migrations remain held for operator review and are not yet applied to Testnet/Mainnet.

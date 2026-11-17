# GreenHaven 0.338.90 — Media Evidence Engine worklog

## Implemented in source
- Repaired `lib/server/media/asset-store.ts`: both create and resolve operations now use the repository's canonical `supabaseRpc` helper with complete parameter payloads and strict validation. The source archive's previous implementation contained malformed RPC call syntax.
- Reused the existing authenticated signed-upload intent, direct-to-private-Storage upload and server-side completion verification flow.
- Added owner-authenticated Research evidence attach/list/review API. Attach checks project ownership, response/project relationship, and media asset ownership/readiness.
- Added owner-only Research evidence delivery through a 180-second signed URL; the evidence ID alone does not grant access.
- Added Research Inbox controls to upload image, video, audio and PDF evidence against an individual response, open evidence and mark it verified or rejected.
- Added Field Desk admin-only report evidence attach/list and authorized delivery routes. The configured `GHC_FIELD_ADMIN_USER_ID` must match the signed-in account; media must be owned by that account and ready.
- Added migration `20261116190000_gh_media_evidence_engine.sql` for `media_asset_id`, review metadata and the service-role-only `gh_field_report_evidence` join.

## Security properties
- Media bytes remain in the existing private `gh-media` bucket; this work does not create public object URLs.
- Upload intent remains authenticated and rate-limited by the existing media service.
- Upload completion verifies that the uploaded Storage object exists and matches expected byte size/MIME before creating the durable media asset.
- Research evidence attach requires an authenticated project owner and an owner-owned ready media asset.
- Research evidence delivery rechecks project ownership and uses a short-lived signed Storage URL.
- Field Desk evidence operations require the configured central admin identity.
- Evidence tables have RLS enabled and direct client table privileges revoked; service_role is the server-mediated access path.

## Explicitly not complete
- Anonymous public respondents cannot upload evidence in this increment.
- Field-agent access-code sessions cannot directly upload media in this increment.
- Malware scanning, content-disarm/reconstruction, EXIF/geolocation trust, perceptual duplicate detection, cryptographic provenance, evidence chain-of-custody attestations, retention/deletion workflows and reviewer role delegation remain outstanding.
- The field-admin attachment API is not yet integrated into a dedicated visual admin evidence-review screen.
- Migration is source-only, REVIEW_REQUIRED, and not applied to Testnet or Mainnet.

## Verification
- `scripts/check-media-evidence-engine.mjs`: 21/21 PASS.
- `scripts/generate-migration-inventory.mjs --check`: expected to pass after inventory generation.
- Full Node 24.15.0 dependency-backed typecheck/lint/build and browser/device tests were not run because this extracted workspace has no `node_modules` and runs Node 22.16.0.
- No GitHub push, Vercel deployment, Testnet migration or Mainnet change was performed.

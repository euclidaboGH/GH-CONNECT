# Media / Storage & File Lifecycle Pass

**Result:** PASS — no source defects requiring code change

## Canonical pipeline
UI → uploadDurableMedia / processMediaFile → POST /api/media → session auth → MIME/size validation → storage path `{userId}/{generated}` → createMediaAssetRecord → `{ ok, mediaId, url, path }`

## Security
- Owner always session-derived; form ownerId/path/userId voided
- Path constraint: storage_path LIKE owner_id || '/%'
- Rate limit 30/min/user
- x-upsert false (no overwrite)
- Resolve RPC: owned OR has public_url; service_role only

## Known limitations (not defects)
- No DELETE API yet — soft-delete status exists in schema
- Storage upload success + asset record failure → 503, no automatic orphan GC
- Public bucket URLs; signed private URLs deferred
- Profile avatar/cover may use data URL fallback when storage unavailable

## Migrations
54 unchanged. Phase 15 NOT STARTED.

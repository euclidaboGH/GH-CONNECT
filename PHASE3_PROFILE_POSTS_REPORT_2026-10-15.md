# GreenHaven Phase 3 — Profile & Posts

## Scope
Production hardening of profile identity/media and post create/edit contracts. No wallet, reward, membership, Pi-payment, escrow, or marketplace economy logic changed.

## Fixed
1. Post creation display identity is now server-derived from the authenticated GreenHaven profile. Client-supplied `authorName` / `authorPhoto` can no longer impersonate another presentation identity.
2. Profile serialization now prevents extensible `profilePayload` data from shadowing canonical server-owned identity/profile fields.
3. Profile image selection now accepts source images up to 25 MB and compresses them using the existing purpose-aware image pipeline before the Vercel media proxy upload.
4. Avatar and cover images use separate compression presets; the compressed output is used for durable upload and offline fallback rather than retaining the original oversized file.
5. Post edit API now validates and persists the image/video edits already sent by the shared Phase 1 edit contract. Previously the client sent media edits but the server silently persisted content only.
6. Edit media rejects `blob:` references, oversized inline media, invalid URL schemes, and more than 10 images before touching the durable post row.
7. Existing server-side post ownership enforcement remains authoritative: only the authenticated post owner can edit the durable row.

## Verification
- `node scripts/check-jsx-safety.mjs`: PASS — 613 files scanned.
- Source-level contract review completed for profile store, profile upload, post create, and post edit paths.
- Full Next.js build was not claimed in this runner: the extracted project has no `node_modules`, and the runner Node version is 22.16.0 while this project has previously required a newer runtime/package combination. Vercel remains the authoritative clean build environment.

## Deployment notes
- No new database migration is required for Phase 3.
- Phase 2 stable feed cursor migration remains additive and should still be applied according to its deployment notes.
- Profile media still uses the existing `/api/media` proxy ceiling; compression keeps normal avatar/cover output below that ceiling. Direct/resumable upload remains a future enhancement for large non-image media.

## Next
Phase 4: Comments & Social Interactions — cursor pagination, reply-recipient notification correctness, batched mention resolution, reaction/curation consistency, and optimistic-state reconciliation.

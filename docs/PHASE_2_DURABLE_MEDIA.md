# Phase 2 — Durable media pipeline

## Goals
- Photos/videos/files used in posts and moments resolve after reload and for other users
- Never publish `blob:` URLs
- Compress → upload to `/api/media` → store durable URL only
- Clear progress and failure copy

## Changes
- `lib/media/durable-url.ts` — `isDurableMediaUrl`, `filterDurableUrls`
- `unified-compose.tsx` — reject blob on publish; feed path requires durable (or tiny offline fallback with explicit toast)
- Story path: no blob publish; durable preferred
- `MEDIA_PROGRESS` keys complete (preparingPhoto, compressing, uploading, ready, video/file)

## Non-goals
- Changing storage backend schema
- Inventing media when upload fails
- Raising server size limits beyond existing API policy

# Media display fix 0.73.1

## Problem (from live recording)
Uploads reported success (Profile photo updated, Cover photo updated, Photo ready, story live)
but UI showed grey avatars, solid green cover, black story preview, and empty PHOTO frames on posts.

## Root cause
Private-bucket media is delivered only via `/api/media/{id}/content` (auth → short-lived signed URL).
Raw `<img src="/api/media/.../content">` often fails in Pi Browser / mobile WebViews (session cookie + 302 to Supabase).
Cover used a plain `<img>` that hid on error. Story/post media had the same failure mode.

## Fix
1. `lib/media/resolve-display-url.ts` — client resolves facade IDs via `GET /api/media/:id/signed-url` with credentials; caches signed URLs.
2. `LazyImage` — always resolves facade URLs before painting.
3. Profile cover — switched from bare `<img>` to `LazyImage`.
4. `DurableVideo` — same resolution for post/story video.
5. Upload client + profile/story writers — store **relative** `/api/media/{id}/content` (deployment-stable).
6. Story creator — keeps `localPreview` (compressed data URL) for the preview pane while durable URL is used for publish.

## Unchanged
Ledger, RLS, private bucket policy, authorize_viewer (owner always allowed).

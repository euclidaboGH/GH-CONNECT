# GreenHaven private media bucket

## Operator setup (Supabase)

1. Create a **private** bucket named to match `GH_MEDIA_BUCKET` (default `gh-media`).
2. File size limit: **50 MB**.
3. Folders are path prefixes (created automatically on upload):
   - `avatars/` — profile photo & cover
   - `images/` — post / story / comment images
   - `videos/` — post / story / DM video
   - `audio/` — voice / audio attachments
   - `documents/` — PDF attachments
4. Full object path: `{ghUserId}/{folder}/{uuid}.{ext}`

## Vercel env (server)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `GH_MEDIA_BUCKET=gh-media` (or your bucket name)

Do **not** rely on a public bucket. The app never stores public object URLs for new uploads.

## Delivery model

1. Client uploads via `/api/media` (small) or **direct-to-storage** (large).
2. Server writes a row in `gh_media_assets` and returns  
   `/api/media/{mediaId}/content`.
3. Browser loads that same-origin URL (session cookie).
4. Server runs `gh_media_authorize_viewer`, then redirects to a **short-lived signed** Supabase URL.

## Migrations required

- `20261001_gh_media_assets.sql`
- `202610190002_gh_private_media_references_and_viewer_authz.sql`
- `202610200002_gh_comment_media_attachments.sql` (comment media)
- Messaging attachments meta migration when using DM media

## Verify

While signed in, open `/api/media/health` and confirm:

- `authenticated: true`
- `storageConfigured: true`
- `bucketReachable: true`
- `ready: true`
- `bucketPublic: false` (expected for private)

## Surfaces covered

Profile avatar/cover · posts · stories · comments · DMs · marketplace listing images (when wired) · community posts using the shared compose/upload client.

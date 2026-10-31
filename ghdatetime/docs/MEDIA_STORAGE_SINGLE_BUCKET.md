# Media storage: one bucket

GreenHaven uses **one** Supabase Storage bucket: `gh-media` (env `GH_MEDIA_BUCKET`).

Do **not** create separate buckets for avatars / images / videos / documents / audio.

Organize by **path prefix** inside `gh-media`:

- `{userId}/avatars/...`
- `{userId}/images/...`
- `{userId}/videos/...`
- `{userId}/documents/...`
- `{userId}/audio/...`

`gh_media_assets.media_kind` + `category` on upload intent already classify objects.
Public display always goes through `/api/media/{id}/content` or signed-url after authorization.

## Why posts show “Media unavailable”

1. Object missing in `gh-media` or asset row not `status=ready`
2. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GH_MEDIA_BUCKET` misconfigured on Vercel
3. Signed-url auth failed (session cookie / Pi token)
4. Legacy post rows still hold `blob:` / dead external URLs (client filters blob; dead https still attempt load)

Operator check: open `/api/media/health` while signed in.

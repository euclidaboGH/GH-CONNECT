# Media storage operator checklist

Uploads fail with **MEDIA_STORAGE_UNAVAILABLE** until Supabase Storage is configured on Vercel.

## Required environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side storage writes (never expose to client) |
| `GH_MEDIA_BUCKET` | Bucket name (default `gh-media`) |

## Bucket setup (Supabase Dashboard → Storage)

1. Create a **private** bucket named `gh-media` (or match `GH_MEDIA_BUCKET`).
2. Allow service-role uploads (service role bypasses RLS).
3. Optional: public read policy only if you serve public CDN URLs.

## Verify

While signed in on the app, open:

`https://<your-host>/api/media/health`

Expect:

- `authenticated: true`
- `storageConfigured: true`
- `bucketReachable: true`

## Client behaviour without storage

- Profile / cover: compressed image kept as **device-local** data URL (not visible on other devices).
- Post / story photos: same local fallback when under size cap.
- Video / large files: still require durable storage.
- DMs: text works; media attachments need storage.

## Messaging membership

Community chat membership is healed on send. Creators should be able to message after join/create even if the first create missed a messaging membership row.

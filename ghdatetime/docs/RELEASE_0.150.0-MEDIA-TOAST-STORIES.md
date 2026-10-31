# 0.150.0 — Media reliability, toasts, stories

## Fixes from live video review
- Toasts sit **above** bottom nav (no longer under the tab bar)
- **Stories rail restored on Home/Feed** (`ProfileStorySection scope=feed`)
- Media facade id matcher accepts broader ids
- Signed-url failure falls back to same-origin `/api/media/{id}/content`
- LazyImage retries + clears signed cache
- Profile photo history accepts `/api/media` facade URLs (not https-only)
- Download copy clarified when share sheet is the path

## Storage answer
Single bucket `gh-media` with path prefixes — not separate buckets per type.

## Still operator-dependent
If `/api/media/health` reports bucket unreachable, images will stay unavailable until env + bucket + migrations are correct on Vercel/Supabase.

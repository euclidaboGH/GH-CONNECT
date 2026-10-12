# Media upload relaxation (2026-10-12)

## Problem
Compose rejected common mobile photos/videos (strict MIME, low size caps, client 40 MB video vs server 80 MB, storage failures labeled “too large”).

## Changes
| Area | Before | After |
|------|--------|--------|
| Image input | 25 MB, jpeg/png/webp/gif | **50 MB**, + bmp/avif/heic/heif, extension fallback |
| Video input | **40 MB** client / 80 MB server | **100 MB** aligned client+server |
| PDF | 8 MB | **15 MB** |
| Validation | throw on odd MIME | **soft** accept + extension/normalize |
| Multi-photo | one bad file could fail batch | **skip bad, keep good** |
| Compress | 25 MB max in, quality ~0.82 | **50 MB** in, feed quality **0.88**, 1600px edge |
| Errors | storage fail → “too large” | accurate **storage / network** copy |

## Still true (safety)
- Not unlimited upload size (DoS protection).
- Videos still need configured Supabase media bucket for durable upload.
- HEIC may fail decode on some browsers — user is guided to JPG/PNG re-export.
- Server still sniffs magic bytes; does not trust client MIME alone.

## Operator
Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GH_MEDIA_BUCKET` (default `gh-media`) for durable video/photo storage.

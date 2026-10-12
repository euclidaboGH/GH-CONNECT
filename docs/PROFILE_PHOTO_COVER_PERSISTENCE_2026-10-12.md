# Profile photo & cover persistence (2026-10-12)

## Problem
Avatar and cover disappeared after logout/login.

## Root causes
1. Server `coverPhoto` was **clipped to 2000 characters** — compressed `data:image/...` values are far larger, so covers were effectively wiped on persist.
2. Profile gallery used **raw FileReader data URLs** without compress/durable upload.
3. Logout reset in-memory profile; restore depended on server, which had lost media.

## Fixes
| Area | Change |
|------|--------|
| `profile-store` | `clipMediaRef` allows long `data:image` + https media URLs (up to ~900KB) |
| `lib/profile-media.ts` | Compress avatar/cover; prefer `/api/media` durable URL |
| Profile screen | Optimize + save via `prepareProfilePhoto` |
| `lib/profile-photo-cache.ts` | User-keyed local cache survives logout on same device |
| updateProfile / logout / hydrate / Pi login | Save and merge cache when server media empty |

## Operator
Configure media storage (`GH_MEDIA_BUCKET`) so photos become durable https URLs across devices. Device cache covers same-browser re-login when storage is missing.

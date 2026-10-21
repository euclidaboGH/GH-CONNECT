# GH Media — Phase 8 Durable Infrastructure

**Status:** Source foundation  
**Product:** GreenHaven  

## Architecture

```
Authenticated user
  → client compress (images)
  → POST /api/media (multipart) when storage configured
  → Supabase Storage path: {category}/{userId}/{object}
  → gh_media_assets record
  → POST /api/social/posts with mediaIds[] and/or https/data URLs
  → gh_posts (unchanged authority)
```

Fallback (no storage): client compress → `data:image` on post create (Phase 7 path).

## Table

`gh_media_assets`

- `owner_id` session-derived  
- `storage_path` must use `{category}/{owner_id}/{object}` with category allowlisted to `audio`, `documents`, `avatars`, `images`, or `videos`  
- `media_kind`: image | video | file (audio is recorded as file with its MIME type)  
- RLS deny-all; RPCs `service_role` only  

Migration: `supabase/migrations/20261001_gh_media_assets.sql`

## Bucket

| Setting | Value |
|---------|--------|
| Env | `GH_MEDIA_BUCKET` (default `gh-media`) |
| Paths | `avatars/{userId}/`, `images/{userId}/`, `videos/{userId}/`, `audio/{userId}/`, `documents/{userId}/` |
| Access | Private bucket; server authorization and application media delivery facade |

Operator must create the bucket in Supabase Storage and set policies. Application code does not grant public RLS on the DB table.

## Validation

| Kind | MIME | Max size |
|------|------|----------|
| Avatar | image/jpeg, image/png, image/webp, image/gif, image/avif | 25 MB maximum (avatar UI compresses images) |
| Image | image/jpeg, image/png, image/webp, image/gif, image/avif | 25 MB |
| Video | video/mp4, video/webm, video/quicktime | 40 MB |
| Audio | audio/mpeg, audio/mp4, audio/aac, audio/ogg, audio/wav, audio/webm, audio/flac | 25 MB |
| PDF documents | application/pdf | 25 MB |

Rejected: blob URLs as durable refs, client owner/path, unsupported types.

## Video

- Durable upload + asset record supported when storage is configured  
- **Transcoding deferred** — original file stored as-is  
- Duration optional metadata from client (non-authoritative beyond recording)

## Access

- `GET /api/media?ids=` resolves assets for session actor (owned or public_url present)  
- Private signed URL generation: `/api/media/[id]/signed-url`; viewer authorization must be verified before release  

## Cleanup

Orphan uploads (media without post) require a future worker — **deferred**. Contract: soft-delete via `deleted_at` / status `deleted`.

## Environment

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GH_MEDIA_BUCKET=gh-media
```

No secrets in client bundles.

## Economy

**Zero** GHC / Pi / reputation / tip settlement from media routes.

## Related

- Phase 7: `docs/GH_PUBLISHING.md`  
- Posts: `gh_posts` remains post authority  


## Profile content library (2026-10-14)

The profile library surfaces the signed-in owner's posts and media, and gives viewers a paginated search of content that the server authorizes for their relationship to that profile. It groups Posts, Photos, Videos, Documents and Profile history. It does not make a private post public.

- API: `GET /api/social/profile/:userId/posts`
- RPC migration: `supabase/migrations/20261023_gh_profile_content_library.sql`
- The API derives the viewer from the authenticated session, rate-limits requests, and calls a service-role-only RPC.
- The RPC excludes deleted/archived posts, suppresses blocked profiles, and applies public/follower/mutual/owner visibility before returning media references. Search includes post text and PDF titles; pagination uses a timestamp + post ID cursor.
- Profile and cover photo history is bounded to 24 prior durable HTTPS references and stored in the non-financial profile payload. Legacy inline data URLs are not copied into history to avoid bloating profile records.
- Apply the migration on Testnet before enabling the library in a deployed environment.

### Document publishing presentation

PDF cards use the post's `pdfName` as title, post author as author attribution, post text as description, and post timestamp as publication date. The existing post visibility setting governs whether the API lists that document for a viewer. The first version does not introduce separate intellectual-property licensing or sales contracts.

### Storage/privacy release gate

Keep `gh-media` private. Do not enable public object URLs. Use the server-authorized media delivery facade and viewer-authorized signed-URL route; verify message/story/profile consumers and privacy behavior in Testnet before release. UI/API post-visibility filtering alone is not a substitute for storage-level authorization. Publicly published PDFs should be intentionally public and rights-cleared.

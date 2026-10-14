# GH Media — Phase 8 Durable Infrastructure

**Status:** Source foundation  
**Product:** GreenHaven  

## Architecture

```
Authenticated user
  → client compress (images)
  → POST /api/media (multipart) when storage configured
  → Supabase Storage path: {userId}/{object}
  → gh_media_assets record
  → POST /api/social/posts with mediaIds[] and/or https/data URLs
  → gh_posts (unchanged authority)
```

Fallback (no storage): client compress → `data:image` on post create (Phase 7 path).

## Table

`gh_media_assets`

- `owner_id` session-derived  
- `storage_path` must start with `{owner_id}/`  
- `media_kind`: image | video | file  
- RLS deny-all; RPCs `service_role` only  

Migration: `supabase/migrations/20261001_gh_media_assets.sql`

## Bucket

| Setting | Value |
|---------|--------|
| Env | `GH_MEDIA_BUCKET` (default `gh-media`) |
| Path | `{authenticatedUserId}/{filename}` |
| Access | Prefer private + signed URLs (signed access **deferred** if bucket public is not desired) |

Operator must create the bucket in Supabase Storage and set policies. Application code does not grant public RLS on the DB table.

## Validation

| Kind | MIME | Max size |
|------|------|----------|
| Image | jpeg, png, webp, gif | 25 MB |
| Video | mp4, webm, quicktime | 80 MB |
| PDF documents | application/pdf | 8 MB |

Rejected: blob URLs as durable refs, client owner/path, unsupported types.

## Video

- Durable upload + asset record supported when storage is configured  
- **Transcoding deferred** — original file stored as-is  
- Duration optional metadata from client (non-authoritative beyond recording)

## Access

- `GET /api/media?ids=` resolves assets for session actor (owned or public_url present)  
- Private signed URL generation: **deferred**  

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

The existing `/api/media` implementation currently emits public-object URLs and the media documentation notes signed/private delivery is deferred. UI/API post-visibility filtering is not sufficient to prevent direct access to an already-public storage URL. Before accepting confidential or rights-restricted documents, configure a private bucket and implement authorized signed delivery (including message/story/profile media); do not treat this UI feature as a substitute for storage-level authorization. Publicly published PDFs should be intentionally public and rights-cleared.

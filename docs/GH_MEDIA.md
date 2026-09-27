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

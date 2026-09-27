# GH Publishing + Media — Phase 7

**Status:** Source implementation  
**Product:** GreenHaven  

## Authoritative post model

Table: `gh_posts` (existing)

- Text, `images` (jsonb), `video`, optional pdf  
- `content_type`: `standard` | `status` (short text)  
- Author = session only via `POST /api/social/posts`  
- Same records for Home feed, profile timeline, Creator Studio  

## Create flow

1. Compose UI selects photos/video  
2. **Images always compressed** client-side (`compressImageFile`, purpose `feed`, max edge 1280)  
3. Input size up to **25 MB** before compress  
4. `createPost` → domain → `socialCreatePost` → `gh_post_create` RPC  

## Media security

| Allowed on create | Rejected |
|-------------------|----------|
| `data:image/*` (bounded size) | `blob:` |
| `https://` image/video URLs | Arbitrary paths |
| Session author | Client `authorId` |

`POST /api/media`:

- Multipart image upload when Supabase storage + `GH_MEDIA_BUCKET` configured  
- Otherwise **501** with guidance to use client compress + data URLs  
- Object path: `{userId}/…` — cannot claim another user's prefix  

## Profile

Existing profile hero + photos + reputation + Creator Studio entry.  
No duplicate profile system. Bottom nav unchanged.

## Not in this phase

- Server-side video transcoding  
- Signed private media URLs (deferred)  
- GHC/Pi rewards for posting  
- Parallel post store  

## Migration

No new migration required — uses existing `gh_posts`.

# Phase 1 — Trust breakers (media, errors, Discover copy)

**Baseline:** `GREENHAVEN-0.312.0-PHASE-5-RELEASE-READINESS-2026-11-04.zip`  
**Date:** 4 November 2026  

## Root cause (story `INVALID_MEDIA_URL`)

Upload client stores durable **relative** facade URLs: `/api/media/{id}/content`.

`POST /api/social/stories` `safeStoryMediaUrl()` previously accepted only:

- `https://…` absolute URLs  
- small `data:image/…`  

Relative facade paths were rejected → client toast showed raw **`INVALID_MEDIA_URL`**.

## Fixes

1. Accept `/api/media/{id}/content` in `safeStoryMediaUrl`  
2. `mediaUserMessage` maps `INVALID_MEDIA_URL`, `EMPTY_STORY`, `STORY_TOO_LONG`, etc.  
3. Story Share disabled while upload in progress or `blob:` URL  
4. Audience chip: `whitespace-nowrap` + truncate so “Followers” does not split  
5. Upload overlay: photo vs video copy + aria live  
6. Publish path humanizes machine codes via `mediaUserMessage`  
7. Social `json()` prefers non-CODE `message` body when present  
8. Discover count: “1 person · match suggestion(s)”  

## Verify

```bash
node scripts/check-phase1-trust-breakers-media-2026-11-04.mjs
```

## Operator Testnet

1. Create story from gallery → wait until “Photo ready”  
2. Share story → must succeed or show human error (never `INVALID_MEDIA_URL`)  
3. Discover with 1 candidate → “1 person”  

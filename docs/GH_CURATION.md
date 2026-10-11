# GH Curation — Phase 3

**Status:** Implemented (source); runtime E2E pending Testnet  
**Product:** GreenHaven  

## Purpose

Durable **upvote / downvote / neutral** as a **content-quality signal**.

## Not in scope

- GHC rewards, tips, creator pools  
- Curation Power weighting  
- Reputation levels  
- Ranking algorithms  
- Pi Ads  

## Rules

- One active choice per `(post_id, user_id)`  
- Choices: `upvote` | `downvote` | `neutral`  
- Toggle same choice → neutral  
- Switch upvote ↔ downvote is atomic  
- Actor = session only  
- Visibility + block checks (same pattern as attention)  
- Likes / reactions remain independent  

## Storage

- `gh_post_curations` — PK `(post_id, user_id)`, `choice`  
- `gh_posts.upvote_count` / `downvote_count` — denormalized  

## API

`POST /api/social/posts/[id]/curation`  
Body: `{ "choice": "upvote" | "downvote" | "neutral" }`  

## Migration

`supabase/migrations/20260928_gh_post_curation.sql`

## Content vs profile engagement

- **Upvote / downvote** apply to **posts** (content quality, ranking, server-side reward eligibility).
- **Like / Pass** apply to **profiles** (matching). See `docs/ENGAGEMENT_MODEL_CONTENT_VS_PROFILE.md`.
- Client votes never mint GHC.

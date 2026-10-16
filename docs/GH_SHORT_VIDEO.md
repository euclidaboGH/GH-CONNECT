# GH Short Video — Phase 9 Foundation

**Internal label:** Short Video (not a permanent brand)

## Model

Uses existing **`gh_posts`** with durable `video` URL (Phase 8 media or https/data).

- `contentType`: `short_video` when video-only on create
- Same post IDs for Attention, Curation, Creator Studio, Profile

## APIs

| Route | Role |
|-------|------|
| `GET /api/social/short-video` | Chronological posts with video (visibility via feed RPC) |
| `POST /api/social/posts` | Sets `short_video` when video primary |
| Existing attention | view / qualified_view / complete from player |

## Player

`components/ghc/short-video-screen.tsx`

- Vertical, one active video
- Play/pause, mute (default muted for autoplay policy)
- Prev/next
- Open via window event `ghc:open-short-video` (no new bottom-nav tab)

## Explicit non-goals

- Algorithmic ranking / "trending"
- GHC, Pi, tips settlement, ads rewards
- Transcoding
- Duplicate engagement tables

## Security

- Author from session on create
- Feed respects existing visibility/block rules in `gh_post_list_feed`
- blob: videos excluded from short-video surface

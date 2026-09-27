# GH Search & Discovery — Phase 12

**Discovery only — not recommendation.**

## Architecture

```
Client query (q, category, limit)
  → GET /api/social/search
  → session actor
  → RPCs: gh_search_people | gh_search_posts | gh_search_creators
  → existing tables only
```

## Categories

| Category | Authority |
|----------|-----------|
| People | `gh_user_profiles` |
| Posts | `gh_posts` (non-deleted, visibility + blocks) |
| Videos | Same posts with durable video |
| Creators | `gh_creator_profiles` (`is_enabled`) |
| All | Union of the above |

## Ordering

Chronological / updated_at — **no** AI, For You, trending, reputation, GHC, tips, or ads ranking.

## Security

- Parameterized ILIKE with escaped wildcards  
- Query length 2–80  
- Limit ≤ 40  
- Rate limited  
- Block bidirectional exclusion  
- No email/wallet/secrets in results  
- Follow status server-derived  

## UI

Existing `GlobalSearchModal` prefers durable server people results when available; local candidate search remains fallback.

## Migration

`supabase/migrations/20261004_gh_search.sql`

## Deferred

Full-text / trigram extensions, marketplace catalog search extension, external search engines.

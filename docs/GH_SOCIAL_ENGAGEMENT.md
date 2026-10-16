# GH Social Engagement — Phase 13

## Reused authorities

| Capability | Authority |
|------------|-----------|
| Reactions | `gh_reaction_toggle` + Phase 11 like notify |
| Comments / replies | `gh_comment_create` + notify author |
| Saves | `gh_save_toggle` |
| Shares | `gh_post_shares` + `gh_post_share` (edge only) |
| Mentions | Server parse `@username` → profile resolve → `mention` notify |
| Notifications | `gh_social_notifications` |
| Curation | Phase 3 (unchanged) |

## Share model

Does **not** copy post content or media.  
Stores `(sharer_id, post_id)` and updates `share_count` on original `gh_posts`.

## Rate limits (server)

| Action | Limit |
|--------|-------|
| Reaction | 60 / min |
| Comment | 40 / min |
| Save | 40 / min |
| Share | 30 / min |

These are **process-local** burst guards (`lib/server/economy/rate-limit.ts` in-memory Map).
They reduce double-submit and farming on a single Node/Vercel instance.
They are **not** a globally distributed quota across all instances.
Authoritative integrity remains the database (unique share edges, notification dedupe, RLS).
Edge/WAF or Redis-backed limits are a future production hardening step — not a Phase 13 redesign.

## Isolation

No GHC / Pi / membership / tip / ad mutations from engagement paths.

## Deferred

Push notifications, full mention entity table, quote-repost composer UI polish, Curation Power.

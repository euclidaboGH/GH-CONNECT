# GH Reputation — Phase 4

**Status:** Foundation implemented (source)  
**Product:** GreenHaven  

## Purpose

Durable **trust / participation quality** signal with **15 deterministic levels**.

Reputation in this phase is **informational only**.

## Explicit exclusions

Does **not** affect or connect to:

- GHC balances, spends, credits, withdrawals  
- Pi payments or ads rewards  
- Curation Power or ranking boosts  
- Tips, creator pools, membership entitlements  
- Marketplace financial settlement  

## Architecture

| Layer | Object | Role |
|-------|--------|------|
| **Event** | `gh_reputation_events` | Auditable inputs; unique `(user_id, idempotency_key)` |
| **Current state** | `gh_reputation_state` | **Authoritative** total_points + level |
| **Snapshot** | `gh_reputation_snapshots` | History after each applied event |

Rebuild path: re-sum events into state (privileged; not exposed to clients in this phase).

## 15 levels (canonical)

Source: `lib/social-economy/reputation-levels.ts`  
SQL mirror: `gh_reputation_level_from_points`

| Level | Name | Min points | Haven gate |
|------:|------|------------|:----------:|
| 1 | Seed | 0 | |
| 2 | Sprout | 25 | |
| 3 | Root | 75 | |
| 4 | Branch | 150 | |
| 5 | Canopy | 300 | |
| 6 | Grove | 500 | |
| 7 | Haven | 800 | ✓ |
| 8 | Steward | 1200 | ✓ |
| 9 | Artisan | 1800 | ✓ |
| 10 | Mentor | 2500 | ✓ |
| 11 | Beacon | 3500 | ✓ |
| 12 | Pillar | 5000 | ✓ |
| 13 | Architect | 7000 | ✓ |
| 14 | Guardian | 10000 | ✓ |
| 15 | Legend | 15000 | ✓ |

## Event catalog (server points only)

| Event type | Points | Client POST | Server proof |
|------------|-------:|-------------|--------------|
| `profile_complete` | 25 | Yes (once) | `gh_user_profiles.onboarded` + `display_name` |
| `first_post` | 15 | Yes (once) | ≥1 non-deleted `gh_posts` by author |
| `community_join` | 10 | **No** | Future membership hook |
| `marketplace_order_complete` | 20 | **No** | Future order-settled hook |
| `report_resolved_helpful` | 5 | **No** | Future moderation |
| `manual_adjustment_credit` | n/a | **No** | Privileged only |

Idempotency for client-awardable events is **server-forced**:
- `profile_complete:{userId}`
- `first_post:{userId}`

Client-supplied idempotency keys cannot farm multiple awards for these actions.

**Not** reputation events: Phase 2 attention, Phase 3 curation votes, likes, raw clicks.

## Security

- RLS deny-all on all reputation tables  
- RPCs: `REVOKE PUBLIC`, `GRANT service_role`  
- `SECURITY DEFINER` + `SET search_path = public`  
- Session actor only; client cannot set `userId` or `points`  
- Event type alone is **not** proof — verify path required  
- Advisory lock per user on apply  

## API

- `GET /api/social/reputation` — own state + progress  
- `POST /api/social/reputation` — only `profile_complete` / `first_post` after proof  

## Migration

`supabase/migrations/20260929_gh_reputation.sql`

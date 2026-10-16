# GH Creator Studio + Tips — Phase 5

**Status:** Foundation (source)  
**Product:** GreenHaven  

## Purpose

Durable **Creator Studio** identity, own-content management surface, attention-based insights, and **tip intents** without unsafe financial settlement.

## Explicit financial boundary

| Allowed this phase | Forbidden / deferred |
|--------------------|----------------------|
| Creator profile enable/settings | GHC ledger credits/debits |
| List own posts + counters | Pi tip completion |
| Tip **intent** records | Wallet balance changes |
| Display reputation (read-only) | Fake “earnings” or completed tips |

**Settlement status: DEFERRED.**  
An intent with `status=initiated` is **not** a completed tip.

## Creator model

Table: `gh_creator_profiles`

- Independent of reputation level  
- `is_enabled`, `tips_enabled`, display fields  
- Session user can only upsert **self**  

## Creator Studio

- `GET /api/social/creator` — profile + own posts + reputation display  
- `POST /api/social/creator` — enable/update own creator settings  
- Content is existing `gh_posts` filtered by `author_id = session user`  

## Analytics

Reuses Phase 2 counters on posts (`view_count`, `qualified_view_count`, etc.).  
No second event pipeline. No rewards from insights.

## Tip lifecycle

```
INTENT (this phase) → PAYMENT (existing Pi/GHC — not wired) → SETTLEMENT (deferred) → RECORD settled
```

- `POST /api/social/tips` creates intent only  
- Recipient from post author when `contentId` set  
- Self-tip forbidden  
- Recipient must have `tips_enabled`  
- Response always `completed: false`, `settlement: "deferred"`  

## Security

- RLS deny-all on creator + tip tables  
- RPCs service_role only, `search_path = public`  
- No client-supplied tip settlement  
- No balance mutation in tip path  

## Migration

`supabase/migrations/202609300001_gh_creator_studio.sql`

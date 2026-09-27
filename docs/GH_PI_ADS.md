# GH Pi Ads — Phase 6 Foundation

**Status:** Source foundation (fail-closed)  
**Product:** GreenHaven  

## Principle

```
CLIENT EVENT  ≠  VERIFICATION
VERIFICATION  ≠  REWARD
REWARD AUTH   ≠  SETTLEMENT
```

A client impression, timer, or callback **never** creates GHC, Pi, wallet credit, or reputation.

## Architecture

| Stage | Meaning |
|-------|---------|
| Ad request / show | Client capability probe (`lib/ads/pi-ads-adapter.ts`) |
| Client signal | `POST /api/ads/verify` with `adId` (untrusted) |
| Verification | Server must call Pi platform API ( **not implemented** ) |
| Reward authorization | Only after provider verification — **blocked this phase** |
| Settlement | Existing economy path only — **not connected** |

## Existing code reused

- `lib/ads/pi-ads-adapter.ts` — capability + client submit helper  
- `app/api/ads/verify/route.ts` — hardened fail-closed gate  
- `GH_ADS_ENABLED` env flag  

## Durable log

Table: `gh_ad_verification_events`

- Records attempts with `provider_verified=false`, `reward_authorized=false`  
- Unique `(user_id, idempotency_key)` and verified `(user_id, ad_id)`  
- Constraint: reward requires provider_verified  
- RPC forces status away from `verified` in this migration generation  

## Trust boundary

| Client may send | Server ignores / overrides |
|-----------------|----------------------------|
| `adId` | treated as request only |
| `placement` | constrained allowlist |
| `userId` | **ignored** — session actor |
| `rewardAmount` / `verified` | **ignored** |

Idempotency key: `ad_verify:{userId}:{adId}` (server-forced).

## Economy isolation

**No** calls to GHC ledger, Pi payment complete, wallet, tips, reputation, or membership from the ads path.

## Runtime requirements (deferred)

- Pi Developer Portal ad network approval  
- `GH_ADS_ENABLED=true` only after real provider verify  
- Server credentials for Pi ad verification API  
- Explicit product rule connecting verified ads → economy stream C  

## Migration

`supabase/migrations/20260930_gh_ad_verification.sql`

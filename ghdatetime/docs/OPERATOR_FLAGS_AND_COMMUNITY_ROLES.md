# Operator flags · community roles · media health

## Media health 404

`DEPLOYMENT_NOT_FOUND` means Vercel could not find an active deployment for that URL — not that the route is missing in source.

1. Redeploy the latest package to your Vercel project.
2. While signed in, open `/api/media/health` or `/api/health/media`.
3. Expect `storageConfigured: true` only after Supabase URL + service role + `GH_MEDIA_BUCKET` are set.

## Mission GHC credits

```
GHC_ACTIVITY_REWARDS_ENABLED=1
```

Requires economy DB. Credits land in wallet when emission succeeds.

## Curation redistribute

```
GHC_CURATION_REDISTRIBUTE_ENABLED=1
```

Moves existing GHC voter → author; never mints when off.

## Referral settlement

```
GHC_REFERRAL_SETTLEMENT_ENABLED=1
```

## Community roles

| Role | Powers |
|------|--------|
| Owner | Full control, assign admins/mods |
| Admin | Assign mods/members, remove, settings |
| Moderator | Moderate, announce, invite |
| Member | Post, comment, chat |

Creator is Owner. Members tab: Make admin / moderator / member / Remove.

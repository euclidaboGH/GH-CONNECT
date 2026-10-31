# Operator flags — referral, curation, activity missions

Set on Vercel (Production + Preview) then redeploy:

```
GHC_ACTIVITY_REWARDS_ENABLED=1
GHC_REFERRAL_SETTLEMENT_ENABLED=1
NEXT_PUBLIC_GHC_REFERRAL_SETTLEMENT_ENABLED=1
GHC_CURATION_REDISTRIBUTE_ENABLED=1
NEXT_PUBLIC_GHC_CURATION_REDISTRIBUTE_ENABLED=1
```

Also required for profile/cover uploads:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GH_MEDIA_BUCKET=gh-media
```

Verify: `GET /api/media/health`

## Referral (GreenHaven ID)

- Users submit the inviter's GreenHaven ID once via `POST /api/referral/attribute` with `{ greenHavenId }`.
- Server resolves ID → referrer user → referral code → one-time attribution.
- Membership 5% settlement only when `GHC_REFERRAL_SETTLEMENT_ENABLED=1`.

## Missions

- Progress is always recorded.
- GHC credits only when `GHC_ACTIVITY_REWARDS_ENABLED=1` and DB configured.

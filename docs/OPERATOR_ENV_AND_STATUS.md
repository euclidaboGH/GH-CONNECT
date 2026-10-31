# Operator env vs live behaviour

Setting Vercel env flags is **necessary but not sufficient**.

## Required
- SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- GH_MEDIA_BUCKET (default gh-media)

## Flags (need migrations too)
- GHC_ACTIVITY_REWARDS_ENABLED=1
- GHC_REFERRAL_SETTLEMENT_ENABLED=1
- GHC_CURATION_REDISTRIBUTE_ENABLED=1

## After setting env
1. Redeploy
2. Open /api/system/status — read blockers and probes
3. Open /api/media/health while signed in
4. Apply MISSING SQL migrations in Supabase
5. Ensure storage bucket gh-media exists

## Note
Env alone does not create tables/RPCs. 404 DEPLOYMENT_NOT_FOUND means that deployment did not include the route (old commit) or wrong host.

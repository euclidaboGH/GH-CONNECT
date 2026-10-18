# Engagement rosters, comments & emoji (2026-10-18)

## Problems addressed

1. Comments/replies across accounts need durable comment RPCs applied on Supabase.
2. Comment emoji dual-write via gh_comment_reactions.
3. Who liked / voted / viewed via roster RPCs + long-press UI.

## Migration

`supabase/migrations/20261018_gh_engagement_rosters.sql`

Apply on Preview Supabase after social core. Then deploy app.

## Two-account test

Use operator:live-e2e-social with cookies after migrate+deploy.

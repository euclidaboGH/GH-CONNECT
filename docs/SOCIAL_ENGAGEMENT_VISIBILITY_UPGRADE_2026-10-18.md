# Social engagement visibility and full-view upgrade — 2026-10-18

## Problems addressed

- Feed cards now receive recent comment previews, reaction aggregates, viewer reaction state, and server-provided like/comment/share totals as part of the initial feed response.
- Feed hydration uses two batched REST reads for up to 50 feed posts (comments and reactions), rather than one request per post. Engagement hydration is fail-soft so a failed preview query cannot fail the feed itself.
- Post cards show like, comment, share, and reaction counts before a user clicks an action. Recent comment snippets are visible directly on the feed.
- Clicking a post body or its media opens a full-post detail sheet with untruncated text, media, counts, reaction breakdown, and recent comments. Comment/share actions continue to use the existing shared sheets.
- Stories render visual cards with their photo/video or text/background preview, creator, unseen indicator, and known reaction totals before the viewer is opened.
- Story reactions are now durable and counted. The new route authenticates the viewer, rate-limits writes, and uses a service-role-only RPC. The RPC rejects self-reactions, expired/unavailable stories, and blocked relationships.
- Sharing updates the in-session share count when the server returns an authoritative count.

## Database migration required

Apply `supabase/migrations/202610240006_gh_story_reactions.sql` to Testnet first. It creates `gh_story_reactions`, denies direct client table access with RLS, and grants execute only to `service_role` for the toggle RPC. Apply to Mainnet only after two-account Testnet verification.

No migration is needed for feed comment/reaction previews; they read existing `gh_post_comments` and `gh_post_reactions` tables.

## Verification

Run:

```bash
npm run test:social-visibility
npm run test:vercel-build-repair
npm run test:rewards-reliability
npm run test:daily-claim-wallet-pipeline
npm run test:economy-v12
npm run build
```

## Test plan

1. Sign in with a user who has never opened the comment sheet and verify existing comments and totals appear immediately.
2. Verify likes and non-like reactions match the durable `gh_post_reactions` rows, and the viewer's reaction is visibly selected where supported.
3. Share a post and verify the count updates without refreshing; reload and compare with the server total.
4. Click post whitespace and media. Verify full text, full media, engagement totals and recent comments are shown.
5. Publish image/video and text-only stories. Verify their content preview is visible on the feed before opening the viewer.
6. React to another user's story from a second account. Verify the count persists after reload; verify self-reactions and blocked users are rejected.
7. Verify a failed comments/reactions preview query does not make the feed fail.

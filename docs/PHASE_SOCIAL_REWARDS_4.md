# Phase 4 — Cross-account comments, reactions, votes (2026-10-20)

## Fixes
1. **Reply parent check** — If the parent comment is not in local state, load the durable thread before failing; server still validates.
2. **Post-comment reconcile** — After a durable comment write, re-list comments from the server so ids/order match other accounts.
3. **Comment sheet** — Soft poll every 12s while open; also reloads on `ghc:post-engagement` and `ghc:social-mutation`.
4. **Feed mapping** — `mapRemoteFeedPosts` carries `upvoteCount` / `downvoteCount` from the API so profile and feed stay aligned after refresh.

## Already in place (verified, not rewritten)
- Server-first `socialAddComment` / `socialToggleReaction` / curation vote with fail-closed non-durable toasts
- Engagement bus `ghc:post-engagement` for count sync across Feed + Profile
- Focus/visibility feed revalidate for multi-device convergence

## Operator
Comment/reaction RPCs and migrations must be applied on Supabase. Live two-account E2E: A comments → B opens sheet → sees comment; B replies → A sees reply after poll/refresh.

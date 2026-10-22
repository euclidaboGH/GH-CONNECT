# Social RPC HTTP 404 — root cause and fix

## Cause

Client errors like:

- `RPC_gh_post_curation_set_with_reward_HTTP_404`
- `RPC_gh_comment_create_HTTP_404`
- `RPC_gh_comment_reaction_toggle_HTTP_404`
- `RPC_gh_save_toggle_HTTP_404`

mean **PostgREST cannot find the SQL function** on the linked Supabase project.
The app code is correct; the **database migrations were not applied** (or only partially applied).

## Fix (required)

1. Open **Supabase → SQL Editor** for the project used by Vercel `SUPABASE_URL`.
2. Run the full script:

   `supabase/migrations/20261022010099_ENSURE_social_engagement_rpcs.sql`

   (also at `docs/SUPABASE_ENSURE_SOCIAL_RPCS_2026-10-22.sql`)

3. Confirm functions exist:

```sql
select proname from pg_proc
where proname in (
  'gh_post_curation_set',
  'gh_post_curation_set_with_reward',
  'gh_comment_create',
  'gh_comment_reaction_toggle',
  'gh_save_toggle',
  'gh_reaction_toggle'
)
order by 1;
```

4. SQL-only fix does **not** require redeploy; refresh the app and retry vote/comment/save.

## App-side (0.70.1)

- `socialRpc` falls back: `gh_post_curation_set_with_reward` → `gh_post_curation_set` when the reward wrapper is missing.
- APIs map remaining 404s to `SOCIAL_RPC_MISSING` with operator guidance.
- Self-vote on own post remains **forbidden** by design (`SELF_CURATION_FORBIDDEN`) with clear UX copy.

## Self-curation

You cannot upvote/downvote **your own** post (anti-farming). Other users' posts can be curated once RPCs are installed.

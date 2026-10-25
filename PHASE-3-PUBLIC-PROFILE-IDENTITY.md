# Phase 3 — Public Profile Identity Hydration

Release: **GH CONNECT v0.92.0**

## Scope

Phase 3 adds a shared server-side identity hydration utility that rehydrates social author/owner display names and photos from the canonical `gh_user_profiles` store. It is used by the feed, post detail, comments, profile timeline, and active stories endpoints.

## Security and reliability

- Selects only `gh_user_id`, `display_name`, `username`, and `photos`.
- Never returns financial, wallet, membership, entitlement, or private profile fields.
- Rejects `data:` and `blob:` media URLs for public avatar hydration.
- Uses uncached reads so updates to names/photos can appear without stale server caching.
- Treats the hydration as best-effort: if the profile database is unavailable, it preserves the existing social record instead of making the feed unavailable.
- Preserves the authenticated actor and server-authoritative post/comment ownership paths.

## Source-level checks

Run `npm run check:phase3-profile-identity`. The check covers the helper's selected columns and its integration into five social read paths.

## Deployment verification still required

A source-level pass does not prove the live Testnet data is complete. After deploying, test accounts with known `gh_user_profiles` records should appear by their canonical display name and photo in feed, post detail, comments, profile timelines, and stories. Check Vercel logs and the actual profile row if a generic label remains. Do not backfill or synthesize user identity without a separately reviewed migration/reconciliation plan.

The production build/typecheck has not been run in this environment: the installed runtime is Node.js 22.16.0, while this project requires Node.js `^24.15.0`, and dependencies are not installed here.

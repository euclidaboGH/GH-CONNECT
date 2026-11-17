# Phase 17 — Cohesive Social Engagement Journey

## Scope

Phase 17 strengthens the path from a post into its full discussion and back to the feed. It uses the existing durable social APIs and canonical `gh_comment_list_v3` RPC; no new database schema or migration is introduced.

## Implementation

- Comment retrieval now loads bounded pages of 40 instead of attempting to hydrate up to 80 comments in one request.
- The comments API's composite `(createdAt, id)` cursor is carried through the social client and shared GHC context.
- The shared post store merges subsequent pages by stable comment ID. Existing pages remain in place, and server rows replace stale copies without duplicate comments.
- The comments sheet distinguishes revealing comments already loaded from requesting older server pages.
- Pagination has its own loading/disabled state and polite live feedback; failures leave the current discussion intact and can be retried.
- The discussion header uses the larger of the known engagement total and loaded comment count, avoiding the misleading impression that one loaded page is the full discussion.
- Post details now distinguish a genuinely empty discussion from a failed comments request and expose an explicit retry action instead of presenting a false empty state.
- Every active post reaction now emits author feedback (toggle-off does not), with a durable dedupe key scoped to actor, post, and reaction type.
- Share-sheet completion now waits for the durable share endpoint before applying the local destination result. The confirmed server share count is broadcast through the shared engagement bus, and the former second fire-and-forget share write has been removed.
- Existing server-side ownership, post-visibility checks, rate limits, reaction persistence, share notification deduplication, comment/reply notifications, and mention notifications remain authoritative.

## Verification

`npm run verify:static` and `npm run prebuild` include `scripts/check-post-engagement-journey-phase17.mjs`.

The static contract verifies cursor validation, canonical RPC use, client cursor transport, append/deduplication behavior, accessible pagination feedback, authenticated comment reactions, active-reaction notifications, durable share confirmation/count propagation, duplicate-write prevention, visibility-gated shares, recipient-scoped notification reads, and post-detail recovery feedback.

## Operational note

This phase does not certify live Testnet behavior. Apply no migrations for this change. Confirm the deployed database already has the canonical comment-list RPC and run the two-user social verification matrix before treating cross-account behavior as operator-verified.

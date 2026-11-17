# Run #305 — Phase 3 creator-media closeout and Phase 4 community pagination

**Source archive:** `GREENHAVEN-PHASE3-UPLOAD-RECOVERY-VIDEO-PERFORMANCE-IDEMPOTENCY-0.338.67-2026-11-14.zip`  
**Archive SHA-256:** `85297603f3e67bb67d8a4b689d63e42146f83a69a9922a744bdf753611e93a2e`  
**Candidate:** `gh-connect@0.338.68`  
**Date:** 2026-11-14

## Phase 3 — source closeout

The supplied 0.338.67 archive already contains the following implementation, which was re-reviewed and verified in this delivery:

- Per-attachment photo/video/document recovery retains the original `File` for same-session retry without discarding post text or other ready attachments.
- Upload cancellation is wired through proxy upload, direct-upload intent/finalization, storage PUT/POST and account-switch/compose-close paths.
- Identity is captured at upload start and rechecked before completion; stale uploads cannot attach to a different account.
- Drafts are account-scoped, bounded to 20, exclude local blob/data URLs, and restore durable media references, audience/community target and publish request metadata.
- Durable media URLs use an explicit scheme policy; local-only media is not published as durable content.
- Image previews use lazy loading/async decoding and video uses deferred preload; the reusable video element is keyed by resolved source.
- Story publish retries reuse a stable client story ID while the content signature remains unchanged. The existing `gh_story_create` SQL function checks the owner and returns an idempotent duplicate result for an existing story ID. The database migration is already part of the source archive; it was not modified or applied by this run.

### Phase 3 source verification

| Gate | Result |
|---|---:|
| Creator media hardening | 13/13 |
| Upload cancellation and identity | 12/12 |
| Creator draft recovery | 11/11 |
| Durable media URL policy | 7/7 |
| Upload recovery reliability | 9/9 |
| Durable media URL runtime assertions | 19/19 |
| **Total** | **71/71** |

**Phase 3 disposition:** source implementation and focused source-contract verification are complete. This does not certify full Node 24 typecheck/lint/build, reload-persistent raw-file recovery (not supported by the in-memory `File` retry queue), real interrupted-network behavior, Android/Pi Browser playback, or two-account end-to-end acceptance. Do not describe those as passed.

## Phase 4 — community post pagination repair

### Root cause

The existing `gh_community_post_list` SQL function already implements deterministic keyset ordering by `(createdAt DESC, id DESC)`, accepts `p_before_ms`/`p_before_id`, and checks community membership. The authenticated API accepted the cursor and forwarded it to the RPC, but returned only `posts`. `socialListCommunityPosts` discarded any cursor, and `PremiumCommunityHub` requested only the first 60 posts.

### Implementation

1. The API page size is bounded to 99 so it can request one look-ahead row within the existing SQL function's 100-row cap.
2. The API requests `limit + 1`, trims the look-ahead row from the visible page, and emits `nextCursor: { before, beforeId }` only when a further row exists.
3. The API validates the final timestamp and post ID before constructing the cursor. Existing authentication, membership checks, private/no-store cache headers and server-owned visibility enforcement remain intact.
4. The social client helper now accepts and forwards a cursor, validates the returned cursor and exposes it in its typed result.
5. `PremiumCommunityHub` now loads subsequent pages, merges by canonical post ID to prevent duplicates, fences stale responses using the existing request generation, prevents concurrent load-more requests, resets pagination on community changes and refreshes, and exposes accessible loading/disabled button feedback.
6. Added `scripts/check-phase4-community-post-pagination.mjs` and registered it in `pretypecheck`, `prebuild:checks` and `verify:static`.

### Phase 4 verification

- New community pagination source gate: **12/12 passed**.
- Existing Phase 4 social/community boundary gate: **9/9 passed**.
- Existing community integrity gate: **53/53 passed**.
- Social target-ID sanitizer runtime checks: **12/12 passed**.
- Community action resilience: **9/9 passed**.
- Existing community canonical post renderer contract: **14/14 passed**.

**Phase 4 disposition:** pagination is complete at source level. The broader phase remains in progress: legacy/archived/sample post presentation, pinned/official announcement cohesion, moderator/report flows, community filters/sorting and full multi-account browser/device acceptance still need dedicated review and implementation.

## Safety and non-changes

- No Supabase migration, database schema, RPC definition, RLS policy, grant, Testnet/Mainnet record or migration history was changed.
- No wallet, Pi payment, GHC balance, reward issuance, payout or settlement authority was changed.
- No dependency version was changed.
- No GitHub push, pull request or Vercel deployment was performed.
- Existing SQL cursor semantics and service-role-only RPC ACL were reused; no new authorization bypass or client-side membership authority was introduced.

## Environment and release status

The supplied runtime is Node.js 22.16.0 while `.nvmrc` and package engines require Node.js 24.15.0. Dependencies are not installed in this working environment. Focused Node source-contract tests are executable here; full dependency-backed typecheck, ESLint, Next.js production build and browser/device acceptance remain outstanding. Production remains **NOT APPROVED**.

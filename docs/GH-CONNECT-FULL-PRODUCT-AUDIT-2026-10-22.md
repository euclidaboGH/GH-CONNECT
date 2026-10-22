# GH-CONNECT Full Product & Engineering Audit

**Audit date:** 2026-10-22  
**Source baseline:** GH-CONNECT 0.70.3, latest project archive available in this conversation (`GH-CONNECT-0.70.3-PI-MEDIA-DAILY-CLAIM-REPAIR-2026-10-22.zip`). This is not a fresh checkout of the remote `testnet` branch. Reconcile changes into the latest branch before merging; do not replace a newer checkout with this archive.

## Executive summary

GH-CONNECT has meaningful engineering foundations: authenticated server routes, durable-media ownership checks, server-authoritative wallet/reward operations, idempotent daily claims, membership pricing checks, and broad static regression coverage. However, **it is not ready to call fully verified or beta-ready** because migration history is blocked and several social visibility/counting issues need to be fixed and tested against the real Testnet database.

### Release blockers / highest-priority findings

1. **P0 — Supabase migration inventory is blocked.** Two duplicate migration version prefixes exist: `202610210001` and `202610210002`. The migration reconciler fails on these collisions. The repository also contains 14 migrations whose filename dates are after the audit date. Capture and compare Testnet and Mainnet migration histories before renaming, moving, or applying any migration. Never blindly rename an already-applied migration.
2. **P1 — Comment visibility authorization is missing at the durable read boundary.** `app/api/social/posts/[id]/comments/route.ts:40-52` calls `gh_comment_list_v2` with `p_viewer_id`, but `supabase/migrations/20261022010064_gh_comment_stable_cursor.sql` accepts but does not use that viewer ID or filter the parent post by visibility/block/community membership. The fallback `gh_comment_list` is also not viewer-aware. Authentication alone is not authorization: a signed-in user who knows a post ID may be able to fetch comments from a followers-only/private post. Add a service-role-only, viewer-aware comment-list RPC that applies the same canonical post visibility, block, and community membership rules; fail closed if the guard is unavailable. Add two-account privacy tests.
3. **P1 — Feed visibility rules are incomplete/inconsistent.** `supabase/migrations/20261022010092_gh_post_list_feed_curation_fields.sql` filters the main feed for `public`, own posts, and `followers`, but does not include mutuals visibility or require active membership for community-bound posts. This both omits expected mutuals content and risks exposing the text/metadata of community-bound posts to non-members. Align feed, profile timeline, comment read, and media authorization around one shared visibility policy and test public/follower/mutual/private/community/block combinations.
4. **P1 — The profile's visible post list is derived from the currently loaded global feed.** `components/ghc/profile-screen.tsx` filters `feed.posts` for own posts. This is a subset, not a complete chronological profile timeline; older posts can disappear simply because they are outside the currently loaded feed pages. Use the dedicated paginated profile-content API/RPC for the profile timeline and reconcile the required migration before enabling it.
5. **P1 — Comment reaction counts were always empty with the current SQL contract.** `gh_comment_reaction_list` returns `reactions`, while the API expected `counts`. The route now aggregates the returned roster into counts server-side and never returns the roster to the browser. The GET handler still needs the post/comment association and viewer visibility guard described above.

## Section-by-section audit

### 1. Feed

**Strengths observed**
- `app/api/social/feed/route.ts` requires an authenticated viewer, disables caching, uses a server RPC, and fails closed when the social database is unavailable.
- Feed cursors are bounded and validate cursor pairs. The v2 cursor orders by `(createdAt, id)` to avoid same-timestamp skips.
- Feed engagement hydration is batched rather than making one request per card.
- Static visibility, card layout, social authorization and IDOR suites passed in this audit run.

**Weaknesses / risks**
- SQL visibility does not cover `mutuals` or enforce community membership for community-bound posts.
- If the stable-cursor RPC is unavailable, the route falls back to the legacy RPC and loses the ID tie-breaker; pagination can duplicate/skip posts sharing a timestamp. `stableCursor: false` should be treated as migration readiness telemetry, not a silent long-term fallback.
- Engagement hydration is bounded to at most 50 post IDs, 600 comments, and 2,000 reactions/curations. Counts for highly engaged posts can be truncated by these response caps.
- Mute filtering is best-effort in `mutedAuthorIds`; a query failure does not fail closed. Confirm whether the durable feed RPC also enforces mutes; if not, make mute enforcement durable and fail closed or return an explicit degraded result.

**Recommended fixes**
- Implement one canonical SQL visibility predicate reused by feed, profile content, comment reads, and media authorization.
- Aggregate engagement counts in SQL per post instead of loading raw reaction rows with fixed global limits.
- Add deterministic cursor E2E tests with identical timestamps, deleted posts, blocks, mutes, community members/non-members, and mutuals.
- Add observable metrics for v2-to-legacy RPC fallback and remove fallback only after migration rollout evidence.

### 2. Profile

**Strengths observed**
- `app/api/profile/me/route.ts` derives ownership from the authenticated session, rate-limits reads/writes, bounds request bodies, ignores client-supplied identity/financial fields, and returns `no-store` responses.
- Profile media is sanitized/merged through dedicated helpers; avatar and cover uploads use the shared durable media helper.
- Profile media upload UI distinguishes durable upload from offline/device-only fallback rather than claiming the local image is available to other devices.

**Weaknesses / risks**
- The main profile post list is filtered from currently loaded feed state rather than fetched as a complete profile timeline.
- Device-only/offline media can look updated on the current device but will not exist cross-device until durable sync succeeds. Keep this distinction visible and do not silently promote a data URL to a durable media reference.
- The profile content library route explicitly returns `503 PROFILE_CONTENT_MIGRATION_REQUIRED` until `20261022010102_gh_profile_content_library.sql` is deployed. That migration is future-dated relative to this audit and must not be applied without history review.
- Pi Browser upload/session recovery has static regression coverage but has not been verified against the deployed Testnet cookie/token/configuration path.

**Recommended fixes**
- Use a dedicated owner/viewer-authorized profile timeline query with stable pagination and server-side visibility checks.
- Show upload states explicitly: uploading, saved on this device only, uploaded, failed/retry.
- Add two-account tests for profile update persistence, avatar/cover refresh, logout/login, offline selection, expired session, and signed media visibility.

### 3. Timeline / profile timeline

**Weaknesses / risks**
- Feed pagination and profile timeline completeness are currently coupled to the global feed's loaded state.
- Legacy cursor fallback can produce duplicate or skipped content until the stable-cursor migration is active.
- Visibility behavior differs between feed SQL and the more complete media authorization rules.

**Recommended fixes**
- Keep the global feed and profile timeline as separate queries with separate cursors and explicit ownership/viewer authorization.
- Add pagination tests across equal timestamps, deleted posts, profile privacy, and block/unfollow changes between page requests.
- Re-evaluate visibility at every page request rather than trusting client cache state.

### 4. Posts and media

**Strengths observed**
- Post composer regression tests passed for draft restoration/update, separate post/story flows, media durability, upload disabling, and scheduling honesty.
- Media uploads use an owner-derived server path, metadata checks, signed HTTPS storage URLs, direct-upload completion verification, and server-side session recovery retry.
- Media static hardening tests passed.

**Weaknesses / risks**
- Post visibility SQL needs the same mutuals/community corrections described in the Feed section.
- The post API and all media consumers still need live Pi Browser validation; static checks cannot establish cookies, storage permissions, actual upload completion, or cross-device persistence.
- Raw engagement hydration has fixed caps that can undercount popular posts.

**Recommended fixes**
- Enforce visibility at both post retrieval and private media delivery.
- Run upload E2E for avatar, cover, post image/video, story, comment attachment, and message attachment with a second account and expired-session recovery.
- Add tests for duplicate submission, network interruption, retry, and preserving composer draft/file selection.

### 5. Comments and replies

**Strengths observed**
- Comment creation is server-first and refuses an explicitly non-durable response.
- Comment reaction writes are authenticated, rate-limited, and use a server RPC.
- Comment count updates now preserve a known durable count when only a preview is loaded; the 80-comment reconciliation page no longer replaces a larger total.
- Comment/reaction static tests were repaired to match the current `useCallback` declarations instead of searching obsolete function signatures.

**Weaknesses / risks**
- **High-priority privacy issue:** comment list RPCs do not apply viewer visibility. See release finding #2.
- Comment reaction list route expected a `counts` object but the SQL function returns `reactions`; this is fixed in this package. It still needs a viewer/post association guard.
- `pinComment` and `unpinComment` are explicitly local-device preferences, not durable shared comment pins. The UI should continue to label them as local-only or hide them until a durable API exists.
- The comment list route falls back to a legacy non-cursor RPC when v2 is unavailable; that fallback does not provide the same pagination semantics and does not enforce viewer visibility.

**Recommended fixes**
- Add a viewer-aware `gh_comment_list` RPC that authorizes the parent post and applies block/community/visibility rules before returning any comment rows.
- Add tests for cross-post IDs, private posts, followers-only posts, mutuals, community non-members, blocked users, deleted comments, and reply parent integrity.
- Keep reactions server-authoritative; add a route-level test that checks counts are returned correctly and never exposes reaction user IDs.

### 6. Wallet

**Strengths observed**
- Wallet API uses session-derived identity and same-user authorization.
- The daily claim-to-wallet and redemption pipeline tests protect durable ledger authority, pending-vs-spendable balance separation, idempotency, 80/20 reserve accounting, wallet refresh, and no optimistic balance fabrication.
- Economy authorization, payment intent and financial integrity static suites passed.

**Weaknesses / risks**
- This audit did not connect to Supabase or run concurrent/multi-instance ledger operations. Static source tests do not prove production balances, locks, RLS grants, or transaction behavior are correct in the target database.
- Transfers, withdrawals, membership spends, reward redemptions, and marketplace spending need a single cross-domain concurrency test matrix against the deployed RPCs.

**Recommended fixes**
- Run Testnet SQL assertions for ledger balance, spendable/locked/reserved balance, paired transfers, duplicate references, and concurrent spends.
- Verify wallet refresh across two sessions/devices after every mutation and ensure no component locally increments the authoritative balance.
- Keep withdrawal/acquisition/payout features disabled unless the relevant operator and provider evidence is approved.

### 7. Daily rewards and Rewards Centre

**Strengths observed**
- Daily claim endpoint ignores client-supplied amounts, authenticates the session, rate-limits attempts, and uses an atomic database RPC when configured.
- Claims are pending, not spendable, for the configured 48-hour lock; the user/reserve split and idempotent duplicate behavior are covered by static tests.
- Reward UI has separate already-claimed vs newly-claimed messages, server wallet hydration, and retry handling.
- The previous double-modal behavior is suppressed in the available archive, and the GHC logo asset is present.

**Weaknesses / risks**
- Feed reward components intentionally show a local preview before the server status is confirmed. The POST endpoint prevents duplicate issuance, but the displayed claimability/amount can be speculative and can make the UI feel inconsistent across devices or stale tabs.
- The two reward entry points still have distinct component/state implementations. Keep one modal owner and make all other entry points open it rather than creating independent claim surfaces.
- Multi-instance Supabase and live Lagos-day rollover behavior were not exercised in this environment.

**Recommended fixes**
- Add an explicit `loading/unknown` status and avoid presenting the local preview as a server-confirmed entitlement. Keep a manual refresh/retry action if the status service is unavailable.
- Keep one active modal, one claim in flight, and one server-authoritative claim status source.
- Test midnight rollover, two devices, double taps, concurrent requests, 48-hour redemption, already-claimed retries, and wallet reconciliation against Testnet.

### 8. Membership

**Strengths observed**
- Membership pricing and orphan-recovery static tests passed.
- Membership status is authenticated and fails closed if the entitlement store cannot be read.
- Pi membership activation requires a durable completed/fulfilled payment intent bound to the authenticated user, currency, amount and exact product/tier/period.
- GHC membership purchase uses an atomic server-side purchase path rather than trusting client balance.

**Weaknesses / risks**
- A verified Pi payment can succeed while durable entitlement persistence fails; the route returns a retryable 503. That is safer than falsely reporting success, but it requires an operator-visible reconciliation queue and a tested retry procedure.
- Live provider callbacks, duplicate notifications, cancellation/refund paths, and real entitlement expiry were not tested against the provider sandbox or Testnet database.

**Recommended fixes**
- Add a membership operations screen/report for paid-but-unfulfilled intents, orphaned debits, expired entitlements, and retry outcomes.
- Run sandbox end-to-end tests for purchase, duplicate callback, failed entitlement write, retry, refund, renewal, and cross-device status refresh.

## Additional engineering findings

- The available runtime here is Node `v22.16.0`; the project pins Node `24.15.0` (`.nvmrc`). `node scripts/check-node-runtime.mjs` correctly rejects the current environment. `node_modules` is absent, so ESLint, TypeScript and Next production build could not be run.
- `scripts/test-migration-history-reconciler.mjs` fails because of the two known duplicate migration prefixes. This is a real release gate, not a test to bypass.
- The project-integrity scanner originally treated a literal `/login` example inside a regression test as a real app navigation. It now excludes `scripts/` from the heuristic link scan; integrity audit passes 36/36.
- `scripts/test-phase5-6-massive-upgrade.mjs` had a stale assertion expecting a 30 MiB image to violate a 50 MiB media policy. It now tests 51 MiB; 71/71 assertions pass.
- `scripts/test-release-gates-policy.mjs` still referenced a curation status report at its old pre-cleanup path. It now reads the explicitly archived historical report; 9/9 release-policy assertions pass.
- `scripts/test-ghc-wallet-authz.mjs` was missing explicit allowlisting for read-only public catalog/supply metadata endpoints. The allowlist is now explicit; 37/37 checks pass. Public supply telemetry should remain aggregate-only and be reviewed for operational sensitivity.

## Verification executed

| Check | Result |
|---|---:|
| JSX safety scan | 727 files scanned, passed |
| Project integrity | 36 passed, 0 errors, 0 warnings |
| Project truth | 14 passed |
| Pi media + daily claim UI | 14 passed |
| Comment server-first contract | passed, including new count-preservation assertions |
| Comment reaction counts contract | 5 passed |
| Reaction server-first | passed |
| Social authz static scan | 39 passed across 39 routes |
| IDOR static scan | 176 passed across 164 routes |
| GHC wallet authz | 37 passed |
| Daily claim redemption/wallet integrity | 26 passed |
| Daily claim wallet pipeline | 35 passed |
| Rewards reliability | 24 passed |
| Membership pricing | passed |
| Membership orphan recovery | passed |
| Post composer | 16 passed |
| Social visibility | 14 passed |
| Phase 7 product experience | 26 passed |
| Phase 5–6 hardening | 71 passed |
| Phase 8 architecture quality | 23 passed |
| Phase 9 operations resilience | 19 passed |
| Phase 10 Testnet beta gates | 18 passed |
| Critical security hardening | 20 passed |
| Daily claim 48-hour lock | 14 passed |
| Daily-Claim-only issuance | 31 passed |
| Migration inventory | **blocked** by duplicate version prefixes |
| Migration history reconciler | **blocked** by duplicate version prefixes |
| ESLint / TypeScript / production build | not run: unsupported local Node version and no installed dependencies |
| Live Pi Browser / Supabase / provider E2E | not run |

## Roadmap and release order

### Gate 0 — Before any migration or release
1. Capture `supabase migration list` and schema/RPC state for Testnet and Mainnet independently.
2. Reconcile duplicate versions `202610210001` and `202610210002` without renaming applied migrations blindly.
3. Review the 14 future-dated migrations and dependency order. Apply only individually approved migrations to Testnet first.
4. Install with Node 24.15.0 and run clean install, `npm run ci:verify`, typecheck, lint and production build.

### Gate 1 — Social privacy and correctness
1. Add viewer-aware comment list/read authorization; fail closed on missing visibility guard.
2. Align feed and profile SQL visibility for mutuals, community membership and blocks.
3. Add cross-account tests for private/follower/mutual/community posts and comment reaction reads.
4. Verify profile timeline is complete and paginated independently of the global feed.

### Gate 2 — End-to-end functional quality
1. Pi Browser media uploads: avatar, cover, post, story, comment and message attachment; test expired session and retry.
2. Comment/reaction counts: add/remove/reload/cross-account; verify totals for posts with more than 80 comments and 2,000 reactions.
3. Wallet/rewards: double claim, concurrency, day rollover, 48-hour redemption, balance refresh across two devices.
4. Membership: payment callback idempotency, paid-but-unfulfilled recovery, expiry and refund/reversal.

### Gate 3 — Beta readiness
1. Add browser E2E and accessible mobile viewport tests for Pi Browser-sized screens.
2. Run restore rehearsal, rollback review, feature kill-switch checks and release evidence collection.
3. Do not enable Mainnet financial rails until migration, provider, ledger, payout and security evidence is independently reviewed and approved.

## Changes made in this audit package

- Fixed comment count updates so a partial loaded thread does not overwrite a higher durable total, including the capped 80-comment reconciliation path.
- Fixed comment reaction list API aggregation to match the current SQL RPC output and keep user rosters server-side.
- Updated comment/reaction static tests to match the current `useCallback` source declarations.
- Added `test:comment-reaction-counts` and registered it in `ci:verify`.
- Fixed the media policy test's stale 30 MiB expectation to test above the actual 50 MiB cap.
- Fixed the project-integrity link scanner's false positive on route strings inside test fixtures.
- Added explicit public read-only catalog/supply entries to the wallet authorization test allowlist.

**Not claimed as complete:** the comment visibility gap, feed mutuals/community visibility, duplicate migration reconciliation, live Testnet verification, full build, lint and typecheck remain outstanding. Do not merge or deploy until the P0/P1 items and migration gates are addressed.

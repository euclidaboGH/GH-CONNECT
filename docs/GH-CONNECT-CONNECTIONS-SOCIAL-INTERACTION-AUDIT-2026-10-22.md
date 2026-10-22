# GH-CONNECT Connections and Social Interaction Repair — 2026-10-22

## Scope and source baseline

This candidate is based on the GH-CONNECT 0.69.3 social-write-persistence archive available in the current conversation. It is **not** a fresh checkout of remote commit `bfd4f88fc987fbfeb04c23a48f0f08b939e4030d`. Compare changes against the latest `testnet` branch before applying them.

## Confirmed CI blocker fixed

The `followFromPost` and `unfollowFromPost` callbacks previously referenced `followUser` before the `const` callback was initialized. They are now declared after the canonical follow callbacks. The source-level declaration-order regression is covered by `scripts/test-connection-social-write-pipeline.mjs`.

## Follow/unfollow behavior hardened

- Follow/unfollow writes use the authenticated `/api/social/follows` endpoint, which derives the actor from the server session and uses `gh_follow_set`.
- The explicit action helper accepts a target state (`true` for follow, `false` for unfollow), so Feed's unfollow action no longer accidentally invokes a toggle based on stale local state.
- Toggle actions first retrieve the server-authoritative relationship state, then request the opposite state.
- A non-durable response is not reported as success.
- The in-memory graph is updated only after the durable endpoint confirms the target state. The local domain graph adapter is not treated as a second Supabase write.

## Connection, match, discover and communication paths inspected

- Follow list/status: `/api/social/follows` and `socialFetchFollowStatus`.
- Connection request: `/api/connections/request` uses authenticated session identity and `ghc_connection_request_upsert`; non-durable writes are rejected by the client.
- Connection acceptance/decline: authenticated server routes use their corresponding durable RPCs; inbox hydration maps persisted request rows back into the session UI.
- Match signals: `/api/matching/signal` persists `like`, `pass`, and `superlike` through `ghc_match_signal_upsert`; `/api/matching/inbox` reconstructs mutual matches from reciprocal durable likes.
- Discover: `/api/social/people/discover` reads registered profiles from `gh_user_profiles`, excludes the current user, and returns a non-durable/empty result if the shared database is unavailable.
- Messaging: existing reliability tests verify authenticated membership, recipient privacy, block checks, durable attachments, receipts, and non-durable failure behavior.

## Regression verification

Passed during this source pass:

- `test-connection-server-first.mjs`
- `test-connection-social-write-pipeline.mjs` — 11/11
- `test-latest-ci-regressions.mjs` — 16/16
- `test-inbox-hydrate.mjs`
- `test-social-authz.mjs` — 39/39
- `test-social-visibility.mjs` — 14/14
- `test-social-canonical-visibility-v3.mjs` — 22/22
- `test-private-social-media-contracts.mjs` — 17/17
- `test-messaging-reliability.mjs` — 32/32
- `test-post-engagement-refresh-persistence.mjs` — 10/10
- `test-social-write-persistence.mjs` — 27/27
- `test-reaction-server-first.mjs`

These are static/source regression tests. A full TypeScript build, lint run, live Supabase test, two-account E2E test, and Vercel deployment were not performed in this environment.

## Remaining release gates

1. Reconcile the known duplicate migration version prefixes before applying any new migrations.
2. Run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, and `npm run build` with Node 24.15.0.
3. In Testnet, verify with two distinct registered accounts: follow/unfollow; send/accept/decline/retry connection requests; reciprocal likes and passes; discover/profile IDs; blocked/private accounts; inbox refresh; direct messages and shared media.
4. Confirm corresponding rows in `gh_follow_edges`, `ghc_connection_requests`, and `ghc_match_signals` after each action. Do not infer durability from a toast or local UI state alone.
5. Do not backfill invented relationships. Historical follows/connections/matches absent from Supabase require evidence-based recovery from available logs or exports.

No migration was added or applied in this repair pass, and no live database records were changed.

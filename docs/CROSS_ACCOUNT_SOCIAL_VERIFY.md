# Cross-account social verification

## Root causes addressed

1. **Discovery used session seed candidates** (`demo-*` / local IDs) instead of `gh_user_profiles`.
   Connection/follow to those IDs never reached real registered users.
2. **Writes could appear successful while non-durable** when RPCs/migrations missing.
3. **Peers needed feed/inbox re-fetch** after mutations (previous package added `ghc:social-mutation`).

## Fixes in this package

| Change | Purpose |
|--------|---------|
| `GET /api/social/people/discover` | List onboarded profiles with canonical `gh_user_id` |
| `socialDiscoverPeople` + context hydrate | Replace/merge real people into Discover |
| `isLikelyServerUserId` guards | Block connect/follow to demo cards |
| Honest dual-write toasts | Already present; keep |

## Operator acceptance (two Pi accounts)

1. Both users complete onboarding so rows exist in `gh_user_profiles`.
2. Apply multi-user migrations (connection, follow, posts, reactions, comments).
3. Deploy this build.
4. User A Discover should list User B (real name/id).
5. A connects / follows B → B inbox / followers update after refresh.
6. A posts → B feed shows post when social feed RPC durable.
7. B likes/comments → A sees counts after mutation refresh or reload.

```bash
export GHC_E2E_BASE_URL=https://gh-connect-tau.vercel.app
export GHC_E2E_ALLOW_PRODUCTION=1
export GHC_E2E_COOKIE_A='…'
export GHC_E2E_COOKIE_B='…'
npm run operator:live-e2e-social
```

## Cannot claim fixed without

- Two real session cookies + durable DB responses on connection and follow.
- At least one post visible on the other account's feed.

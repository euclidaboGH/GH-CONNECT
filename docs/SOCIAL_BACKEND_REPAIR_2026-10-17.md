> HISTORICAL SNAPSHOT — dated findings and test counts are not current release evidence. Check `docs/PROJECT_TRUTH.md` and the latest CI run.

---

# Social backend repair — 2026-10-17

## Root causes (from source audit)

1. **Dual-write soft-fail**: UI often kept local optimistic state when `STORE_UNAVAILABLE` / non-durable responses occurred; users saw "success" while peers saw nothing.
2. **No post-mutation shared refresh**: After connection/like/comment, other accounts relied on slow focus revalidate (45s+) or full reload.
3. **Identity keying**: Some like rows used `fromUserId: "current-user"` instead of canonical session id.
4. **Infrastructure**: Cross-user visibility requires Supabase social migrations + session cookies on API calls (`credentials: include` already present). Live probe previously showed health ready but some RPCs still non-durable until migrations applied.

## Fixes in this package

- `lib/social/social-events.ts` — `ghc:social-mutation` after connection/reaction/comment
- Context listener re-fetches feed + connection inbox (~400ms debounce)
- Honest toasts when durable is false
- Social client treats 401/503 as hard failures (`ok: false`)
- `operator:live-e2e-social` for two-cookie connection/feed probes

## Operator verification

```bash
export GHC_E2E_BASE_URL=https://gh-connect-tau.vercel.app
export GHC_E2E_ALLOW_PRODUCTION=1
export GHC_E2E_COOKIE_A='…'
export GHC_E2E_COOKIE_B='…'
npm run operator:live-e2e-social
```

Apply multi-user migrations (`npm run operator:multiuser-migrations`) if connection/like RPCs return STORE_UNAVAILABLE.

# Multi-user operator checklist (one page)

1. Apply migrations in PHASE10 list (connection, match, notifications, messaging, communities, marketplace, profiles).
2. Confirm env: Supabase URL + service role, Pi auth, media bucket.
3. Deploy branch with this package (`app/` at root).
4. `GET /api/health` → readiness not blocked on critical auth.
5. Two KYC users: post → other feed; connect accept; mutual match; DM; community join; listing browse.
6. Sign off only when §4 checklist in PHASE10_MULTIUSER_RELEASE_GATE.md is green.

Client alone cannot make posts visible across users without server RPCs.

# GreenHaven Phase 2 — Durable System Announcements

## What changed

- Added `gh_system_announcements` for globally published, expiry-aware announcements.
- Added `gh_system_announcement_reads` for per-user read state across devices.
- Both tables have RLS enabled and explicit deny-all client policies. Server APIs use the existing server-only Supabase service-role configuration.
- Added `GET /api/system/announcements`: requires the authenticated GreenHaven session, returns active notices and read state for that session user only.
- Added `POST /api/system/announcements`: authenticated users can mark only their own notices as read; `markAll` marks the current active notice set read. Publishing is only enabled when the server-only `GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY` is configured and supplied in `x-greenhaven-announcement-key`.
- Integrated global announcements into the existing Notification Center, including unread totals, read actions, severity icon, and validated same-origin relative action paths.
- Added source regression checks and wired them into `ci:verify`.

## Security and architecture

- This feature does not mutate GHC, Pi, wallet, membership, rewards, or any financial ledger.
- Announcement reads are query-based rather than fanning out a notification row to every user. Registered users can see notices when they next authenticate, including across devices.
- The endpoint does not expose a client-side create path. Do not put `GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY` in a `NEXT_PUBLIC_` variable or client code. Use a long, random secret and rotate it if exposed.
- Publishing is not an admin dashboard; it is an operator endpoint protected by a server secret. A role-based internal publishing console can be added after the repository's canonical admin authorization model is confirmed.

## Operator gates

1. Apply `supabase/migrations/202610250001_gh_system_announcements.sql` to the intended Supabase project.
2. Set a strong `GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY` in the appropriate Vercel environment only if operator publishing is desired; otherwise leave it unset.
3. Deploy the API and client code together.
4. Test on Preview/Testnet with an authenticated account: publish a non-sensitive test notice, verify it appears in the notification center, mark it read, reload on a second device/session, and verify read state persists.
5. Confirm production and preview databases are correctly separated before applying migrations.

## Verification performed

Source regression tests passed:
- Feed card layout: 9/9
- Action sheet scroll: 3/3
- Notification attention: 17/17
- Vercel build repair: 9/9
- 10-phase baseline: 8/8
- System announcements: 15/15

These are source-level regression tests only. A clean install, TypeScript typecheck, ESLint run, Next.js production build, browser/device test, migration execution, and live Pi/Supabase/Vercel verification have **not** been completed in this environment. Do not label this archive production-certified or deployed.

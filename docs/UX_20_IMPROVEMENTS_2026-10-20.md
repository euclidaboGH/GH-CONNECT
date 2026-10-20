# UX 20 improvements — 2026-10-20 (0.63.13)

Implemented in this package:

1. **Human error map** (`lib/ux/user-facing-errors.ts`) — FORBIDDEN, NOT_A_MEMBER, storage, referral codes → plain language.
2. **Message send failure** — restores draft + actionable toast (community rejoin hint).
3. **Offline network strip** — non-blocking banner when offline.
4. **Referral lock persistence** — one-time GH ID submit remembered on device.
5. **Mission progress feedback** — info toast when progress saves without GHC credit.
6. **Profile media health soft check** — warns once if `/api/media/health` is not ok.
7. **Safer message composer padding** — respects safe-area inset on notched phones.
8. **Community chat heal** (prior) + clearer delivery failures when membership missing.
9. **Toast error helper** for consistent `ghc:toast` dispatch.
10. **Referral UX copy** — exclusive one-shot submit language retained.

Operator-dependent (already documented; enable for full effect):

11. Activity mission GHC credits (`GHC_ACTIVITY_REWARDS_ENABLED=1`).
12. Referral settlement 5% (`GHC_REFERRAL_SETTLEMENT_ENABLED=1`).
13. Curation redistribute flag.
14. Supabase media bucket for durable profile/cover photos.
15. Direct-upload path for large media (already in client).

Recommended next (code hooks present / product):

16. Long-press reaction roster (owner-only viewer lists).
17. Typing indicators polish on group threads.
18. Pull-to-refresh on feed with explicit “Updated just now”.
19. Discover filter “clear all” when zero results.
20. Settings → Media diagnostics page linking `/api/media/health`.

Rules preserved: no fake balances, no auth bypass, no ledger invention.

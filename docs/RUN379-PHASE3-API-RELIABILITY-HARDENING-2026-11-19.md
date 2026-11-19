# RUN379 — Phase 3 API timeout, error and abuse-control hardening

RUN379 continues RUN378 across API reliability and cross-instance abuse controls.

## Implemented

1. Added explicit 10-second abort deadlines to the 18 route modules that previously contained unbounded direct Supabase fetches: account export/lifecycle, connection accept/decline/request, GHC purchase, marketplace payout request/reconciliation, matching signal, membership activation, payment completion/fulfilment, realtime events, reports, post archive/comments/create and social tips. A follow-up scan confirms 90/90 direct route fetch call sites carry an abort signal.
2. Connection accept/decline/request and matching-signal failures now return stable no-store 503 errors rather than exposing raw upstream exception messages. Post archive timeout/network failures return a retryable 503.
3. Report intake no longer acknowledges an offline/local-only report as accepted. It returns success only after the durable moderation row is stored; missing storage, non-2xx writes and exceptions return `REPORT_SUBMISSION_UNAVAILABLE` with 503.
4. Added durable per-user limits to feed reads, realtime polling, notification reads/writes, GHC pack purchase minute and daily caps, GHC utility spends, pioneer activity, creator tips, GHPV curation, post creation, media upload completion, profile writes, step-up, session revocation, WebAuthn registration/authentication/credential deletion, push subscription/preferences writes, social comments/reactions/attention/stories/saves/shares/notifications/reputation, ad verification, and operator treasury/A2U/verification/withdrawal/refund/dispute/payout-correction actions.
5. Preserved the fast process-local throttle as an early prefilter where it already existed; the durable limiter is an additional shared cross-instance control and fails closed when unavailable for these high-risk paths.

## Verification

- RUN379 route timeout/error/rate-limit contract: 21/21.
- RUN378 complete route inventory/access classification: 9/9.
- Mutation limiter inventory: 176/186 durable; two telemetry-only local limits; eight explicitly documented disabled/worker/cron/signed-callback/retired/middleware-blocked exceptions.
- 280/280 API route files and the new Phase 4 Playwright spec pass Node TypeScript syntax parsing. This is not a dependency-backed TypeScript typecheck.

No database schema, migration history, financial ledger, payout, payment, Supabase project, GitHub branch or Vercel deployment was changed.

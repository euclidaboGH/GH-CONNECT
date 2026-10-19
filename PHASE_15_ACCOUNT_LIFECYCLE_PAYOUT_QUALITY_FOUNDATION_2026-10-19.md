# Phase 15 — Account lifecycle, payout workflow, and quality foundation

Release: 0.61.5 (repository-only)

## Implemented in source

- Added a service-role-only durable lifecycle request queue for account export and deletion. Requests are idempotent; deletion is explicitly a request, not immediate account destruction.
- Added a session-scoped, recent step-up requirement for both export requests and the direct JSON export endpoint.
- Added an owner-scoped JSON export over a fixed allowlist of GreenHaven tables. It does not accept table names from the caller, omits authentication secrets, returns no partial export if a source fails, applies rate limiting, and sends no-store headers.
- Added seller payout request intake backed by completed, payment-verified marketplace orders. An allocation ledger assigns each order to at most one payout request; requests must match the full currently eligible balance to avoid partial-order accounting ambiguity. Requests remain `requested`; this code does not execute bank, Pi, or wallet transfers.
- Added durable creator reward evaluation and content-quality signal tables. These are evaluation metadata only: no reward crediting, no vote-based minting, no GHC balance-based curation power, and no claim that a community score is truth.
- Added source regression checks and included them in `ci:verify`.

## Important limits / next integration work

- Migrations have **not** been applied to Supabase. The new endpoints return unavailable until the migration is reviewed and applied to the intended environment.
- Account export currently covers only the explicitly listed durable tables. It is not yet a complete GDPR-style export of every message, notification, device/session, external provider record, and file. Expand the allowlist after verifying each table schema and retention rules.
- Account deletion is queued, not executed. A production deletion worker must revoke sessions, preserve legally/financially required records, delete or anonymize eligible personal data, clean up storage, and verify completion before status can change.
- Seller payouts are a durable request/allocation workflow, not a disbursement rail. An operator reconciliation and verified payout adapter are still required before a request may become `paid`.
- Durable tips remain intent-only. No payment-provider confirmation and idempotent tip ledger settlement have been wired, so the API must continue to say settlement is deferred.
- Private media is **not yet end-to-end across the whole app**. Existing upload behavior and post/feed consumers still rely on URL-shaped media references. Do not make the storage bucket private or remove public URLs until post visibility authorization, media-ID persistence, signed URL refresh in feed/story/message/profile consumers, and legacy asset migration are implemented together.
- Community-quality signals and creator reward records are schemas only; no scheduled computation, ranking integration, funded pool, or settlement worker is enabled yet.
- No live database mutation, payout, deletion, Git push, or deployment was performed.

## Safety invariants

- Service-role-only tables with deny-all client RLS.
- Session-derived identity; sensitive account actions require a fresh server-side step-up.
- Seller payout amounts derive from completed + verified orders and unique order allocations. No external transfer is claimed.
- Creator reward and quality metadata do not directly mutate GHC balances. Votes do not mint GHC, wallet balances do not determine curation power, and majority is not treated as truth.

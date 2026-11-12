# Phase 8 — Rewards source completion (0.323.0)

## Delivered

- Premium Rewards Home and personalized journey retain server-confirmed GHC balance semantics.
- Daily claim flow remains authenticated, idempotent, bounded, rate-limited and server-authoritative; no client amount is trusted.
- Seven mission proofs are verified in PostgreSQL against durable community membership, post, comment, profile and connection-request rows. The meaningful-contribution milestone accepts either a live post or a live comment.
- Mission achievement unlock is persisted in `gh_user_achievements` with the existing unique `(gh_user_id, achievement_id)` constraint and a per-user/per-mission advisory transaction lock. Concurrent/replayed requests cannot create duplicate unlocks.
- Mission route derives identity from verified server auth, ignores client metadata, bounds request size, uses durable fail-closed rate limiting and calls only a service-role RPC. Outgoing and accepted connection flows request mission verification only after the corresponding server mutation is confirmed durable.
- Reward history uses the authenticated GHC wallet ledger with account isolation, bounded no-store requests, validation, sorting, search and status filters. Supplemental local activity is explicitly distinguished from ledger entries.
- Existing Pi cashback remains a separate PI workflow and does not appear as GHC issuance.

## Mission reward policy

Verified missions unlock non-financial achievements only. `grantedGhc` is always zero because generic activity/achievement issuance is disabled by the current economy policy and the database issuance guard. This increment does not weaken that guard, alter emission economics, mint GHC, execute Pi payouts, or create membership entitlements. Any future paid mission rewards require a separately approved economic-policy change, server-side cap design, abuse review and atomic ledger implementation.

## Migration

`supabase/migrations/20261106170001_phase8_verified_mission_achievements.sql` is additive. It creates a `SECURITY DEFINER` function with fixed `search_path`, validates a fixed mission allowlist, checks source rows, serializes claims, inserts an achievement idempotently and grants execute only to `service_role`. It is not auto-applied. Connection-request proof checks resolve `ghc_connection_requests` dynamically because that table is governed by a separate operator-approved migration; if it is absent, only those connection missions return unavailable while the other mission proofs remain usable. Review and test it against a disposable PostgreSQL database/Testnet, including concurrency and negative-proof cases, before deployment.

## Verification and remaining gates

- Source contracts cover SQL proof rules, route authentication, bounded body parsing, durable rate limiting, RPC-only persistence, idempotency and zero financial issuance.
- Consolidated static verification is required before packaging.
- Node 24.15.x typecheck, ESLint and Next.js production build remain required.
- Browser/device accessibility, responsiveness and performance tests remain required.
- Testnet migration application, cross-device multi-user proof tests, RLS/RPC ACL review and operator sign-off remain required.
- No database migration was applied and no live Pi, GHC payout, Testnet or Mainnet operation was performed during source work.

Phase 8 source implementation is closed; production approval remains pending external acceptance.

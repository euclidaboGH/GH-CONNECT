# Upgrade worklog — 0.330.48 (2026-11-08)

## Core reliability — Feed batch 1

Fixed a client/server ordering mismatch in equal-timestamp feed reconciliation. The canonical SQL feed uses `created_at DESC, id DESC`; the client previously used ascending IDs for ties, while the final locally sorted row is used to construct the next keyset cursor. Client ordering now matches SQL. Added runtime and source-level regression coverage and wired the new contract into the prebuild gate.

No database migration or financial, identity, visibility or moderation authority changed. See `docs/FEED-RELIABILITY-PASS-0.330.48.md`.

## Verification boundary

Pass 40 runtime: 6/6; Pass 40 source: 12/12; dedicated Feed keyset contract: 4/4. Full Node.js 24.15.0 dependency-backed typecheck, lint and production build, plus live/browser/device acceptance, remain outstanding. Production remains NOT APPROVED.

## User programme Phase 3 — Rewards & Membership (2026-11-08)

Audited the existing unified rewards ledger, daily claim/maturity and mission evidence, Pi cashback separation, paginated reward history, membership catalog, payment-intent recovery, entitlement validation, renewal and lifecycle APIs. Reused these existing authorities rather than creating parallel systems.

Added durable fail-closed per-authenticated-user rate limits to membership status (60/min), lifecycle history (60/min), payment-history reconciliation (10/min) and activation/purchase (8/min). The guards execute before privileged database/payment-history/purchase work, use only the verified server identity, and return no-store rate-limit responses. Added a 10-check source contract and registered it in both `prebuild` and `verify:static`.

Targeted source suites passed: Rewards entry 18/18, history 20/20, release gate 15/15, verified missions 31/31, Rewards/Wallet trust 17/17, deep Rewards 24/24, Membership release gate 16/16, Pi intent security 19/19, membership consumer audit 8/8, membership experience 23/23, membership transformation 31/31, membership session safety 15/15, membership foundation 18/18, new request guard 10/10. Isolated policy tests passed: Pi intent 12/12, renewal policy 15/15, entitlement row parser 14/14.

No migration, ledger, balance, entitlement or payment provider operation was changed/executed. Node 24.15.0 build/typecheck/lint, remote migration reconciliation, disposable PostgreSQL concurrency, authenticated Testnet journeys and browser/device acceptance remain open. Full Phase 3 register and gates: `docs/PHASE-3-REWARDS-MEMBERSHIP-2026-11-08.md`.

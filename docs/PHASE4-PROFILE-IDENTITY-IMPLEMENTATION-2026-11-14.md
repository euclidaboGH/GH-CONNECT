# Phase 4 — Profile & Identity implementation increment

**Date:** 2026-11-14  
**Baseline:** `GREENHAVEN-PHASE3-REWARDS-MEMBERSHIP-2026-11-14.zip`  
**Source baseline:** GreenHaven `0.338.67` lineage  
**Status:** targeted source/runtime increment delivered; full release certification remains open.

## Scope selection

This increment follows the current coordinated product roadmap's next product area after the Phase 3 Rewards & Membership work: Profile & Identity. It does not reinterpret historical engineering Phase 4 labels (which refer to unrelated work in older worklogs).

## Defect identified

`ProfileIdentityOverview` requested follower/following, reputation, and achievement data concurrently, but only checked the HTTP status of the follow endpoint. A failed reputation or achievement endpoint could therefore be converted into default values (`Seed`, zero points, zero achievements, or zero progress) and shown beside otherwise valid follower counts. This could present a partial or failed identity read as a complete identity snapshot.

## Surgical implementation

- Added `lib/domains/profile-identity-snapshot.ts` as a pure, reusable contract parser.
- The parser requires all three API payloads to declare `ok: true`.
- Counts, points, level, and progress are validated as finite, non-negative values; progress must be within 0..1 and level must be at least 1.
- Achievement results must be an array; reputation level name must be non-empty.
- Missing or malformed fields now fail the snapshot instead of being silently coerced to plausible defaults.
- A snapshot is labelled durable only when all three services explicitly return `durable: true`. Missing/unknown durability cannot be promoted to server-confirmed.
- `ProfileIdentityOverview` now checks all three HTTP responses before parsing and retains its existing abort/latest-identity response fencing and retry behavior.
- Added static and runtime regression tests and registered both in `prebuild:checks` and `verify:static`.

## Verification

| Check | Result |
|---|---:|
| New snapshot contract regression | 13 assertions passed |
| New static wiring/security contract | 8/8 |
| Priority 5 Profile transformation | 13/13 |
| Profile performance and account-switch fencing | 20/20 |
| Canonical public identity hydration | 16/16 |
| Profile identity baseline | 8/8 |
| Professional identity showcase | 13/13 |
| Premium profile experience | 9/9 |
| Profile & matching relationship contract | 14/14 |
| Feed/profile integration and privacy fencing | 48/48 |
| Public profile privacy projection | 16 assertions passed |
| Relationship index runtime contract | 16 assertions passed |

**Total: 186 targeted assertions/checks passed.** These tests validate source contracts and isolated runtime behavior only; they are not a complete application build or live infrastructure acceptance.

## Not performed / release blockers

- The available runtime is Node `v22.16.0`; the project requires Node `24.15.x`. Node 24 dependency installation, typecheck, lint, full prebuild, and production build were not run.
- No disposable PostgreSQL restore/concurrency drill was run.
- No Testnet database mutation, migration replay, schema/RLS change, or authenticated two-account/device test was performed.
- No deployment, promotion, or Mainnet operation was performed.
- Public profile privacy and cross-account isolation still require live multi-user and device acceptance.

## Financial and security boundaries

No wallet, GHC ledger, Pi payment, membership entitlement, reward claim, withdrawal, payout, or settlement logic was modified. Pi-funded GHC acquisition, paid business checkout, issuance, settlement, withdrawals and payouts remain gated. Public profile projection remains privacy-authoritative; wallet and membership details must not enter public profile payloads.

## Files changed

- `components/ghc/profile-identity-overview.tsx`
- `lib/domains/profile-identity-snapshot.ts`
- `scripts/check-phase4-profile-identity-snapshot.mjs`
- `scripts/test-phase4-profile-identity-snapshot.mjs`
- `package.json`
- `docs/PHASE4-PROFILE-IDENTITY-IMPLEMENTATION-2026-11-14.md`

# GreenHaven 0.278.0 — Phase 1 Truth & Honesty

Date: 2026-11-03

## Scope

Product truth fixes from live Preview audit: Communities My/Discover honesty, Discover follow state, marketplace self-buy UX, wallet earnings loading timeout.

## Changes

### Communities
- My tab no longer applies Discover privacy/category filters (search still works).
- Empty-state copy distinguishes: no memberships, search miss, already-in-all-discoverable.
- After directory load, seed `localJoined` from owner/member rows so My (n) matches visible list.

### Discovery
- Follow/unfollow routes through `ghc.followUser` so session `following[]` updates and cards leave the pool.
- Candidate list deduped by person id.

### Marketplace
- `CANNOT_BUY_OWN` humanized; cart flags own listings; checkout blocked when only own items.

### Wallet / PI earnings
- Unified earnings refresh hard-timeouts at 12s and fails closed with Retry.

## Verification

`node scripts/check-phase1-truth-honesty.mjs` — 13/13 PASS

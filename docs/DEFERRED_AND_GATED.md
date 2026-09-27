# Deferred and fail-closed surfaces (not TODOs)

This repository intentionally leaves some product surfaces **gated or fail-closed**.  
These are **not** incomplete Phase 14/15 implementations and must **not** be turned into fake success paths.

## Source markers

A tree-wide scan of `app/`, `lib/`, `components/`, `contexts/`, `features/`, and `scripts/` found **no** `TODO:` / `FIXME:` comment markers as of the last documentation pass.

## Fail-closed / gated APIs

| Surface | Behavior | Safe activation prerequisite |
|---------|----------|------------------------------|
| Pi staking `GET/POST /api/pi/staking` | Returns `available: false` / `api_not_wired` when Platform API is not confirmed | Official Pi staking endpoint docs + secure server integration |
| Pi Ads verify `POST /api/ads/verify` | `ADS_VERIFY_NOT_IMPLEMENTED`, `rewardAuthorized: false` | Authoritative provider verification + reward policy (no client mint) |
| Tip settlement | Intents only; settlement deferred | Existing payment/ledger path + operator policy |
| Introduction **send** | Contract may exist; send not implemented | Product decision + durable pipeline |
| Messaging durable flag | Off until IDOR pass | Two-user messaging tests + `NEXT_PUBLIC_MESSAGING_DURABLE` |
| Connection request intents migration | File present; **REQUIRES_APPROVAL** | Security review then apply |
| Community join-reason / governance-log migrations | **PROPOSAL** — do not apply by default | Explicit product approval |

## UI “Coming soon”

Ecosystem / discovery cards labeled **Coming soon** are informational only. They must not call fake backends or mint balances.

## Legacy modules

| Path | Note |
|------|------|
| `components/ghc/home-screen-stub.tsx` | Legacy stub; app uses `EnhancedFeedScreen` |
| `components/ghc/screens-complete.tsx` | Re-exports stub for module parse compatibility |

Do not treat stubs as active product surfaces.

## Phases

| Phase | Status |
|------:|--------|
| 1–13 | Source-implemented |
| 14–15 | **Not started** |

See `docs/PHASE_IMPLEMENTATION_STATUS.md` and `docs/TESTNET_VERIFICATION_GATE.md`.

## Legacy ChatScreen

| Path | Status |
|------|--------|
| `components/ghc/chat-screen.tsx` | **Legacy / unused** by active shell |
| `components/ghc/index.ts` export | Compatibility re-export only |

Hard-coded mock featured/suggested groups (fabricated names and member counts) were **removed**.  
The component renders an honest empty state if ever imported. Active messaging/communities must use durable server-backed surfaces, not this file.

## Discovery helpers (not fabricated catalogs)

| Path | Behavior |
|------|----------|
| `lib/discovery-search-utils.ts` | Filters **caller-supplied** people/posts/communities/businesses arrays — does not invent rows |
| `lib/discovery-features-engine.ts` | Ranks/filters supplied candidates; distance uses `candidate.distance` when present |

Comments previously said “mock”; wording corrected to describe filter-over-supplied-data behavior.

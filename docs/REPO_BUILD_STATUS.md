# GH-Connect repository build status

**Updated:** 2026-10-06 — FINAL REPOSITORY GATE

This document uses precise status terms only. It does **not** claim the product is production-ready.

---

## Terminology

| Term | Meaning |
|------|---------|
| **REPOSITORY IMPLEMENTATION COMPLETE** | Source implemented and covered by local static/unit tests |
| **TESTNET VALIDATION REQUIRED** | Needs confirmed Testnet Postgres/Supabase runtime proof |
| **PRODUCTION VALIDATION REQUIRED** | Needs deploy, env, full install/typecheck/build, ops |
| **INTENTIONALLY DEFERRED** | Deliberately not built yet |
| **FAIL-CLOSED** | Interface/intent exists; money or durable success cannot be claimed without full backend |

---

## Value architecture (preserved)

```
Reactions          → engagement counts only
Curation           → quality judgment
GHPV               → weighted community review / system settlement / calibration
Reputation         → durable contribution points (server catalog)
Reputation Level   → levels 1–15; bounded curation influence only
XP / Reward Level  → Bronze–Diamond presentation progression
GHC                → authorized economy RPCs only
Tips               → intent until settlement is implemented
```

**No** vote → reputation → GHC loop.  
**GHC balance ≠** reputation level **≠** reward level **≠** curation power.

### Two level systems

1. **Reputation Level 1–15** — durable `gh_reputation_*`; API `/api/social/reputation`; UI badge loads server state; labeled “Trust signal only · not currency”.
2. **Activity / Reward Level (Bronze–Diamond) + XP** — presentation/domain progression; not wallet authority; not client-authoritative for money.

### Browser storage

- Domain reputation/XP may use localStorage for Studio/demo.
- Production reputation display uses `socialFetchReputation` → server API.
- Trust adapters document: do not treat localStorage reputation as production authority.

---

## REPOSITORY IMPLEMENTATION COMPLETE

- Session-bound social mutations (reactions, curation, follows, comments)
- Production fail-closed social writes when durable DB missing
- GHPV active weights, settlement (system-only), calibration bounds, soft-delete cleanup
- Reputation catalog + durable apply/get RPCs
- Tip **intent** creation (self-tip blocked; settlement deferred)
- GHC economy paths (claims, transfers, spend) via existing RPCs
- Static suites: GHPV, economy, IDOR, production safety, value boundaries

## TESTNET VALIDATION REQUIRED

- Apply migrations `20261013`–`20261020` (and prerequisites) on confirmed Testnet only
- Live RLS denial, two-user IDOR, vote replace/neutralize, soft-delete cleanup
- Concurrent settlement, internal-key settlement, calibration once, deleted-content settlement rejection
- Live GHC concurrency for economy migrations already reviewed in prior phases

## PRODUCTION VALIDATION REQUIRED

- Complete `npm` install on a machine with network/disk capacity
- Typecheck, lint, production build
- Vercel Preview/Production env pairing (Pi sandbox vs mainnet, Supabase project)
- Server-only `GH_SETTLEMENT_INTERNAL_KEY`
- Operational settlement worker/cron (if/when enabled)

## INTENTIONALLY DEFERRED

- CQI as primary feed ranking
- Vote-to-GHC
- Creator quality pool / automatic creator payouts from GHPV
- Tip financial settlement completion
- Pi ad reward verification; Pi staking fetch
- Post restore after soft-delete

## FAIL-CLOSED

- Tip settlement (intent only; UI must not claim paid/completed funds)
- Social mutations without durable DB in production (`STORE_UNAVAILABLE`)
- Settlement without valid internal key
- Creator program large rewards without operator revenue flag

---

## Local test results (this gate)

| Suite | Result |
|-------|--------|
| Value system boundaries | PASS 22/22 |
| GHPV economic safety | PASS 22/22 |
| IDOR static | PASS 121/121 |
| Production safety scan | PASS |
| GHPV foundation | PASS 14/14 |
| GHPV active weight | PASS 47/47 |
| GHPV settlement | PASS 23/23 |
| GHPV calibration | PASS 18/18 |
| GHPV soft-delete | PASS 16/16 |
| Economy v12 | PASS 173/173 |
| Typecheck | **BLOCKED** (incomplete node_modules in gate environment) |
| Lint | **BLOCKED** |
| Production build | **BLOCKED** |

---

## Next phase

Controlled **Testnet validation** only after operator confirms Testnet project identity.  
No Production deployment from this gate.
## Notifications (2026-10-06)
- Durable social notifications extended (curation, reputation_level_up, system)
- Migration 20261021 repository-only
- NotificationBell prefers durable API; tests 24/24

## Build hardening (2026-10-07)

- CurationChoice canonical values: `upvote` | `downvote` | `neutral` (type guard on API)
- isomorphic-dompurify@3.20.0 retained (matches lockfile; requires Node ≥22.22.2 — project engines allow 20–24; Vercel Node 22+/24 satisfies). ACCEPTED deprecation warning — no forced major upgrade
- engines: `>=20.18.0 <25`; `.nvmrc` = 20
- Recharts 2.15.4 retained — no Recharts 3 migration in this pass (API changes required; charts non-critical)
- ESLint: explicit `@next/eslint-plugin-next` + `next/core-web-vitals` via FlatCompat

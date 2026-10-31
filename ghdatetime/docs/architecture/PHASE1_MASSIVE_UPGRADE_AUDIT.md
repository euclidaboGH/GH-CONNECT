> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# GreenHaven v0.212.0 → Phase 1 Massive Upgrade — Architecture Audit

**Source of truth:** `GH-CONNECT-0.212.0-PHASE5-WALLET-RELEASE-GATE-2026-10-30`  
**Mode:** Upgrade in place — not a rewrite.

## Scale (source counts)

| Area | Count |
|------|------:|
| App TS/TSX | ~228 |
| API `route.ts` | **215** |
| Components | ~171 |
| Features | ~27 |
| Lib modules | ~431 |
| Migrations SQL | **168** |
| Static check scripts | ~168 |
| `contexts/ghc-context.tsx` | **8542 lines** |

## Architecture before

```
UI screens (large)
  → ghc-context (monolithic provider + partial sub-contexts)
  → domain modules (lib/domains/*)
  → API routes (~215, mostly shared auth/rate-limit/bounded JSON)
  → lib/server/* (economy, earnings, identity, marketplace, messaging, media)
  → Supabase / Pi providers
```

Partial decompositions already present:
- `contexts/domains/*` (wallet-read, feed, messaging, notifications, discovery, connections)
- `useGHCShell|Profile|Discovery|Messaging|Feed|Community` splits inside ghc-context
- `lib/server/economy/{auth,http,rate-limit,env}` conventions
- Fail-closed memory ledger (`allowMemoryServer`)
- Registration bonus / PI withdraw request gates

## Architecture after (Phase 1 target — incremental)

```
UI
  → feature/domain hooks + bounded providers (read-only financial)
  → typed API contracts
  → server domain services (lib/server/*)
  → repositories/adapters
  → Supabase / Pi
```

**Delivered in this phase:**
1. `lib/server/http/api-conventions.ts` — request IDs, financial no-store, sanitized errors
2. `lib/architecture/domain-ownership.ts` — explicit domain authority map
3. Economy `jsonOk`/`jsonErr` **default no-store** (hardens all consumers)
4. Migration readiness classification model (below)
5. Audit findings + Phase 2 handoff

**Not done (deferred Phase 2+):** full ghc-context split, screen decompositions, E2E expansion, live DB concurrency tests.

---

## Findings

### P0 — security / money / release critical

| ID | Finding | Status |
|----|---------|--------|
| P0-1 | Client must never be financial authority | **Protected** in wallet/earnings paths; continue audits on marketplace totals |
| P0-2 | Mainnet A2U must stay disabled by default | **OK** — env defaults fail-closed |
| P0-3 | Memory GHC ledger on Vercel/production | **Blocked** by `allowMemoryServer()` |
| P0-4 | Financial HTTP caching | **Hardened** — `jsonOk`/`jsonErr` default no-store |
| P0-5 | Service-role claim RPCs public | **OK** — registration bonus REVOKE/GRANT service_role only |
| P0-6 | JWT without exp accepted | **OK** — auth rejects missing/invalid exp |

### P1 — reliability / architecture

| ID | Finding | Status |
|----|---------|--------|
| P1-1 | `ghc-context.tsx` ~8.5k lines | **Deferred** — sub-contexts exist; full split is Phase 2 |
| P1-2 | Marketplace screen ~2.6k lines | Phase 2 domain hooks |
| P1-3 | Wallet screen ~2.4k lines | Partially dual-asset; further split Phase 2 |
| P1-4 | ~41 economy/marketplace routes lacked explicit no-store before helper default | **Mitigated** via `jsonOk`/`jsonErr` |
| P1-5 | Some routes return `error.message` slices | Bounded length; further sanitize Phase 2 |
| P1-6 | Migrations SOURCE vs APPLIED not equivalent | Documented; operator must apply |

### P2 — maintainability / performance

| ID | Finding | Status |
|----|---------|--------|
| P2-1 | Global provider rerenders | Partial shell/feed splits; deeper isolation Phase 2 |
| P2-2 | 215 routes — repeated boilerplate | 174 already share auth/rate-limit/bounded JSON |
| P2-3 | Large post-card / feed modules | Phase 2 UI |
| P2-4 | Limited browser E2E vs static contracts | Expand in testing phase |

### P3 — cleanup / debt

| ID | Finding | Status |
|----|---------|--------|
| P3-1 | ~18 TODO/FIXME markers | Low; triage individually |
| P3-2 | Deprecated stellar SDK warnings upstream | Dependency upgrade later |
| P3-3 | Demo policy module present | Fail-closed production policy; keep |

---

## Financial invariants (protected)

1. PI and GHC are **never summed** as one balance.
2. Registration bonus amount is **server/RPC-only** (3 π / 2.95 π top-up).
3. Withdraw request does **not** equal paid; A2U execute is separate and Testnet-gated.
4. Withdrawal fee **3%** server-quoted.
5. Client success toasts cannot invent ledger rows.
6. Idempotency keys required for payout requests.

---

## Migration readiness states

Never equate these:

| State | Meaning |
|-------|---------|
| SOURCE EXISTS | File under `supabase/migrations/` |
| STATICALLY VERIFIED | Contract scripts / inventory checks |
| DATABASE APPLIED | Operator applied to a specific Supabase project |
| RUNTIME VERIFIED | App successfully calls RPCs against that DB |
| TESTNET VERIFIED | End-to-end Testnet money path proven |
| PRODUCTION VERIFIED | Mainnet gate (not this release) |

**Registration bonus migration:** SOURCE + STATIC — operator must APPLY for live credit.

---

## Commands (this environment)

| Command | Result |
|---------|--------|
| Phase 1–5 wallet gates | PASS (prior) |
| `npm ci` / typecheck / build | **BLOCKED** if not run in this session — report honestly after attempt |
| Live Supabase / Pi A2U | **BLOCKED** — no deploy |

---

## Phase 2 handoff

1. Split `ghc-context` by domain ownership (wallet mutations out of global tree).
2. Decompose marketplace / community / profile screens into feature modules + hooks.
3. Sanitize remaining provider error strings through `sanitizeClientMessage`.
4. Add API contract types for economy/marketplace mutations.
5. Expand Playwright journeys: auth, claim, withdraw request, marketplace purchase, membership recovery.
6. Optional: additive migration only if RLS/privilege gaps found on Testnet apply.

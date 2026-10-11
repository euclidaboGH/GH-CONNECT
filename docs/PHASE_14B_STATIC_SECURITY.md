# Phase 14B — Static security review & test corrections

**Completed:** 2026-10-10T09:00:25Z  
**Scope:** Static only. No database writes. No design changes. No economy logic changes.

---

## 1. Social authz failures (resolved)

Prior scan: **27 pass / 3 fail**

| Route | Reality | Fix |
|-------|---------|-----|
| `GET .../posts/[id]/ghpv` | Public quality snapshot; no private calibration | Allowlisted as public GET-only |
| `GET .../posts/[id]/reward` | Public reward view; no mutation | Allowlisted as public GET-only |
| `POST .../posts/[id]/ghpv/settle` | System-only; `GH_SETTLEMENT_INTERNAL_KEY` + timing-safe compare | Allowlisted as system-key auth |

**Change:** `scripts/test-social-authz.mjs` access-policy assumptions corrected (not route weakening).

Re-run: **30 pass / 0 fail**.

---

## 2. Suites re-run (this environment)

| Suite | Result |
|-------|--------|
| `test-social-authz.mjs` | 30/30 pass |
| `test-idor-static.mjs` | 122/122 pass (110 routes) |
| `test-messaging-authz.mjs` | 12/12 pass |
| `scan-production-safety.mjs` | 21/21 pass |
| `test-ghpv-economic-safety.mjs` | 22/22 pass |
| `test-content-reward-boundaries.mjs` | 20/20 pass |
| `test-pi-payment-durable.mjs` | 40/40 pass |

---

## 3. What was NOT done

- No live Supabase / Pi Browser tests
- No typecheck/build (incomplete node_modules in sandbox)
- No RLS policy changes
- No route authorization removed from user-mutating endpoints

---

## 4. Next

- **14C** — clean install + typecheck + lint + build on operator machine
- **14D** — Testnet schema vs migration checklist
- **14E** — two-user + Pi E2E

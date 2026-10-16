# GREENHAVEN — MASTER ENGINEERING REPAIR & HARDENING SPECIFICATION

**Audience:** Coding agents (e.g. Grok) and human operators  
**Product:** GreenHaven (GH-Connect)  
**Package version:** 0.59.4  
**Document role:** Technical handover + authoritative repair rules  
**Not:** A redesign brief or Phase 15 product roadmap

---

## 0. Strict instructions (read first)

Do **not**:

- Redesign GreenHaven or replace working architecture  
- Create duplicate financial ledgers, payment systems, user systems, or auth stacks  
- Weaken RLS, ACL, or authorization to “make tests pass”  
- Trust client-supplied `userId`, prices, balances, roles, ownership, or payment status  
- Invent migrations or delete/rewrite historical migration files to clean history  
- Claim Testnet/Mainnet/Pi E2E success without execution  
- Start Phase 15 product features until CI + Testnet + IDOR + Pi E2E gates pass  

Do:

- Inspect existing implementation **before** changing code  
- Prefer the **smallest safe correction** for a demonstrated defect  
- Fail closed when security configuration or durable DB is missing in production  
- Report exactly what changed, files touched, and verification results  

---

## 1. Project identity and architecture

| Layer | Implementation |
|-------|----------------|
| Product name | **GreenHaven** (GH-Connect) |
| Frontend | Next.js **15.5.x** App Router, TypeScript, React |
| Deploy | **Vercel** — Production = Mainnet; Preview = Testnet |
| Database | **Supabase** / PostgreSQL — service-role on server only |
| Identity | Pi Network SDK → server `/me` verify → GH session (HttpOnly) |
| Economy | **GHC** internal ledger (not public crypto) |
| Payments | Pi U2A intents → approve → complete → fulfill; server-authoritative |
| Canonical user id | GH internal `userId` from session / verified Pi mapping |

### Environment separation

```text
TESTNET                         MAINNET
Vercel Preview                  Vercel Production
     ↓                               ↓
Testnet Pi app                  Mainnet Pi app
     ↓                               ↓
Testnet Supabase                Mainnet Supabase
```

No cross-environment credentials, databases, or Pi secrets.

---

## 2. Non-negotiable engineering rules

1. Server-side validation for every sensitive operation  
2. Session-derived actor — never body/`userId` as authority  
3. GHC balances and membership are **server-authoritative**  
4. Historical migrations are append-only; never rewrite applied history casually  
5. Financial memory fallback blocked in production when DB is configured  
6. `/api/**` must remain **network-only** in the service worker (no stale financial cache)  
7. Fail closed on missing `PI_API_KEY`, service role, or durable write requirements in production  

---

## 3. Problem / fix register (known items)

### P-BUILD-001 — Creator profile TypeScript build failure

| Field | Content |
|-------|---------|
| **Problem** | Vercel `next build` fails typecheck |
| **Observed** | `app/api/social/creator/route.ts`: Property `exists` does not exist on `{ ok: true }` |
| **Root cause** | `getCreatorProfile` returned `{ ok: true, ...r.data }` with `r.data` as `Record<string, unknown>`; TS did not surface `exists` |
| **Required fix** | Explicit typed success shape with `exists`, `displayName`, `tagline`, `bio`, `isEnabled`, `tipsEnabled` |
| **Implementation** | `lib/server/creator/store.ts` — `CreatorProfileResult` / `getCreatorProfile` maps RPC fields |
| **DB/RLS** | None (RPC `gh_creator_get` already returns `exists`) |
| **Security** | Unchanged; session actor still required at route |
| **Verification** | `npm run build` / Vercel typecheck must pass this file |
| **Status** | Fixed in tree (post-Vercel log) |
| **Do not regress** | Do not reintroduce untyped `...r.data` success return |

### P-PAY-001 — Payment complete without durable owned intent

| Field | Content |
|-------|---------|
| **Problem** | Complete could proceed without strong intent/ownership binding |
| **Required fix** | AUTH required; durable intent required; `intent.userId === auth.userId`; then Pi complete |
| **Files** | `app/api/payments/complete/route.ts` |
| **Verification** | `node scripts/test-pi-payment-durable.mjs` (section 6) |
| **Status** | Hardened in source |
| **Do not regress** | Never call `piCompletePayment` before auth + intent ownership checks |

### P-PAY-002 — Incomplete recovery payer binding

| Field | Content |
|-------|---------|
| **Problem** | Orphan recovery must not bind another user’s payment |
| **Required fix** | Verify Pi payer via identity mapping before intent create/bind |
| **Files** | `app/api/payments/incomplete/route.ts` |
| **Status** | Hardened (`PI_PAYER_UNVERIFIED` path) |

### P-UI-001 — Legacy ChatScreen fabricated groups

| Field | Content |
|-------|---------|
| **Problem** | Hard-coded fake groups/member counts |
| **Required fix** | Empty fail-closed lists; legacy comment |
| **Files** | `components/ghc/chat-screen.tsx` |
| **Status** | Fixed; not used by active shell |
| **Do not regress** | Do not restore mock featured groups |

### P-DOC-001 — Phase 14/15 honesty

| Field | Content |
|-------|---------|
| **Phase 14** | Production **hardening only** — `docs/GH_PHASE_14.md` |
| **Phase 15** | Preparation only — `docs/GH_PHASE_15_PREPARATION.md`; **not implemented** |
| **Do not** | Claim Mainnet ready from automated suites alone |

---

## 4. Authentication

- Entry: Pi SDK → server verifies with Platform API  
- `resolveAuthenticatedUser(headers)` is the API authority  
- Durable: `gh_pi_identities`, `gh_sessions`  
- Returning users must not be forced through full onboarding when `onboarded` is durable true  
- Development auth must not enable privileged bypass in Production  

**Do not:** accept client `userId` as the authenticated actor.

---

## 5. Payments

Flow: intent create → approve → complete → fulfill → (membership grant from server intent only)

| Invariant | Rule |
|-----------|------|
| Auth | Unauthenticated complete → 401 |
| Intent | Missing durable intent → reject |
| Ownership | User A cannot complete User B’s intent |
| Amount | Must match durable intent |
| Idempotency | Duplicate complete/fulfill must not double-grant |
| Membership | Grant only from completed server-side intent for owner |

Tests: `scripts/test-pi-payment-durable.mjs`

---

## 6. GHC financial system

- Canonical ledger tables + RPCs (migrations `20260821` … economy series)  
- Balance derived server-side; **no client-authoritative balance**  
- Idempotent claims/spends; advisory locks where implemented  
- RLS deny-all client access on financial tables; service_role RPCs only  
- Withdrawal module: request/lock/settle — operator settle only (`docs/GH_WITHDRAWAL_PI_SETTLEMENT.md`)  

**Do not:** mint GHC from social engagement endpoints.

---

## 7. Membership

- Tiers: FREE / VIP / VVIP  
- Activation via `grantEntitlement` after verified payment  
- Status from `/api/membership/status` + durable entitlements table  
- UI must not invent VIP from local payment history alone  

---

## 8. Profiles

- Durable `gh_user_profiles`  
- Hydration must respect server empty arrays and onboarded flags  
- Photos/media via durable media path where Phase 8 applies  

---

## 9. Social system (Phases 1–13 source)

| Capability | Notes |
|------------|--------|
| Reactions | Multi-type allowlist; session actor |
| Attention | Measurement only — no rewards |
| Curation | Upvote/downvote quality signal — no money |
| Reputation | Informational levels — no client self-award without proof |
| Shares / mentions | Durable + notifications; rate limits process-local |
| Search | Server RPC; visibility/blocks |

Financial isolation permanent: engagement ≠ ledger writes.

---

## 10. Messaging

- Durable tables/migrations present  
- Enable `NEXT_PUBLIC_MESSAGING_DURABLE` **only after** two-user IDOR  
- Session membership authorization; no cross-user conversation access  

---

## 11. Communities

- Core create/join migrations present  
- Proposal migrations (`join_reasons`, `governance_log`) — **do not apply** without approval  
- Admin approval/rejection must prevent self-approval of restricted actions  

---

## 12. Marketplace

- Seller ownership on listings  
- Orders: buyer/seller authorization  
- Prices server-validated; no client price authority on settlement  

---

## 13. Creator Studio / tips

- Profile + content insights: non-financial  
- Tip **intents** only; **settlement deferred**  
- `GET/POST /api/social/creator` — session only; ignore body `userId`  

---

## 14. Reputation

- Server proof required for awards (`lib/server/reputation/verify.ts` pattern)  
- Client event type alone is **never** proof  

---

## 15. Security hardening

- RLS deny client on sensitive tables  
- RPC `REVOKE PUBLIC` + `GRANT service_role`  
- Rate limits: in-process Map (not global edge quota)  
- Secrets: never `NEXT_PUBLIC_` for `PI_API_KEY` / service role  
- Staff/admin: separate ops boundary if present; no self-elevation  

---

## 16. Service worker

`/api/**` must be **network-only**. Cached API responses must not masquerade as current wallet/membership/session state.

---

## 17. Supabase migrations

**Canonical count: 54** under `supabase/migrations/`

| Class | Count | Action |
|-------|------:|--------|
| REQUIRED | 51 | Apply oldest → newest on Testnet |
| REQUIRES_APPROVAL | 1 | `20260905_connection_request_intents.sql` |
| PROPOSAL | 2 | `20260906_*`, `20260907_*` — do not apply by default |

Full inventory: `docs/MIGRATION_CHECKLIST.md`  
Machine list: `node scripts/print-migration-checklist.mjs`

Filenames are **sequence ids**, not calendar proof of deployment.

---

## 18. Testnet migration procedure

1. Inspect local vs remote  
2. Identify pending REQUIRED migrations  
3. Read SQL; no destructive surprises  
4. Apply oldest → newest  
5. Verify tables/RLS/RPCs (`to_regclass`, health)  
6. Application + payment + social smoke  
7. Mainnet only after Testnet evidence  

**Do not** casually rewrite migration history.

---

## 19. Vercel / CI

```bash
npm ci --legacy-peer-deps
npm run typecheck   # or next build type phase
npm run lint
npm run test:safety
npm run build
```

Known non-blockers (do not `npm audit fix --force` casually):

- Deprecated transitive packages warnings  
- ESLint Next plugin config warning  
- `short-video-screen` exhaustive-deps warnings (non-fatal)  

Environment matrix: `VERCEL_DEPLOY.txt`, `SAFE_TO_PUSH.md`  
**Safe to push ≠ production ready.**

---

## 20. Testnet / Mainnet isolation

| | Preview / Testnet | Production / Mainnet |
|--|-------------------|----------------------|
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | `false` |
| Pi Client ID / API key | Testnet app | Mainnet app |
| Supabase | Testnet project | Mainnet project |
| Domain validation | Matching host | Matching host |

---

## 21. Verification matrix (evidence-based)

| Area | Code | Automated | Testnet | Mainnet |
|------|------|-----------|---------|---------|
| Pi auth / session | ✓ | Partial | Operator | Operator |
| Payment ownership | ✓ | `test-pi-payment-durable` 40/40 | Operator | Operator |
| GHC ledger | ✓ | Economy suites | Operator | Operator |
| Membership grant | ✓ | Static paths | Operator | Operator |
| ChatScreen mocks | ✓ | Manual/source | N/A | N/A |
| Creator route types | ✓ | Build | Operator CI | Operator CI |
| Migrations applied | SQL present | Checklist script | **Operator** | **Operator** |
| Two-user IDOR | Checklist doc | Print-only | **Operator** | **Operator** |
| Pi Browser E2E | — | — | **Operator** | **Operator** |

---

## 22. Phase status

| Phase | Status |
|------:|--------|
| 1–13 | Source-complete |
| 14 | Production hardening defined + automated verification |
| 15 | Preparation only (`docs/GH_PHASE_15_PREPARATION.md`) — **not implemented** |

---

## 23. When a live gate fails

1. Fix **only** the demonstrated defect  
2. Re-run the **affected** verification  
3. Do not expand into Phase 15 or redesign  
4. Report files changed and evidence  

---

## 24. Key file index

| Path | Role |
|------|------|
| `lib/server/economy/auth.ts` | Session actor resolution |
| `lib/server/payments/intent-store.ts` | Durable payment intents |
| `app/api/payments/complete/route.ts` | Complete + ownership |
| `app/api/payments/incomplete/route.ts` | Recovery + payer bind |
| `lib/server/creator/store.ts` | Typed creator profile |
| `docs/MIGRATION_CHECKLIST.md` | Migration classes |
| `docs/TESTNET_VERIFICATION_GATE.md` | Operator gate |
| `docs/GH_PHASE_14.md` | Hardening scope |
| `docs/DEFERRED_AND_GATED.md` | Fail-closed surfaces |
| `SAFE_TO_PUSH.md` | Push ≠ Mainnet |

---

*End of master specification. Prefer this document over older contradictory audit narratives when they conflict with the current tree.*

---

## 25. Reconciliation stamp (2026-09-27)

| Item | Status |
|------|--------|
| Creator `getCreatorProfile` typed `exists` | **FIXED** in `lib/server/creator/store.ts` — required for Vercel `next build` |
| Payment complete AUTH+INTENT+ownership | **IMPLEMENTED** — do not regress |
| Incomplete Pi payer binding | **IMPLEMENTED** — do not regress |
| ChatScreen mock groups | **FIXED** — empty fail-closed |
| SW `/api/**` sensitive network-only prefixes | **IMPLEMENTED** in `public/sw.js` |
| A2U complete | **GATED** — requires admin key; not production-open |
| Migration `20261005_gh_post_shares.sql` | Filename is **shares** (plural), not `gh_post_share.sql` |
| Local migrations | **54** |
| Phase 15 | **Not started** |
| Testnet apply / IDOR / Pi E2E / Mainnet | **OPERATOR — VERIFICATION REQUIRED** |

When reconciling, prefer this stamp + live `supabase migration list` over older 36/39 migration counts from prior archives.

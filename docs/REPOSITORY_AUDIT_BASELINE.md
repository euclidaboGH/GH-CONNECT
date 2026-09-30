# GreenHaven — Repository audit baseline

**Tree audited:** working copy under artifacts/gh-connect  
**Not:** automatic claim that Windows `Documents\GH-CONNECT` is identical — re-ZIP if diverged  
**Date:** 2026-09-27  
**Method:** Structural inventory + security pattern scan + high-risk path review. Not every line of every file.

## 1. Inventory

| Category | Count |
|----------|------:|
| Project source files (excl. node_modules/.next) | ~806 |
| TypeScript / TSX | 577 |
| API route.ts | **105** |
| Components | 123 |
| lib/*.ts | 300 |
| Migrations | **54** |

Package: gh-connect@0.59.4 · Next 15.5.26

## 2. API auth

| Metric | Count |
|--------|------:|
| With resolveAuthenticatedUser / AUTH_REQUIRED | 96 |
| Without session auth | 9 |

### Routes without session auth (reviewed)

- auth/pi, auth/session, auth/logout — auth lifecycle
- health, economy/health, payments/health — public probes
- validation-key — Pi domain validation (DOMAIN_VALIDATION_KEY; intentionally public plaintext)
- verification/review — privileged; GHC_VERIFICATION_SERVER + secret header (not session)

## 3. Migrations

54 files. Classification: 51 REQUIRED · 1 REQUIRES_APPROVAL · 2 PROPOSAL.

Do not use older "39 migration" narratives for this tree.

## 4. Findings severity

### P0 (Mainnet claim blockers — environment)

- Typecheck/build not proven in this sandbox (incomplete node_modules / npm ci timeout)
- Testnet migration apply not verified here
- Two-user IDOR / Pi Browser E2E not run here

### P1 (design risks — verify live)

- Admin credit accepts body.userId **only with** GHC_ADMIN_CREDIT_KEY (timing-safe)
- Community decide uses body applicantId; actor is session; self-decide blocked; RPC enforces admin
- Rate limits are process-local (not global multi-instance)
- Messaging durable flag must stay off until IDOR

### P2 (TS contracts — fixed in tree)

- Creator getCreatorProfile exists typing — FIXED
- Withdrawal rpcJson discriminated union — FIXED
- Reputation restGet failure data:null — FIXED

### P3

- Dependency deprecations (eslint/recharts/dompurify) — deliberate later upgrade
- A2U disabled by design; staking not enabled
- Phase 15 not implemented

## 5. Authority model

Client claim → session actor → authorization → validation → RPC/DB → durable state → refresh

Financial: Pi proof → intent ownership → complete → fulfill → ledger/membership (idempotent)

## 6. Do not regress

Payment ownership before complete; incomplete payer bind; SW API network-only; RLS financial deny-all; no client balance authority; ChatScreen empty groups; no audit fix --force during stabilization

## 7. Line-by-line claim

**Not claimed.** Inventory + high-risk sampling completed. Continue with targeted passes or re-audit if Windows tree differs.

## 8. Order of work

1. npm ci → typecheck → lint → build
2. Testnet migration list/apply
3. IDOR + Pi E2E
4. Phase 15 only after gates + explicit track selection

## 9. Uploaded ZIP reconciliation (2026-09-27)

| Archive | Content | Result |
|---------|---------|--------|
| 1414.zip | scripts/ | Identical to current |
| 2424.zip | lib/ | 3 server files differed |
| 3434.zip | supabase migrations | Renumbered IDs only — **not applied** (history conflict risk) |
| 4444.zip | public/ | Identical including sw.js |

**Adopted from 2424:** `lib/server/creator/store.ts`, `lib/server/reputation/verify.ts`

**Kept current:** `lib/server/economy/withdrawal.ts` (better TS narrowing than ZIP)

**Not adopted:** renumbered migrations from 3434

## 10. Archives 909099.zip + ghcclatest.zip (2026-09-28)

| Archive | Role | Result |
|---------|------|--------|
| **909099.zip** | docs (60 files) | Content **matches** current docs; no new/better docs |
| **ghcclatest.zip** | Full project snapshot (~894 source files) | **Near-identical** to current tree |

### ghcclatest content comparison (excl. migrations)

| File | Verdict |
|------|---------|
| Creator store, reputation verify, payment complete, auth, intent-store, sw.js, package.json | **SAME** as current |
| `lib/server/economy/withdrawal.ts` | ZIP is **older** (weaker TS guards) — **keep current** |
| `components/ghc/short-video-screen.tsx` | ZIP lacks eslint cleanup — **keep current** |
| Renumbered migrations (`202609040001_…`) | Parallel rename set — **do not replace** history |
| Root `verify.ts` | Misplaced outdated reputation helper — **do not copy to project root** |
| Scripts / MASTER docs | Present in **current only** — preserve |

**Action taken:** No code overwrite from these two ZIPs (would regress TypeScript/hardening). Current tree remains the superior merge of prior 1414/2424/3434/4444 reconciliation.

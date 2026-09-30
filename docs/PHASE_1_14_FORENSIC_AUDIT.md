# Phase 1–14 Forensic Audit Snapshot

**Date:** 2026-09-28  
**Package:** 0.59.4 · Next.js 15.5.26  
**Scope:** Inspect → reconcile → document. Phase 15 frozen.

## Inventory (current tree)

| Metric | Count |
|--------|------:|
| Source-ish files (excl. node_modules/.next) | 808 |
| `.ts` | 427 |
| `.tsx` | 150 |
| API `route.ts` | 105 |
| Components `.tsx` | 123 |
| `lib/**/*.ts` | 300 |
| Migrations | 54 |

## Automated static results (this pass)

| Suite | Result |
|-------|--------|
| Production safety | 21/21 PASS |
| Pi durable payment | 40/40 PASS |
| Economy v1.2 | 173/173 PASS |
| Daily claim → wallet | 35/35 PASS |
| JSX safety | 576 files PASS |
| Migration checklist | 54 on disk · 51 REQUIRED · 1 APPROVAL · 2 PROPOSAL |

## Code security (static)

- ~96 API routes use `resolveAuthenticatedUser`
- Admin credit: timing-safe key + `GHC_ADMIN_CREDIT_KEY`; no ordinary mint
- Payment complete: auth + durable intent + ownership bind
- Membership activate: session actor + intent ownership + `grantEntitlement`
- Community join-decide: session actor, self-decide rejected
- Service worker: `/api/**` network-only
- A2U / staking: gated / incomplete by design
- No `NEXT_PUBLIC` service-role or PI_API_KEY on client (safety scan)

## Migrations

- Local ↔ ghcclatest.zip: 54 exact names, 0 SQL content mismatches
- Remote Testnet history: **OPERATOR VERIFICATION REQUIRED**
- Do not renumber, reset, or blind-push

## Environment blocks

| Gate | Status |
|------|--------|
| npm ci / typecheck / lint / build | BLOCKED BY ENVIRONMENT (sandbox) |
| `supabase migration list` | BLOCKED — no CLI/credentials |
| Live schema objects | OPERATOR VERIFICATION REQUIRED |
| Two-user IDOR | OPERATOR VERIFICATION REQUIRED |
| Pi Browser E2E | OPERATOR VERIFICATION REQUIRED |

## Phase 15

**NOT STARTED** — do not implement.

## Mainnet

**NOT CERTIFIED** — requires operator Gate 1–5 evidence.

# GH-CONNECT Phase 5 — Global Production Readiness (0.330.7)

**Release:** 0.330.7  
**Baseline:** 0.330.5 Phase 4 Financial Infrastructure  
**Canonical migrations:** 189 (no new migrations in this package)  
**Date:** 2026-11-06

## Executive summary

Phase 5 consolidates the five-phase programme into a single production-oriented baseline. This package:

- Carries forward Phase 4 withdrawal form stability (open-transition guard, no mid-entry wipe, single Withdraw CTA path).
- Adds a **static production-readiness gate** (`scripts/check-phase5-production-readiness.mjs`).
- Adds a **GitHub Actions CI workflow** (install → readiness gate → typecheck → lint → build).
- Documents account export / lifecycle, private media signed-url surface, and operator deployment boundaries.
- **Does not** claim Mainnet A2U readiness, live funded payouts, or automatic production migrations.

Honest classification:

| Area | Status |
|------|--------|
| Application shell & primary modules | Present and wired (feed, discover, communities, marketplace, messaging, wallet, profile, notifications) |
| Pi Testnet withdrawal request path | Implemented; settlement remains server/worker + flags |
| GHC utility ledger | Server-authoritative; no client mint |
| Account export API | Implemented with auth + step-up + rate limit |
| Account deletion request | Implemented as **request only** (no automatic irreversible delete) |
| Private media signed URLs | Routes present under `/api/media/[id]/…` |
| CI static pipeline | Added in this release |
| Live E2E on production credentials | **Outstanding** — operator-owned |
| Mainnet Pi A2U | **Not enabled** in this package |

## Architecture audit (condensed)

### Present feature modules

- `features/feed`, `discovery`, `communities`, `marketplace`, `messaging`, `matching`, `wallet`, `profile`, `notifications`, `membership`, `rewards`, `payments`, `identity`, `auth`

### Financial boundaries (preserved)

- Single server ledger authority for GHC and Pi earnings withdrawable balances.
- Withdrawal sheet never trusts browser-only authorization flags; uses `fetchWalletAuthorizationStatus` + server quote/withdraw routes.
- PIN is hashed server-side (`/api/identity/withdrawal-pin`); never sent to Pi.
- GHC does not mint from votes; GHPV remains separate.

### Account lifecycle

- `GET/POST`-style surfaces under `app/api/account/export` and `app/api/account/lifecycle`.
- Export requires authenticated user + recent step-up; fails closed on source read errors.
- Deletion is **request recording** with explicit message that balances/disputes/legal retention must be reviewed before completion. No silent hard-delete of financial history.

### Private media

- Content and signed-url routes under `app/api/media/[id]/`.
- Client surfaces (LazyImage, DurableVideo, resolve-display-url) prefer facade / signed resolution over permanent public object URLs for private assets.

### Security headers

- `vercel.json` sets CSP (Pi domains), HSTS, nosniff, Referrer-Policy, Permissions-Policy.

## Implemented in 0.330.7

| Change | Purpose |
|--------|---------|
| `package.json` / `VERIFIED_MANIFEST.txt` → 0.330.7 | Release consistency |
| `scripts/check-phase5-production-readiness.mjs` | Static gate for wallet spine, account APIs, media routes, migrations, features |
| `.github/workflows/ci.yml` | CI: npm ci → Phase 5 gate → typecheck → lint → build |
| This document + deployment guide | Operator clarity |
| Phase 4 withdrawal guards retained | Form does not wipe / kick user on amount or PIN entry |

## Modified / new files

- `package.json` (version)
- `VERIFIED_MANIFEST.txt` (project_version)
- `scripts/check-phase5-production-readiness.mjs` (new)
- `.github/workflows/ci.yml` (new)
- `docs/GH-CONNECT-PHASE-5-PRODUCTION-READINESS.md` (new)
- `docs/releases/DEPLOYMENT-GUIDE-0.330.7.md` (new)
- `docs/releases/RELEASE-MANIFEST-0.330.7.md` (new)

No database migrations added. No RLS policy changes in this package.

## Security assessment (static)

**Reviewed in source:**

- Auth resolution on account export/lifecycle and withdrawal PIN.
- Step-up requirement on sensitive account actions.
- Rate limiting on PIN and export paths.
- Service-role usage confined to server routes; not exposed to client bundles by design of API routes.
- CSP and HSTS on Vercel config.

**Not fully verified in this environment:**

- Live RLS policy matrix against a real Supabase project.
- Penetration tests / IDOR fuzzing against production data.
- Pi production credentials and webhook signature verification under load.

Treat those as **operator Testnet → Mainnet checklist items**, not as completed Phase 5 claims.

## Performance

No new bundle regressions intentionally introduced. Existing patterns retained:

- Lazy-loaded wallet and settings screens in app shell.
- Media facade + signed URL resolution.
- Feed content-visibility / long-press media tooling from prior phases.

Lab measurements (LCP/INP) require a deployed Preview with real devices — not asserted here.

## Test results (this package)

| Check | Result |
|-------|--------|
| `node scripts/check-phase5-production-readiness.mjs` | Run at package time |
| Full `npm run typecheck` / `npm run build` | Operator CI / Vercel — environment dependent |
| Live Pi withdrawal with funded balance | Outstanding |
| Account export download end-to-end | Outstanding (API present) |

## Outstanding defects / dependencies

1. **Withdrawable Pi = 0** on many Testnet accounts while reserved > 0 — server eligibility, not client form bug.
2. **A2U worker + flags** must be enabled and funded by operator for settlement after request acceptance.
3. **Account deletion completion** is manual/ops after request — by design.
4. **Full E2E suite** against live Preview credentials remains operator-owned.
5. Modules named in the programme brief as aspirational (hotels, logistics, IP Zone, charity, education, entertainment) are **not** claimed as complete product surfaces in this baseline; primary social/commerce/wallet modules are the production focus.

## Production readiness assessment

**Ready for:** Preview / Testnet continuous deployment with operator-controlled env, migrations applied per documented order, and financial flags fail-closed.

**Not ready for:** Unattended Mainnet payouts, automatic irreversible account destruction, or claims of “fully settled Pi withdrawals” without worker confirmation.

## Rollback

Redeploy previous artifact:

- `GH-CONNECT-0.330.5-PHASE4-FINANCIAL-INFRASTRUCTURE.zip`  
  sha256 `178642ff116225286493481dd49da98a33f45eb0c4b8a33168be3dbb4b196ccf`


## Build fix 0.330.7

Restored prebuild marker comment `Initialise once per open transition` in `pi-withdraw-sheet.tsx` so `check-phase2-visual-cohesion.mjs` passes. Form stability guards (wasOpenRef / amountTouchedRef) unchanged.

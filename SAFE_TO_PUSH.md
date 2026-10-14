# GreenHaven / GH-CONNECT — Release candidate (GitHub / CI review)

This document describes **when the source tree is suitable to commit and push for code review and continuous integration**.

It is **not** a production deployment approval.

---

## Terminology (do not collapse)

| Label | Meaning |
|-------|---------|
| **Safe to commit / push** | Source is a release *candidate* for GitHub review and CI |
| **CI verified** | `npm ci` + typecheck + lint + safety + build actually passed in CI or local |
| **Testnet verified** | Required migrations applied; two-user / social / payment checks on Testnet |
| **Staging verified** | IDOR + Pi Browser E2E (and messaging gate if enabling durable messaging) |
| **Production ready** | Operator sign-off after staging gates — **not claimed by this file** |
| **Mainnet approved** | Explicit production decision — **not claimed by this file** |

Pushing to GitHub does **not** authorize Vercel **Production** or Mainnet traffic.

---

## Current tree status

| Item | Status |
|------|--------|
| Phases 1–13 (source) | Implemented |
| Phase 14 | Static security/release checks implemented; live Testnet and operator verification still required |
| Phase 15 | **Not started** |
| Automated safety / economy / release suites | Pass when executed in a complete environment |
| `npm ci` / typecheck / lint / build | **Operator / CI gate** — not certified by this markdown alone |
| Testnet / Pi E2E / multi-instance IDOR | **Not verified** until operators run them |

Authoritative phase table: `docs/PHASE_IMPLEMENTATION_STATUS.md`  
Testnet procedure: `docs/TESTNET_VERIFICATION_GATE.md`  
Migrations: `docs/MIGRATION_CHECKLIST.md`

---

## Included repairs (do not revert)

- `package-lock.json`: package `resolved` URLs use `https://registry.npmjs.org/`
- `package.json`: `next@15.5.26` + matching Next ESLint plugin (security maintenance line)
- Pre-gate UI/payment hardening documented in `docs/PHASE_IMPLEMENTATION_STATUS.md`

## Do NOT commit

- `.env`, `.env.local`, or any file with real secrets
- `node_modules/`, `.next/`, coverage, local logs
- Pi API keys, Supabase service-role keys, admin keys

## Secrets (Vercel dashboard only — never in git)

Configure only in the Vercel project UI (or your secret store):

- `PI_API_KEY` (server only — never `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_PI_CLIENT_ID`
- `NEXT_PUBLIC_PI_SANDBOX` (`false` Production / `true` Preview)
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never `NEXT_PUBLIC_`)
- `DOMAIN_VALIDATION_KEY` (Pi domain validation)

See `VERCEL_DEPLOY.txt` for Mainnet vs Preview matrix.  
**Preview / Testnet first.** Production deploy is a separate operator decision after CI + Testnet gates.

## Suggested local / CI sequence before merge

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

Optional after CI green:

```bash
npm run test:economy
npm run test:daily-wallet
npm run test:release
npm run check:jsx
```

## Preserved architecture

Pi SDK, domain validation (`DOMAIN_VALIDATION_KEY` path), Supabase, auth, GHC economy, routes, and UI — unchanged by this documentation file.

---

## Phase 14A (2026-10-09)

Migration inventory reconciled to **70** on-disk SQL files. See `docs/MIGRATION_GAP_REPORT.md`.  
Still **not** Testnet-verified or production-approved.

## Phase 14B (2026-10-10)

Social authz static scan corrected (public-read + system-key allowlists).  
Suites: social-authz, idor-static, messaging-authz, safety, GHPV economic, content-reward, Pi payment — **pass** when run.  
Still not Testnet/runtime verified. See `docs/PHASE_14B_STATIC_SECURITY.md`.

## Phase 14C (2026-10-10)

`npm ci` **OOM (exit 137)** in sandbox — typecheck/build **unverified** here.  
Economy suite **173/173** still passes. Operator must complete install+build.  
See `docs/PHASE_14C_BUILD_STATUS.md`.

## Maintenance modernization (2026-10-10)

Surgical upgrades documented in `docs/MAINTENANCE_MODERNIZATION_2026-10-11.md`.  
Run `npm run verify:static` after install. Still not Testnet/Production certified.

## Profile content library (2026-10-14)

Added `20261023_gh_profile_content_library.sql` after the existing 70 migrations; the on-disk inventory is now 71. This migration is **not yet applied to Testnet**. Apply and verify it before enabling profile content search on a deployed environment. Static checks pass, but `npm ci` timed out in this environment, so full typecheck/lint/build remain operator gates. See `docs/GH_PROFILE_CONTENT_LIBRARY.md` and `docs/GH_MEDIA.md` for the rollout and public-bucket privacy limitation.


## Profile + media hardening (2026-10-14)

- Added `npm run audit:profile-connected` (83 static checks) for profile library, media-upload validation, durable story/video paths, API authorization and connected wallet/reward/membership/reputation/curation surfaces.
- The current Vercel `/api/media` proxy is limited to a 4 MB client upload threshold to stay below Vercel Functions' 4.5 MB request-body limit. Direct-to-storage signed/resumable uploads are still required before enabling larger video/PDF files. See `docs/GH_PROFILE_CONTENT_LIBRARY.md`.
- Story/post composers no longer publish `blob:` URLs as media references. A failed durable video upload now fails visibly rather than creating a broken post/story.
- This remains a release candidate, not a production approval: migration, full typecheck/lint/build and multi-user Testnet authorization tests are operator gates.

## Profile-connected audit pass B (2026-10-14)

- Added `npm run audit:profile-connected-v2` (84 static regression checks) across profile library, peer-profile entry points, story writes/reads, media resolution/upload, messaging, settings, wallet, rewards, membership, curation and reputation.
- Wired `ghc:open-profile` to a shared peer-profile overlay so existing dispatches from discovery, matches, messaging and community surfaces have a central handler when the target exists in the authenticated discovery context.
- Removed the unsupported synthetic compatibility percentage from the peer profile; follow, message, like/pass, block and report actions now use existing context actions.
- Story endpoints now rate-limit reads/writes, validate payload sizes and media URLs, derive story ID/name from the server, and return unavailable errors instead of masking failed durable reads as empty results.
- Media resolution now validates IDs, rate-limits requests, sets no-store headers and hides upstream storage diagnostics. All media route responses set `Cache-Control: no-store`.
- All media upload entry points now fail fast above the conservative 4 MB Vercel proxy threshold. This does not implement large-file direct uploads.
- Message list/edit/delete routes now have per-user rate limits and stricter conversation/message identifier validation; conversation creation is rate-limited and request size is bounded.
- The `Posts` library tab now represents the complete chronological timeline, including media posts; media tabs remain filtered views.

Static gates and changed-file syntax transpilation pass. Full `npm run typecheck`, lint and production build are still blocked by absent/incomplete `node_modules` in this packaging environment; no production certification is claimed.

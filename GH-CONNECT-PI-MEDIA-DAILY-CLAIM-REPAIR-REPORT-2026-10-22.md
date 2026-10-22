# GH-CONNECT Pi Browser Media + Daily GHC Claim Repair

**Date:** 2026-10-22  
**Baseline:** available GH-CONNECT 0.70.3 React Hooks CI repair archive. This is a repair candidate, not a verified checkout of the live GitHub `testnet` branch.

## Findings and changes

### P0 — Shared media upload authentication

- `lib/media/upload-client.ts` already sent `credentials: "include"`, but its proxy upload, direct-upload-intent, and direct-upload-complete requests did not recover from a stale/missing GH session cookie.
- The server's existing `POST /api/auth/pi` bridge verifies the held Pi access token against Pi before issuing a new HttpOnly GH session cookie. The upload client now uses that verified bridge after a 401 and retries the original request once. If Pi verification fails or no access token is available, the upload remains failed; no anonymous upload or client-supplied identity fallback was added.
- `lib/identity/identity-service.ts` no longer emits synthetic `Bearer user:<id>` headers from production builds; that dev-only fallback remains available outside production.
- The existing server auth resolver still prioritizes the valid GH session cookie, and media owner checks, storage validation, and rate limits are unchanged.

**Deployment note:** this does not prove the live testnet cookie is actually missing or blocked. If the retry still returns 401, inspect the `/api/auth/pi` and media API status codes in Pi Browser; verify testnet Supabase identity/session durability and production cookie flags (`Secure`, `SameSite=None`, `Partitioned`) for the deployed hostname.

### P1 — Daily GHC reward experience

- `components/ghc/app.tsx` renders the global `DailyClaimPrompt`; `components/ghc/home-command-centre.tsx` renders `DailyRewardHomeExperience`, whose previous 1.6-second timer automatically opened a second detailed sheet. The timer is removed: the global prompt owns automatic display; the feed card and Rewards Centre can still open the detailed sheet manually.
- The detailed sheet publishes visibility so the global prompt is suppressed while the sheet is open, preventing stacked claim modals.
- `components/ghc/daily-claim-prompt.tsx` now distinguishes an idempotent/already-claimed response from a newly confirmed claim and does not announce a new reward in the already-claimed case.
- The automatic prompt is smaller, scroll-safe on short mobile screens, uses the official GHC coin icon in its header, and uses tighter spacing. `components/ghc/ghc-coin-icon.tsx` loads the small official logo eagerly to avoid delaying it in a modal.
- Reward rates, cooldowns, 48-hour pending behavior, server RPCs, ledger logic, and wallet sync rules were not changed.

## Files changed

- `lib/media/upload-client.ts`
- `lib/identity/identity-service.ts`
- `components/ghc/daily-claim-prompt.tsx`
- `components/ghc/daily-reward-experience.tsx`
- `components/ghc/ghc-coin-icon.tsx`
- `scripts/test-pi-media-recovery-daily-claim-ui.mjs` (new)
- `package.json` (registers the new regression test)

## Checks run

- New Pi media recovery + daily claim UI source regression checks: **14/14 passed**
- JSX safety scan: **727 files scanned, passed**
- Reported build regression tests: **7/7 passed**
- Vercel build repair regression tests: **9/9 passed**
- Media upload compression checks: **12/12 passed**
- Media route hardening: **13/13 passed**
- Private media signed-URL checks: **10/10 passed**
- Media upload orphan/facade checks: **5/5 passed**
- Daily claim-to-wallet pipeline: **35 passed, 0 failed**
- Rewards reliability: **24 passed, 0 failed**
- Dependency lock integrity: **passed**
- ZIP integrity: to be verified at packaging time

## Not verified

- Full ESLint, TypeScript, and Next.js production build were not run because dependencies are not installed in this working environment.
- No live Pi Browser end-to-end test was possible here.
- The actual remote `testnet` branch was not freshly checked out. Reconcile this repair into the latest branch rather than overwriting a newer checkout with this archive.

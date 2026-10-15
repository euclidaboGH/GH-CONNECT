# GH-CONNECT Vercel Fix Report — 2026-10-14

## Applied changes

1. `components/ghc/profile-story-section.tsx`
   - Removed the undefined `s` reference and use the clicked `story.id` for story-view tracking.
   - Moved the analytics call outside the React state updater so the updater remains free of that network side effect.
2. `components/ghc/profile-ecosystem-hub.tsx`
   - Added `uid` to the wallet-fetch effect dependency list so the wallet request follows the active user ID.
3. `components/ghc/profile-screen.tsx`
   - Memoized the fallback profile object to avoid creating a new object on each render and destabilizing memo dependencies.
4. `components/ghc/marketplace-screen.tsx`
   - Removed two obsolete `eslint-disable` comments for a rule disabled in the project ESLint configuration.
5. `scripts/test-idor-static.mjs`
   - Added an explicit exception for `/api/analytics/events`, which is documented in the route as anonymous, rate-limited, payload-bounded, and non-persistent. The static IDOR check was incorrectly flagging this intentionally public intake endpoint.

## Checks run

- `node scripts/check-jsx-safety.mjs` — PASS (610 files scanned)
- `node scripts/test-idor-static.mjs` — PASS (123 pass, 0 fail; 111 routes scanned)
- `node scripts/test-social-authz.mjs` — PASS (30 pass, 0 fail)
- `node scripts/scan-production-safety.mjs` — PASS (21 pass, 0 fail)
- `node scripts/test-economy-v12.mjs` — PASS (173 pass, 0 fail)
- `node scripts/test-daily-claim-wallet-pipeline.mjs` — PASS (35 pass, 0 fail)
- `node scripts/verify-phase14-static.mjs` — PASS (11/11 suites)

## Verification limitation

A full `npm ci --legacy-peer-deps`, `npm run typecheck`, ESLint run, and `npm run build` could not be completed in this environment because dependency installation timed out. The Vercel-reported undefined-name error is corrected in source, but a successful production build is not claimed until those commands pass in the project environment or Vercel.

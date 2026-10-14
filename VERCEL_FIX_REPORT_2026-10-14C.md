# GH-CONNECT Vercel Fix Report — 2026-10-14C

## Critical build fix

- `components/ghc/enhanced-post-card.tsx`: fixed the community-review status effect. Previously an async IIFE swallowed the `fetch()` result and therefore returned `void`, while a following `.then((r) => r.json())` attempted to call `.json()` on `void`. The effect now awaits the fetch response inside the async function, checks `response.ok`, parses JSON from the actual `Response`, preserves the status labels, and safely ignores completion after cleanup. The supplementary status request remains fail-soft and cannot break the post card.

## Prior fixes retained

- `components/ghc/profile-story-section.tsx`: story-view tracking uses the selected `story.id` and does not run as a side effect inside the state updater.
- `components/ghc/profile-ecosystem-hub.tsx`: wallet effect tracks `uid`.
- `components/ghc/profile-screen.tsx`: fallback profile object is memoized.
- `components/ghc/marketplace-screen.tsx`: obsolete ESLint suppression comments removed.
- `scripts/test-idor-static.mjs`: documented public analytics intake endpoint exception retained.

## Checks completed in this environment

- `node scripts/check-jsx-safety.mjs` — PASS (610 files scanned)
- `node scripts/test-idor-static.mjs` — PASS (123 pass, 0 fail; 111 routes scanned)
- `node scripts/verify-phase14-static.mjs` — PASS (11/11 suites)

## Not claimed

A full `npm ci`, `npm run typecheck`, ESLint run, and `npm run build` could not be completed in this environment because package installation timed out. Run those commands after extracting the archive before deploying. This patch directly fixes the exact TypeScript error reported by Vercel; a successful full production build still requires confirmation.

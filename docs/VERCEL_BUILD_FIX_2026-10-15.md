# Vercel build fix — 2026-10-15

## Blocking error
`notification-bell.tsx`: object literal had **two `headers` properties**
(auth headers line + `Accept: application/json`). TypeScript fails the build.

## Fix
- Single merged `headers` object (`Accept` + `IdentityService.getAuthHeaders`)
- mark_read / markAll use the same pattern
- Repo-wide scan for consecutive duplicate `headers` keys

## ESLint warning
`ESLint: nextVitals is not iterable` — flat config now uses `FlatCompat.extends("next/core-web-vitals")` so the spread is always an array.

## Non-blocking (not changed)
- npm `cache-dir` env warning (Vercel environment)
- isomorphic-dompurify / eslint deprecation advisories
- `npm audit` vulnerability list (do not `audit fix --force` without review)

# Upgrade worklog — 0.299.0

Date: 2026-11-03

- Rebuilt `components/ghc/profile-story-section.tsx` Stories rail into a compact Facebook-inspired horizontal card strip while retaining the existing story publishing and engagement flows.
- Added viewer-authorized private-media URL resolution for full-screen story media.
- Integrated `MediaLightbox` into `components/ghc/profile-screen.tsx`; existing profile and cover images now open for full-size viewing, while separate camera actions open edit options.
- Added `scripts/check-social-story-profile-media-ux.mjs` and registered it in `prebuild` and `verify:static`.
- Bumped package, lockfile, and app release metadata to `0.299.0`.
- No database migrations or financial/authentication behavior changes.
- Source UX gate: 13/13 passed. Full supported-runtime and device acceptance remains pending.

Verification is source-only in this environment. The project requires Node.js 24.15.0; the available runtime is Node.js `22.16.0`, so the production build, TypeScript, lint, and full browser/device acceptance are not claimed.

# Vercel build repair — 2026-10-18 (follow-up)

## Failure fixed

Vercel typechecking failed because `enhanced-feed-screen.tsx` destructures `loadPostComments` from `useGHCFeed()`, but the `GHCFeedContext` TypeScript shape did not declare the property. The feed provider value already included `loadPostComments`; the context type was incomplete.

## Change

Added `loadPostComments: GHCContextType["loadPostComments"]` to the `GHCFeedContext` type and added a regression assertion to `scripts/test-vercel-build-repair.mjs`. No runtime behavior, database migration, or environment variable changes are required.

## Verification limitation

Run the regression script and static checks locally. A full Next.js build/typecheck must still be confirmed in Vercel or an environment with project dependencies installed.

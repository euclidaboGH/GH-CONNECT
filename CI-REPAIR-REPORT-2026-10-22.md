# GH-CONNECT 0.70.3 — React Hook CI Repair

## Scope

Applied a focused repair to `contexts/ghc-context.tsx` using the latest cleaned project archive available in this conversation as the source baseline. The GitHub commit `17b03c8` was not checked out directly; reconcile this patch with the current `testnet` branch before committing.

## Changes

- Wrapped `createQuoteRepost`, `sharePost`, `savePost`, `unsavePost`, `reportPost`, and `muteUser` in `useCallback` so references included in the context `useMemo` remain stable when their real dependencies have not changed.
- Added dependency arrays based on values actually read directly by each callback.
- Removed stale/unnecessary dependencies from the `createPost`, `removeCommentReaction`, `pinComment`, and `unpinComment` callbacks while retaining `addToast` where used.
- Kept existing behavior, durable server calls, error handling, toast messages, and state update logic intact.

## Checks run

- `node scripts/check-jsx-safety.mjs`: PASS, 727 files scanned.
- `node scripts/test-reported-build-regressions.mjs`: PASS, 7/7.
- `node scripts/test-vercel-build-repair.mjs`: PASS, 9/9.
- Focused source assertions for the callback/dependency changes: PASS.

## Not verified

- Full ESLint run, TypeScript typecheck, and Next.js production build were not run because dependencies are not installed in this working environment and the project specifies Node.js 24.22.1.
- This archive is based on the latest cleaned ZIP available here, not a fresh checkout of commit `17b03c8`. Verify the exact branch diff and rerun CI before merging or deploying.

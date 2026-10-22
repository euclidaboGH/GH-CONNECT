# GH-CONNECT — React Hooks / Static CI Hardening

**Reference commit reported by user:** `3ad255b33e2430a49c30b96fb379f702cf5bf68c` on `testnet`  
**Prepared:** 2026-10-22  
**Scope:** Surgical fixes for the hook findings shown in the supplied GitHub Actions annotations.

## Repairs in this candidate

1. `features/wallet/wallet-screen.tsx`
   - Memoizes the transaction and reward fallback arrays. When the wallet service returns no data, `[]` no longer becomes a new dependency value on every render.
   - Leaves wallet reads, ledger behavior, UI, and business rules unchanged.

2. `contexts/pi-auth-context.tsx`
   - Stabilizes `fetchProducts` with `useCallback`.
   - Stabilizes `initialize` with its actual local callback dependency (`fetchProducts`).
   - Declares `initialize` in the initialization effect dependencies. This avoids both the missing-dependency warning and the common mistake of adding a newly-created function dependency that restarts the effect on every render.

3. `contexts/ghc-context.tsx`
   - Makes the context value's dependency list exhaustive for the callbacks it exposes.
   - Converts the previously inline context callbacks used in that dependency list to stable `useCallback` implementations with explicit state/domain dependencies, so exhaustive dependencies do not force the provider value to be recreated on every render.
   - Preserves the existing context API and intended behavior; no database migrations or financial logic were changed.

4. `scripts/test-latest-ci-regressions.mjs`
   - Adds static regression checks for wallet fallback stability, Pi initialization dependency wiring, and the GHC context callback dependency list.

## Validation performed

- `node scripts/test-latest-ci-regressions.mjs`: **25/25 passed**.
- `node scripts/test-connection-social-write-pipeline.mjs`: **11/11 passed**.
- `node scripts/test-connection-server-first.mjs`: passed.
- `node scripts/test-unified-connections.mjs`: **23 passed, 0 failed**.
- `node scripts/test-discovery-connections.mjs`: **42 passed, 0 failed**.
- `node scripts/test-messaging-reliability.mjs`: **32 passed, 0 failed**.
- TypeScript `transpileModule` syntax checks passed for all three modified TSX files.

## Important limitations

- The supplied annotation excerpt lists one error and eight warnings, but it does **not** include the full error message. These edits directly address the listed hook findings; they do not establish that the unshown error is fixed.
- Full ESLint, project typecheck, and Next.js production build were **not confirmed** in this environment. The candidate's dependency installation is incomplete (`eslint` and `next` are unavailable here), and the environment is Node `22.16.0` while this project targets Node 24. Do not treat this candidate as a green CI/build result until checks pass on the supported Node runtime with the lockfile-installed dependencies.
- This workspace is based on the previously available GH-CONNECT candidate source, not a fresh checkout/export of remote commit `3ad255b`. Apply the patch to a fresh `testnet` checkout only after reviewing it. If the patch does not apply cleanly, compare the current files and port the equivalent changes surgically; do not replace the branch with the candidate ZIP.
- No Supabase migration was applied and no live data was changed.

# RUN334 — Election tally build/type-safety repair (2026-11-18)

## Reported blocker

The Vercel production build compiled JavaScript successfully, then failed during TypeScript validation in `app/api/research/projects/[id]/elections/[contestId]/tallies/route.ts`. `totalBallots` remained `unknown` after a boolean-returning validation helper, so TypeScript rejected its comparison with `accreditedVoters`. The same build reported three missing React Hook dependencies in Research Studio.

## Changes

- Replaced the count predicate with overloads: required values narrow to `number`; optional values narrow to `number | null`.
- Kept strict runtime bounds: actual numbers only, safe integers, zero or greater, and at most `MAX_COUNT`.
- Kept candidate sum, accredited-versus-registered and total-ballots consistency checks. Removed redundant `Number(...)` coercions after narrowing.
- Memoized project, contest, candidate and exam loaders with `useCallback`; effects now depend on the memoized callbacks. The reconciliation loader was already correctly memoized and remains so.
- Added `scripts/check-run334-build-fixes.mjs` and wired it into `verify:static` and `prebuild:checks`.

## Verification

- RUN334 source regression gate: 8/8 PASS.
- Strict TypeScript 5.8.3 isolated overload/narrowing fixture: PASS.
- Changed route and TSX syntax transpilation: PASS.
- Full `npm run verify:static`: PASS.
- `npm run prebuild:checks`: source checks progressed, then stopped because `node_modules/typescript/index.js` was unavailable after the dependency installation timed out.
- Existing RUN333 election UI/reconciliation: 13/13 PASS.
- Election reconciliation runtime: 6/6 PASS.
- RUN333 Testnet security reconciliation: 11/11 PASS.
- RUN332 audit remediation: 16/16 PASS.
- Scoped evidence engine: 26/26 PASS.

## Remaining verification boundary

The full application typecheck, ESLint run and `next build` were not executable in this workspace: the available Node runtime is 22.16.0 while the project requires `^24.15.0`; `npm ci --ignore-scripts --no-audit --no-fund` timed out and did not install the locked dependencies. The complete `npm run verify:static` rerun passed. Therefore the original type error and the reported hook dependency warnings have source fixes, but a clean Vercel Node 24 production build is not yet certified.

No GitHub push, Vercel deployment, Supabase migration or database mutation was performed in RUN334. Mainnet remains untouched. Production remains NOT APPROVED pending the supported-runtime build and the pre-existing database/release gates.

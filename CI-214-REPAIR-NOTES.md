# GH-CONNECT CI #214 repair notes

Baseline: package version 0.330.1, derived from the user's authoritative source archive and the prior CI source-gate repair copy.

## Static lint warnings addressed in this copy

- `eslint.config.mjs`: assigns the flat-config array to `eslintConfig` before default export.
- `components/ghc/profile-identity-overview.tsx`: the identity subscription effect includes `onCounts` in its dependency list; the refresh callback also depends on `onCounts`.
- `components/ghc/discovery-grid-screen.tsx`: relationship-state memoization depends on `adapted.list`. That list is rebuilt when relevant graph arrays change, so the memo does not include the unrelated aggregate `graphSnap` object.

## Targeted checks run

- `scripts/check-github-195-lint-remediation.mjs`: 9/9 passed.
- `scripts/check-phase17-ci-governance.mjs`: 16/16 passed.
- `scripts/check-phase6-profile-performance.mjs`: 20/20 passed.
- `scripts/check-pass39-independent-hydration.mjs`: 9/9 passed.

## Important verification limit

The supplied CI #214 excerpt shows the `prebuild` checks progressing but does not include the first failing diagnostic or final error lines. Therefore the production-build failure is not diagnosed or claimed fixed by this notes file. Full `npm run build`, TypeScript, ESLint, and device acceptance must be rerun in CI on Node.js 24.15.0 after applying the changes. No repository commit, push, deployment, or database migration was performed.

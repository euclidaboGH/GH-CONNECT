# GH-CONNECT Phase 10 — CI #177 Related-Error Second Pass

Date: 2026-11-02
Baseline: `gh-connect@0.274.3`, Phase 10 CI #177 repair source tree.

## Results

This second pass did not identify another confirmed source defect in the areas covered by these checks:

- Build type-regression guard: 7/7.
- Security-header regression checks: 7/7.
- SECURITY DEFINER source audit: 371 declarations have `SET search_path` and matching PUBLIC execute revokes.
- Migration source manifest: 176/176 synchronized.
- Consolidated migration bundle: 176/176 source files byte-for-byte synchronized.
- Documentation hygiene: passed.
- Production release source verifier: 242 passed, 0 failed (from the same repaired source tree).

The lockfile contains the expected `pi-backend@0.1.3` root dependency and `node_modules/pi-backend` package entry. The earlier missing-entry concern is not present in this archive.

## Remaining release blockers / limits

- This environment runs Node.js `v22.16.0`, but the repository requires `^24.15.0`; `scripts/check-node-runtime.mjs` correctly fails closed.
- A dependency installation attempt emitted engine mismatch warnings and stalled; it was stopped and its partial `node_modules` directory removed. No package manifest or lockfile changes were made by that attempt.
- TypeScript, ESLint, `npm ci` completion, production build, deployed operator probes, and live Pi Browser/Supabase/payment tests remain unverified here.
- The SECURITY DEFINER source audit explicitly does not prove overload-level ACL equivalence, effective role grants, function ownership, deployed database catalog state, or runtime exploitability. Those require live database verification.

## Next verification sequence

On Node.js `24.15.0` or a compatible `24.x` release, run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run verify:static`, `npm run verify:production`, and `npm run build`. Review actual failures before changing source. Do not weaken security checks or apply migrations based solely on these static results.

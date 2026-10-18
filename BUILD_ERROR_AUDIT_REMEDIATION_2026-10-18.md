# GH-CONNECT 0.61.1 — Source audit and build-error remediation
Date: 2026-10-18
Branch/commit from supplied Vercel log: `testnet` / `9bbbae3`
Artifact reviewed: `GH-CONNECT-PHASE-3-0.61.1-2026-10-18.zip`

## Applied fixes
1. `components/ghc/enhanced-post-card.tsx`: React passes a mouse/touch event to event handlers. The long-press handler instead expects a reaction kind (`"positive" | "negative"`), causing the reported TS error. Wrapped `onMouseDown` and `onTouchStart` in zero-argument callbacks that explicitly pass `"positive"`. This preserves the current reaction behavior while correcting handler typing.
2. `components/ghc/enhanced-feed-screen.tsx`: added `dailyClaim.status` to the reward-notice effect dependency list, so the effect reruns when the authoritative status object changes and resolves the reported exhaustive-deps warning.
3. `scripts/test-vercel-build-repair.mjs`: added static regression assertions for both handler wrappers and the effect dependency.
4. Added this audit report to the project archive.

## Repository-level review observations
- The supplied artifact contains a substantial Next.js app (1,112 archive entries); this is a source-level review of the supplied snapshot, not a live GitHub, Vercel, Pi Developer Portal, or Supabase inspection.
- Build log reports successful compilation followed by a TypeScript failure in the post-card handlers. The two edits directly address that failure and the displayed hook warning.
- Dependency audit reported 14 vulnerabilities (2 low, 1 moderate, 11 high). The log does not include package names or advisory details, so a safe targeted remediation cannot be selected from that summary alone. Do not run `npm audit fix --force` blindly. Run `npm audit --json` under the project's Node 24 toolchain, review direct/transitive impact, update targeted dependencies, regenerate the lockfile, and rerun the full gate.
- `isomorphic-dompurify@3.20.0` is explicitly warned by npm as having a Node-version/semver mismatch; investigate upgrading to a compatible 4.x release on Node 24 and run sanitization regression tests before accepting it.
- `eslint@9.39.5` is flagged by npm as unsupported. Review the project's ESLint configuration and Next.js 15 compatibility before selecting a supported version; avoid an untested major upgrade.
- `Unknown env config "cache-dir"` is not present in the supplied `.npmrc`; likely comes from Vercel/build environment or user-level npm configuration. Inspect `npm config list` in CI and remove/rename the unsupported config at its source.
- npm warned that `unrs-resolver` has an install script not covered by the current install-script allowlist. Review the package's provenance and purpose, then explicitly approve only if expected and required by the dependency chain.
- Migration inventory and prior phase documents explicitly state that live migration state is unverified. No SQL migration was applied or changed in this remediation. Do not apply migrations to Testnet/Mainnet from this archive without reconciling remote migration history first.

## Verification status
- Source-level patch assertions were added to `scripts/test-vercel-build-repair.mjs`.
- A clean `npm ci --legacy-peer-deps`, TypeScript check, lint run, full test suite, and production build were **not run in this environment**. Therefore this archive is a remediation candidate, not a claim of a verified passing production build.
- Required next checks on Node 24.15.0:
  1. `npm ci --legacy-peer-deps`
  2. `npm run test:vercel-build-repair`
  3. `npm run typecheck`
  4. `npm run lint`
  5. `npm run ci:verify` (or CI workflow)
  6. `npm audit --json` and targeted dependency remediation
  7. Deploy to Vercel Preview/Testnet only after CI passes; exercise feed media taps/long-press on mouse and touch.

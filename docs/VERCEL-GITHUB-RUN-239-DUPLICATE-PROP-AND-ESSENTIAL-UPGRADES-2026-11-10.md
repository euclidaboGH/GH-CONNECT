# GitHub Actions #239 — duplicate JSX prop and essential UX hardening

**Baseline:** GreenHaven / GH-CONNECT `0.338.18` (`GREENHAVEN-0.338.18-WALLET-HYDRATE-PERF-UX.zip`).

## Root cause fixed

`components/ghc/pi-withdraw-sheet.tsx` declared `inputMode="numeric"` twice on the withdrawal PIN input. This produced ESLint `react/jsx-no-duplicate-props` and stopped the Next.js production build. The duplicate declaration was removed; the intended numeric keyboard behavior remains.

## Ten essential withdrawal UX/accessibility upgrades

1. Use a visible `<label>` associated with the PIN input.
2. Give the PIN field a stable ID so labels and controls can reference it.
3. Keep the numeric input mode for mobile keypad behavior.
4. Enforce a six-character minimum.
5. Enforce a six-character maximum.
6. Retain a strict six-digit numeric pattern.
7. Add an accessible helper description explaining which PIN is expected.
8. Associate the status/error text with the field through `aria-describedby`.
9. Make the reveal/hide control expose `aria-controls` and its pressed state.
10. Prevent withdrawal submission until PIN status is authoritative, a PIN is configured, and exactly six digits are entered.

Additional polish: `enterKeyHint="done"`, disabled autocapitalization/spellcheck, and an announced polite status for user feedback. No PIN is sent to Pi; the existing server-side PIN verification remains authoritative.

## CI/build regression protection

- Added `scripts/check-jsx-duplicate-props.mjs`, which uses the project's TypeScript parser to scan TSX/JSX source and fail on repeated static JSX attributes.
- Registered the guard at the beginning of `prebuild` and as a distinct GitHub Actions static-verification step.
- CI install steps now unset inherited `npm_config_cache_dir` / `NPM_CONFIG_CACHE_DIR` before `npm ci`, preventing that obsolete setting from contaminating npm's config in GitHub Actions.
- Existing read-only workflow permissions, Node 24.15.0 runtime, lockfile integrity check, and separate build/typecheck/lint gates are preserved.

## Warning disposition

- **npm `cache-dir`:** GitHub CI now clears the obsolete environment variable before install. The Vercel project still needs its Environment Variables checked: remove `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` if present. It is not defined in the repository `.npmrc`; a repository workaround would hide rather than fix the source.
- **`isomorphic-dompurify@3.20.0`:** npm deprecates this release because the Node engine-floor change was published under the wrong major. `4.x` is the corrected semver line, with no functional code change relative to `3.23.0`; however, package and lockfile updates require a clean Node 24.15.0 install and sanitizer tests. This environment only has Node 22.16.0, so no unverified lockfile edit was made.
- **`eslint@9.39.5`:** ESLint 9 is EOL as of 2026-08-06. `eslint-config-next@15.5.26` declares a peer range ending at ESLint 9, so upgrading ESLint to 10 alone would create a peer incompatibility. Resolve as a coordinated Next.js/ESLint compatibility migration, not by forcing ESLint 10 into this release.
- **`stellar-sdk`, `stellar-base`, `js-xdr`:** these are transitive legacy dependencies through `pi-backend@0.1.3`; no direct source imports were found. Current Stellar SDK 16/17 migrations contain breaking XDR and byte API changes. Do not replace them until the Pi backend integration is tested against the target SDK and transaction/auth flows.
- **`sodium-native` and `unrs-resolver` install scripts:** left unapproved. They are transitive/optional native build steps; do not grant install-script execution without reviewing package provenance, platform need, and clean-install behavior.

## Scope and safety

No payout/fee calculation, ledger, wallet authorization, Pi identity mapping, PIN hashing/verification, database migration, production approval, or deployment behavior was changed. No GitHub push or Vercel deployment was performed.

## Verification status

The new duplicate-prop gate and Phase 28 wallet consent regression checks are intended to run in the supported Node 24.15.0 CI environment. Local verification is limited by the available Node 22.16.0 runtime and the absence of a completed project dependency install. A full `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build` under Node 24.15.0 remains required before merging or deployment.

### Checks completed in this repair session

- JSX duplicate-prop scan: **210 TSX/JSX files**, no duplicate attributes.
- Phase 28 wallet consent static contract: **41/41**.
- Phase 28 wallet consent runtime contract: **9/9**.
- JSX safety scan: **1,033 files**, passed.
- Core Web Vitals/RUM contract: **17/17**.
- Feed controls/performance contract: **29/29**.
- Settings/performance contract: **14/14**.
- Independent hydration contract: **9/9**.
- Experience-quality contract: **9/9**.
- Resilience contract: **8/8**.
- Dependency lock integrity and root release version: passed.
- `package.json`/lockfile version and CI/prebuild guard wiring: passed.
- GitHub Actions workflow YAML parse: passed.
- Changed withdrawal TSX transpile diagnostics: **0**.

These are focused/static checks. The complete Node 24.15.0 clean install, full typecheck, lint, and production build were not run in this environment; the local runtime is Node 22.16.0 and the previous dependency installation did not complete. Do not treat this archive as a full CI green or production approval.

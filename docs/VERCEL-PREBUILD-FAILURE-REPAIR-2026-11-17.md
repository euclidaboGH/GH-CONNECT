# Vercel prebuild failure repair — 2026-11-17

## Current failing deployment

- Repository: `euclidaboGH/GH-CONNECT`
- Branch: `testnet`
- Commit in supplied Vercel log: `9d62357`
- Package: `gh-connect@0.338.93`
- Node runtime reported by Vercel: `24.22.3`
- Immediate failing gate: `scripts/check-phase10-release-closure.mjs`, CI build dependency assertion.

## Confirmed cause and repair

The workflow correctly declared `needs: [static]`, but the release checker only searched for the scalar text `needs: static`. The check therefore rejected a valid GitHub Actions flow-style sequence. The checker now recognizes scalar, flow-list, and block-list forms, and has an explicit regression assertion for all three.

Other source gates had similar stale assumptions about implementation details. They now validate the actual central contracts rather than requiring each caller to duplicate implementation text:

- Wallet transfer-request reads pass an 8-second timeout to `supabaseRest`; the shared REST client supplies `AbortSignal.timeout` and `cache: "no-store"`.
- Public profile identity hydration and social RPCs use the shared Supabase REST/RPC transport, which owns no-store behavior, service-role headers and bounded abort signals.
- Treasury and marketplace operator endpoints delegate to `operatorDiagnosticsAuthorized`; the shared verifier enforces a 32-byte minimum key and constant-time SHA-256 digest comparison.
- Durable GHC spend and marketplace order RPCs use the shared RPC transport with explicit 10-second bounds and no-store semantics.
- The Phase 1–12 hardening checks and Phase 3 identity checks now verify those delegated transport contracts.

A real TypeScript defect was also fixed in `executeDurableGhcSpend`: a second `const result` declaration shadowed the RPC result in the same scope. The parsed contract result now uses the distinct `parsedResult` identifier.

The migration-source scanner found 170 distinct executable GreenHaven table names across 229 migrations, not the stale hard-coded 146. The checker now pins the verified source count at 170 and still excludes SQL comments and proposal-only examples. This is a source inventory only, not evidence of applied database state.

The CI workflow now removes stale user-level npm `cache-dir` configuration, records the npm version, cancels superseded runs for the same ref, and uploads Next.js trace/diagnostic artifacts when the build job fails. The workflow retains read-only repository permissions and Node.js 24.15.0.

Additional stale release assertions were aligned with the source tree: archived upgrade worklogs are recognized in their canonical archive location; the current build context explicitly supersedes historical prompts/worklogs; the Phase 28 duplicate-JSX checker is verified through the prebuild hook invoked by CI's build; and touch-target checks accept the ecosystem search input's 48px control.

The Field Research Studio no longer uses native `window.prompt` for clipboard fallback; it uses GreenHaven's shared accessible prompt dialog.

## Verification results

- `npm run verify:static`: **PASS — 63/63 consolidated suites**. The command also completed all additional chained wallet, payment, marketplace, treasury, documentation, community, research and evidence checks with no failures.
- Phase 10 release closure: 17/17.
- Services release boundary: 10/10; Services remains Coming Soon and unwired.
- Phase 9 membership release gate: 16/16.
- Phase 2 transfer integrity: 8/8.
- Phase 7 treasury operations: 11/11; Phase 7 treasury completion: 16/16.
- Phase 12 final integration/release readiness: 28/28.
- Phase 17 CI governance: 16/16.
- Phase 19 marketplace RPC transport: 12/12.
- Run 304 filter/search release: 30/30.
- Scoped Evidence Engine: 25/25; file-signature tests: 16/16.
- `scripts/run-prebuild-checks.mjs --dry-run`: enumerates 359 prebuild checks. This was a dry run only; it does not claim the 359 checks executed.

## Dependency and build limits

This workspace is Node.js 22.16.0 with npm 10.9.2 and no installed project `node_modules`; the project requires Node.js `^24.15.0`. A supported-runtime `npm ci`, the full 359-check prebuild, dependency-backed typecheck, lint, Next.js production build and browser/device acceptance have **not** been run here. The Vercel log's 22 npm audit vulnerabilities and deprecated `isomorphic-dompurify`, `js-xdr`, `stellar-base`, `stellar-sdk`, and `eslint` warnings remain open. No unverified force-upgrade or transitive Stellar override was made.

## Coming Soon implementation boundary

The registry remains 12 Active and 30 Coming Soon. The existing 30-track-per-service plan generator provides 1,260 scoped objectives across all 42 registered services. Those objectives are plans and acceptance gates, not completed features. Existing prepared Events, Charity, Creator Tools and Services code remains fail-closed and unwired while those services are Coming Soon. This repair does not claim that all 30 Coming Soon services or all 900 service-specific planned features have been implemented.

## Safety

No GitHub push, Vercel deployment, Supabase migration, Mainnet mutation, financial transaction, scanner activation, or Coming Soon enablement was performed. Production remains **NOT APPROVED**.

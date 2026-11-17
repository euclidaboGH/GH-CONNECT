# Vercel prebuild failure repair — 2026-11-17

## Current failing deployment

- Repository: `euclidaboGH/GH-CONNECT`
- Branch: `testnet`
- Commit in supplied Vercel log: `9d62357`
- Package: `gh-connect@0.338.93`
- Node runtime reported by Vercel: `24.22.3`
- Immediate failing gate: `scripts/check-phase10-release-closure.mjs`, CI build dependency assertion.

## Confirmed cause and repair

The workflow correctly declared `needs: [static]`, but the release checker only searched for the scalar text `needs: static`. The check therefore rejected a valid GitHub Actions flow-style sequence. The checker now recognizes scalar, flow-list, and block-list forms, and has an explicit regression assertion for all three. The Phase 10 release closure check passes 17/17.

A second stale assertion in the Services release-boundary check required the Marketplace screen itself to contain a literal `kind === "service"` expression. Service-kind support is actually represented by the canonical Marketplace listing type, listing presentation mapper, and active seller command centre. The check now verifies those source contracts rather than a brittle implementation spelling. Services release-boundary check passes 10/10; the service remains Coming Soon and unwired.

A stale Phase 9 check also depended on old project-truth prose. It now checks the actual asset-separation policy and current `NOT APPROVED` source-of-truth marker. The Phase 9 membership gate passes 16/16.

Historical worklog fixtures referenced by source checks were restored and explicitly marked as legacy evidence, not current product authority.

## Broader static verification findings

The full `npm run verify:static` was attempted twice under the available Node.js 22.16.0 runtime. The latest attempt reached 56/63 suites and exited non-zero. Remaining failures include stale assertions and source gaps in profile identity no-store/timeout checks, wallet transfer REST timeout checks, database table-count expectations (source scan found 170 versus a hard-coded 146), treasury operator-key checks, source-only migration/runtime documentation checks, and the Phase 1–12 hardening audit. These remain release blockers; they have not been hidden or marked passed.

## Dependency and build limits

The Vercel log still reports 22 npm audit vulnerabilities and deprecated `isomorphic-dompurify`, `js-xdr`, `stellar-base`, `stellar-sdk`, and `eslint` packages. No unsafe force-upgrade or transitive Stellar override was made. This workspace is Node.js 22.16.0 with no installed project dependencies, while the supported runtime is Node.js 24.15.0. A Node 24 clean install, typecheck, lint, and Next.js production build have not been run here.

## Coming Soon implementation boundary

The registry remains 12 Active and 30 Coming Soon. The existing 30-track-per-service plan generator provides 1,260 scoped objectives across all 42 registered services. Those objectives are plans and acceptance gates, not completed features. Existing prepared Events, Charity, Creator Tools and Services code remains fail-closed and unwired while those services are Coming Soon. This repair does not claim that all 30 Coming Soon services or all 900 service-specific planned features have been implemented.

## Safety

No GitHub push, Vercel deployment, Supabase migration, Mainnet mutation, financial transaction, scanner activation, or Coming Soon enablement was performed. Production remains NOT APPROVED.

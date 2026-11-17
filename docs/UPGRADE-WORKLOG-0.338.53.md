# GreenHaven 0.338.53 — Run #292 Full-project CI and source-consistency repair

Date: 2026-11-11  
Source baseline: `0.338.53` full-project bundle  
Scope: release-documentation consistency, Active-module filter integration, Vercel prebuild cache-policy correction

## Trigger

The connected Vercel `testnet` build reached the prebuild suite but failed a Phase 26 wallet-ledger resilience assertion concerning incremental TypeScript build caches. A broader network-independent static verification also exposed stale release pointers in two legacy verification fixtures and a missing current-version worklog referenced by the request-boundary regression contract.

## Changes

1. Corrected the Phase 26 cache-policy gate. Generated TypeScript build-info files are permitted in a build workspace only when Git and Vercel exclude them from source releases; tracked or unignored cache files still fail the gate.
2. Extended the existing Vercel build-prep regression test with a simulated Git worktree, ignored `.cache` / `.next` / root build-info artifacts, and a force-tracked negative case.
3. Synchronized the Phase 1–12 system acceptance fixture and Phase 12 release-readiness fixture with package baseline `0.338.53`, retaining their legacy/non-authoritative labels and the explicit **NOT APPROVED for production** status.
4. Added this current-version worklog so request-boundary source verification can validate the current baseline and its actual Node 24.15.0 runtime limitation.
5. Preserved the shared responsive filter workspace across all 11 Active modules: Community, GH Chat, Connections, Matches, Marketplace, Orders, Wallet, GHC, Pi Payments, Rewards and Membership.

## Focused validation

- Phase 26 wallet-ledger resilience: 17/17.
- Vercel build-prep regression: 8/8.
- Vercel build hygiene: 17/17.
- Active-module filter contracts: 14/14.
- Phase 10 filtering: 17/17.
- Phase 10.2 filter contract: 34/34.
- Wallet Phase 5 release gate: 19/19.
- Dependency lock identity and declared dependency coverage: PASS.
- Documentation hygiene: PASS.
- Consolidated `npm run verify:static`: 61/61 checks passed.
- Prebuild manifest: 315/315 commands enumerated in dry-run mode; not executed under the unsupported local Node runtime.

The full network-independent source-only verification (`npm run verify:static`) was also executed under the available Node 22.16.0 runtime and exposed the documentation failures addressed in this worklog. It was rerun after the documentation repair and passed all 61/61 static checks; documentation hygiene also passed. The 315-step prebuild manifest was enumerated in dry-run mode only. This environment runs Node.js 22.16.0 and does not satisfy the project's Node.js 24.15.0 minimum requirement; it also has no dependency-backed install. A full supported-runtime typecheck, lint, production build, browser/device acceptance, and live Testnet operator verification are not claimed.

## Dependency warnings and audit boundary

The latest Vercel install log reports 22 npm audit vulnerabilities (1 low, 6 moderate, 13 high, 2 critical) and deprecation notices for `isomorphic-dompurify@3.20.0`, `js-xdr@1.3.0`, `stellar-base@8.2.2`, `stellar-sdk@10.4.1`, and `eslint@9.39.5`. The local npm audit request failed with `EAI_AGAIN` while reaching `registry.npmjs.org`, so the complete advisory graph and fix availability could not be verified. No blind force-fix, Pi/ Stellar SDK override, sanitizer major upgrade, or isolated ESLint major upgrade was made. These require a registry-connected Node 24.15+ clean install and compatibility verification.

## Financial and deployment safety

Pi-funded GHC acquisition, paid business checkout, withdrawals, payouts, membership payment execution and other financially sensitive operations remain gated. No database migration, Supabase write, financial mutation, Pi provider operation, Mainnet operation, GitHub push, Vercel deployment or production promotion was performed. Production remains **NOT APPROVED**.

# Vercel Phase 26 incremental-cache gate repair

Date: 2026-11-11  
Project baseline: GH-CONNECT 0.338.53  
Observed Vercel branch: `testnet`  
Observed failing deployment commit: `0aa4d109d861a632c1cb98086715136a18612476`

## Verified failure

The Vercel deployment reached prebuild check 233/315 and the Phase 26 wallet-ledger resilience contract reported 16/17. The only failed assertion was:

`incremental build cache is excluded from source releases`

The source already configured TypeScript incremental output at `.cache/tsconfig.tsbuildinfo`, ignored `.cache/` and `*.tsbuildinfo` in Git, and excluded `.cache`, `.next`, and `*.tsbuildinfo` in `.vercelignore`. The check also walked generated build output and then required the root-level `tsconfig.tsbuildinfo` file not to exist. That final condition was inconsistent with the stated policy: a generated TypeScript build-info file is acceptable in a build workspace when Git and Vercel both exclude it from source releases. Vercel restores build caches before running the build, so this made the gate sensitive to generated cache state rather than whether cache files were tracked or uploaded.

## Repair

- Removed the false requirement that a generated root `tsconfig.tsbuildinfo` file must be absent from the build workspace.
- Strengthened the policy assertion to verify Vercel excludes `.next`, `.cache`, their contents, and `*.tsbuildinfo` from source uploads.
- Kept the Git ignore and configured TypeScript build-info path checks.
- Kept the recursive check that rejects any discovered build-info file that is not ignored or is tracked by Git.
- Extended the existing Vercel build-prep regression test to create ignored `.cache`, `.next`, and root-level build-info files and prove they do not fail the gate; a force-tracked build-info file must still fail.

## Verification

- Phase 26 wallet-ledger resilience: 17/17 passed locally.
- Vercel build-prep regression: 8/8 passed locally.
- Test includes a simulated Git worktree, ignored generated caches, and a force-tracked cache negative case.

## Remaining items / release boundary

The Vercel install log separately reported 22 npm audit vulnerabilities (1 low, 6 moderate, 13 high, 2 critical) and deprecation warnings for `isomorphic-dompurify@3.20.0`, `js-xdr@1.3.0`, `stellar-base@8.2.2`, `stellar-sdk@10.4.1`, and `eslint@9.39.5`. An audit request from the local environment could not reach `registry.npmjs.org` (`EAI_AGAIN`), so the exact advisory paths and safe fixes could not be established. No blind `npm audit fix --force`, Stellar override, Pi SDK replacement, DOMPurify major upgrade, or ESLint/Next major upgrade was applied. Those changes require a registry-connected Node 24.15+ environment and their own compatibility tests.

No financial mutation, Pi payment, GHC minting, paid checkout, withdrawal, settlement, migration, production configuration, GitHub commit, or Vercel deployment was changed by this local repair. Financial release gates remain intact.

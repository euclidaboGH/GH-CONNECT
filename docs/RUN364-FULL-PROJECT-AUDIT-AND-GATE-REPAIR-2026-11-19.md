# RUN364 — Full project audit and release-gate repair

**Date:** 2026-11-19  
**Source archive:** `GREENHAVEN-0_338_99-RUN363-PHASE9-SETTINGS-FILTERS-DOC-GATE-FIX-2026-11-19.zip`  
**Package:** `gh-connect@0.338.99`  
**Candidate:** RUN364 local source derivative; not pushed or deployed.  
**Production status:** **NOT APPROVED**.

## Executive result

The supplied RUN363 deployment log exposed the Phase 8 programme-document gate. The Phase 8 report was present in `docs/archive/historical-implementation-records/`, but its checker only searched the canonical `docs/` location. The same stale-path assumption existed in several other historical release checks. RUN364 repairs the shared resolver and the affected checkers, rather than copying or moving old records back into the canonical directory.

The broader source audit also found an outdated Run 277 Pi-auth assertion and an unsafe default in the sample environment template. Both were corrected. The complete `npm run verify:static` command completed with exit code 0. The 396-check prebuild manifest was enumerated, but not executed because this workspace runs Node 22.16.0 and the project requires Node `^24.15.0`.

## Repairs made

### 1. Historical documentation resolution

Extended `scripts/lib/read-project-doc.mjs` so `hasProjectDoc()` and `readProjectDoc()` resolve documents from:

- their canonical `docs/` path;
- `docs/archive/historical-implementation-records/`, including nested historical names encoded with `docs__`;
- `docs/archive/upgrade-worklogs/`;
- `docs/archive/phase-notes/`.

Updated the affected source gates to use the shared resolver, including Phase 1 architecture/outbox, Phases 4–9, Phase 10 marketplace integrity, Phase 11 wallet reconciliation, Phase 12 earnings, Phase F production proof, Phase 3 database recovery, Phase 5 design system, Phase 6 navigation, historical worklog checks, and Run 270/303 reports. Where a checker validates document contents, it now reads the resolved historical document rather than merely accepting its existence.

No historical report was duplicated, rewritten, or silently promoted into current operational evidence.

### 2. Pi authentication regression contract

Run 277 still asserted that the old `waitForWindowPi(14s)` implementation existed in `contexts/pi-auth-context.tsx`. The current implementation instead waits for the official SDK bridge in `lib/pi-runtime.ts` and applies a 25-second timeout to the official authorization prompt. Updated the regression assertions to test the current behavior:

- bounded SDK bridge readiness wait (`waitForPi(10000, 150)`);
- bounded official Pi authorization prompt (`authTimeoutMs = 25000`);
- token-free timeout diagnostics and existing server-side identity verification remain required.

This changes stale test expectations, not the Pi authentication scopes or server verification boundary.

### 3. Registration bonus default

Changed `.env.example` from `GHC_REGISTRATION_BONUS_ENABLED=1` to `GHC_REGISTRATION_BONUS_ENABLED=0`. The registration bonus remains disabled by default and requires explicit operator enablement plus `NEXT_PUBLIC_PI_SANDBOX=true`. The server-side fail-closed check remains intact.

### 4. Release and security policy

No dependency version, `package.json`, or `package-lock.json` was changed. The dependency security gate remains fail-closed. No npm audit suppression, `--force` upgrade, or Pi/Stellar override was introduced.

## Verification

| Verification | Result |
|---|---:|
| `npm run verify:static` | **PASS — exit 0** |
| Consolidated static verifier | 63/63 |
| Phase 8 profile & matching | 14/14 |
| Phase 9 settings & filters | 15/15 |
| Phase 4 identity & authentication | 16/16 |
| Phase 5 messages & notifications | 19/19 |
| Phase 6 communities & discovery | 15/15 |
| Phase 7 marketplace commerce | 15/15 |
| Phase 10 platform acceptance | 24/24 |
| Phase 10 release closure | 17/17 |
| Phase 1 outbox contract | 13/13 |
| Phase 1 architecture foundation | 12/12 |
| Phase 12 earnings final gate and child suites | PASS |
| Phase F production proof and child suites | PASS |
| Phase 3 database recovery + restore catalog | 25/25 + 10/10 |
| Phase 5 design system | 23/23 |
| Phase 6 shell navigation | 21/21 |
| Phase 11 wallet reconciliation | 32/32 |
| Run 277 Pi auth regression | 30/30 |
| Registration bonus fail-closed contract | 18/18 |
| Dependency security policy source contract | 11/11 |
| Prebuild manifest | 396 checks enumerated; dry-run only |

The source-only static suite passing does not replace the supported-runtime build. The full 396 prebuild execution, dependency-backed TypeScript check, ESLint run, Next.js production build, Pi Browser/device acceptance and hosted Preview verification remain outstanding.

## Dependency security audit — still blocking release

The supplied GitHub Actions artifact `npm-audit-44417589918-1.zip` contains the complete npm audit JSON. The report records **22 vulnerable package entries: 2 critical, 13 high, 6 moderate and 1 low**. The extracted JSON SHA-256 is `3dcd703a3f426ec02c246061b401f6a3c6996ae417bb16d41cf62cfc597f9ac1`.

| Package | Locked version | Severity | Audit remediation signal |
|---|---:|---|---|
| `next` | 15.5.26 | Critical | npm identifies 15.5.29 as a compatible patch candidate |
| `dompurify` | 3.4.15 | Critical | Fix available; exact version must be resolved by fresh registry audit |
| `@playwright/test` | 1.55.0 | High | Fix available |
| `playwright` | 1.55.0 | High | Fix available |
| `@simplewebauthn/server` | 13.2.2 | Low | npm identifies 13.3.3 (non-major) |
| `@typescript-eslint/eslint-plugin` | 8.70.0 | Moderate | Fix available |
| `@typescript-eslint/parser` | 8.70.0 | Moderate | Fix available |
| `@typescript-eslint/type-utils` | 8.70.0 | Moderate | Fix available |
| `@typescript-eslint/typescript-estree` | 8.70.0 | Moderate | Fix available |
| `@typescript-eslint/utils` | 8.70.0 | Moderate | Fix available |
| `axios` (nested under Stellar) | 0.25.0 | High | No fix reported by this audit |
| `brace-expansion` | 1.1.18 and 5.0.9 | High | Fix available |
| `follow-redirects` | 1.16.0 | High | Fix available |
| `minimatch` (nested) | 10.2.6 | Moderate | Fix available |
| `postcss` (nested under Next) | 8.4.31 | High | npm identifies the Next 15.5.29 update path |
| `sharp` | 0.35.4 | High | Fix available |
| `source-map-js` | 1.2.1 | High | Fix available |
| `undici` | 8.10.2 | High | Fix available |
| `zod` | 3.25.67 | High | Fix offered as 4.6.7, a major-version change requiring compatibility review |
| `pi-backend` | 0.1.3 | High | No fix reported by this audit |
| `stellar-sdk` | 10.4.1 | High | No fix reported by this audit |
| `toml` | 2.3.6 | High | No fix reported by this audit |

The unresolved `pi-backend → stellar-sdk → axios/toml` dependency chain is compatibility-sensitive. Do not override or replace it without an official compatible Pi backend release and Pi Testnet payment/authentication regression evidence. The Zod remediation is marked as a major update by npm and must not be applied as a routine patch. For the remaining fixable packages, refresh the audit in a registry-connected Node 24.15.0 environment, update the manifest and lockfile through npm, then run the complete install, static suite, typecheck, lint, build and Pi Testnet integration tests.

A local `npm audit --json` attempt could not reach `registry.npmjs.org` (`EAI_AGAIN`). Therefore the supplied artifact is the exact available audit baseline, not a fresh audit after remediation. **The 22 findings remain unresolved and the security gate must continue to block release.**

## Runtime, deployment and data safety

- Local Node is 22.16.0; project runtime is `^24.15.0`.
- Project dependencies are not installed in this workspace.
- No complete prebuild execution, typecheck, lint, or Next.js build is claimed.
- No GitHub push, Vercel deployment or production promotion was performed.
- No Supabase SQL was changed or applied; Testnet and Mainnet were not mutated.
- No wallet, ledger, payout, withdrawal, payment, membership or user financial state was changed.
- Mainnet remains untouched; Pi A2U/live transfers remain under existing fail-closed controls.
- Production remains **NOT APPROVED**.

## Next required actions

1. Run dependency remediation on Node 24.15.0 with registry access, beginning with Next.js 15.5.29 and compatible patched transitive dependencies.
2. Obtain a fresh full npm audit JSON after each lockfile update; resolve or explicitly review every remaining finding.
3. Obtain an official Pi-compatible resolution for the `pi-backend` / Stellar chain; do not force transitive overrides.
4. Execute all 396 prebuild checks on Node 24.15.0, then typecheck, lint, and the complete Next.js build.
5. Verify the resulting Testnet Preview and Pi Browser flows before any release decision.

**RUN364 is a source-only audit and repair candidate, not a deployment or production approval.**

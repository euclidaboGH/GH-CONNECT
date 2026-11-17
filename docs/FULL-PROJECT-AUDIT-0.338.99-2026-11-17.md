# GH-CONNECT full project audit — 0.338.99 / Run 317

**Date:** 2026-11-17  
**User-designated source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Working candidate:** `gh-connect@0.338.99` (local derivative only)  
**Branch examined:** `testnet`  
**Production status:** **NOT APPROVED**

## 1. Executive finding

The supplied failure was not caused by TypeScript errors or ESLint failures in the latest 0.338.98 CI run. The connected GitHub Actions run #317 (`44117254191`, commit `c3bba4e67967e59b644e18e0581739d0092ef9be`) independently confirms:

- TypeScript typecheck: passed.
- ESLint: passed.
- All 362 prebuild checks: passed.
- Next.js production build: failed with Webpack `UnhandledSchemeError` for `node:crypto`.

The connected Vercel deployment for the same commit (`dpl_BXiwaMrj9Zn1W4ynN24NYyvCSp1P`) is in `ERROR` state. Its build log gives the import trace:

`app/page.tsx` → `contexts/ghc-context.tsx` → `lib/ghc-data.ts` → `lib/secure-id.ts` → `node:crypto`.

This identifies the actual compilation boundary failure. The shared ID helper dynamically loaded Node crypto as a fallback, and `lib/ghc-data.ts` dynamically required that helper. Since `ghc-data.ts` is part of the browser application graph, Webpack attempted to resolve the Node scheme in a client compilation.

## 2. Surgical source repairs

### 2.1 Browser-safe cryptographic IDs

- Replaced Node `require("node:crypto")` fallbacks in `lib/secure-id.ts` with `globalThis.crypto` Web Crypto.
- UUID v4 fallback uses 16 secure random bytes and sets the RFC 4122 version/variant bits.
- `secureHex` retains bounded byte requests (1–64 bytes).
- If Web Crypto is unavailable, the helper throws `SECURE_RANDOM_UNAVAILABLE`; it never downgrades to `Math.random()`.
- `lib/transactions.ts` and `lib/ghc-data.ts` now statically import the shared helper using explicit relative `.ts` paths. This also keeps direct Node runtime tests resolvable under the project's TypeScript-strip test runner.

### 2.2 Push-notification server boundary

- Removed `node:crypto` from `lib/notification-push-contract.ts`, leaving endpoint/key/category validation as pure shared code.
- Moved SHA-256 endpoint fingerprinting into `lib/server/notifications/push-hash.ts`.
- `lib/server/notifications/push-architecture.ts` retains the existing server-facing `hashPushEndpoint` export and delegates to the isolated server module.
- Updated the push contract runtime test to import the hashing helper from the server module separately.
- Hash output remains SHA-256 lowercase hex; endpoint validation semantics remain unchanged.

### 2.3 Regression and release metadata

- Added `scripts/check-run317-browser-safe-crypto.mjs` (9 source-boundary assertions).
- Added `scripts/test-run317-browser-safe-crypto.mjs` (7 Web Crypto runtime assertions).
- Registered both checks in `prebuild:checks`, `pretypecheck`, `prelint` and `verify:static`.
- Bumped package, lockfile, app release and current source metadata to `0.338.99`.
- Regenerated the verified migration inventory. It remains 229 SQL files; no SQL migration source was changed.
- Preserved the production no-go gate and all wallet, payout, Pi, order, and database authority boundaries.

## 3. Verification performed

| Check | Result |
|---|---:|
| Run 317 browser-safe crypto boundary | 9/9 |
| Run 317 Web Crypto runtime | 7/7 |
| Push-notification contract runtime | 19/19 |
| Run #299 Vercel build contract | 20/20 |
| Run #300 release integrity | 22/22 |
| Run #301 release-gate hardening | 20/20 |
| Run #313 transaction-coordinator source | 8/8 |
| Run #313 transaction-coordinator runtime | 12/12 |
| Run #315 CI lint remediation source contract | 9/9 |
| Run #314 screen experience | 15/15 |
| Release hygiene | 17/17 |
| Documentation hygiene | PASS |
| JSX safety | 1,155 files scanned |
| Dependency lock consistency | PASS |
| Migration inventory | 229/229; unchanged SQL source set |
| Full `npm run verify:static` | PASS |
| Prebuild manifest dry run | 363 checks discovered |

The 0.338.98 connected GitHub run is the authoritative dependency-backed typecheck/lint evidence for that exact source revision. The 0.338.99 local candidate has not yet had a fresh hosted Node 24.15.0 dependency-backed typecheck/lint/production-build run. This environment has Node 22.16.0 and no installed project `node_modules`; therefore no full Next.js production build is claimed for 0.338.99.

## 4. Vercel build environment and resource findings

The failed Vercel deployment was built in `iad1` on a 2-core / 7-GB machine. The build-system report explicitly said no memory or disk-space problems were detected. It reported approximately 692 MB source input, 756 MB node_modules, less than 1 MB build cache, and 2 MB output. The failure was Webpack's unresolved `node:crypto` scheme, not an OOM or disk-capacity failure.

## 5. Dependency warnings and security audit — still open

The same Vercel install log reported these deprecation warnings:

- `isomorphic-dompurify@3.20.0`: package warns that the minimum Node version changed without a major version bump; its notice recommends 4.x for the new Node floor or 3.19.0 for older Node runtimes.
- `js-xdr@1.3.0`: package moved to `@stellar/js-xdr`.
- `stellar-base@8.2.2`: package moved to `@stellar/stellar-base`.
- `stellar-sdk@10.4.1`: package moved to `@stellar/stellar-sdk`.
- `eslint@9.39.5`: npm reports this release line as no longer supported.

The Vercel install also reported **22 dependency vulnerabilities**: 1 low, 6 moderate, 13 high and 2 critical.

The lockfile shows `stellar-sdk@10.4.1` is brought in by `pi-backend@0.1.3`, and `stellar-base@8.2.2` brings `js-xdr@1.3.0`. These are transitive compatibility-sensitive dependencies in the Pi backend path. They were not upgraded blindly because doing so could change SDK behavior and requires compatibility testing against Pi Platform flows.

An attempt to retrieve the complete npm advisory report from this workspace failed because `registry.npmjs.org` DNS resolution returned `EAI_AGAIN`. Therefore the exact affected package/advisory paths and safe fixed versions are not available here. **The deprecation and vulnerability warnings are not represented as fixed in this candidate.** Do not run `npm audit fix --force` or mass-upgrade the Pi SDK dependency chain without the full advisory report and regression tests.

Recommended next dependency remediation step: obtain `npm audit --json` from a network-enabled Node 24.15.0 environment, map each advisory to its dependency path and fixed version, then update only compatible ranges with Pi Testnet integration tests. Update `isomorphic-dompurify` and ESLint only after checking Next.js 15.5.26 compatibility and the lockfile's actual fixed releases.

## 6. Database, deployment and financial safety

- No Supabase SQL was changed or applied.
- No migration was applied to Testnet or Mainnet.
- Migration inventory remains 229 files; 106 are still classified REVIEW_REQUIRED, 2 PROPOSAL, 1 REQUIRES_APPROVAL and 120 REQUIRED for operator review.
- No GitHub push or branch mutation was performed.
- No Vercel deployment or production promotion was performed.
- No wallet balance, ledger, reward, withdrawal, PIN, consent, payment, order or membership authority was changed.
- Pi A2U execution and Mainnet remain disabled under the existing release safeguards.

## 7. Release decision

Run 317 removes the verified Webpack `node:crypto` client-bundle cause and adds regression coverage. It does **not** prove the next hosted build has passed. The 22 npm audit vulnerabilities and deprecation warnings remain a separate security/dependency workstream. Production remains **NOT APPROVED** until:

1. The 0.338.99 candidate passes GitHub typecheck and ESLint on Node 24.15.0.
2. The Vercel Preview production build completes successfully.
3. The full npm advisory report is reconciled and critical/high findings are addressed or explicitly accepted with documented rationale.
4. Browser/Pi Browser/Android acceptance and required Testnet provider/database postflight are complete.
5. All held migrations and external providers receive their required independent operator review.

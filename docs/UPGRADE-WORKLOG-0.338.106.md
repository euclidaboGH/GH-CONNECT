# GreenHaven upgrade worklog — 0.338.106

**Date:** 2026-11-19  
**Parent:** 0.338.105 RUN378–RUN380 Phase 3–6 source candidate  
**Package:** `gh-connect@0.338.106`  
**Status:** source-only configuration and component review; not pushed or deployed.

## Scope

- Review `.gitignore`, `.nvmrc`, `components/`, `eslint.config.mjs`, `middleware.ts`, `next.config.mjs`, `package-lock.json`, `postcss.config.mjs`, `.env.example`, `.npmrc`, `.vercelignore`, `package.json`, `README.md`, `vercel.json`, `tsconfig.json`, and `VERIFIED_MANIFEST.txt`.
- Remove the stray top-level `verify:static` key from `package.json`; preserve the real npm script under `scripts`.
- Synchronize package, lockfile root, in-app release, README, source-of-truth and project-truth versions to 0.338.106.
- Expand `.env.example` to cover project-owned runtime configuration with blank secrets and disabled-by-default test/operator features.
- Add release-hygiene checks for script placement, duplicate environment keys and Pi Testnet/API-mode separation.
- Correct stale hardcoded release-version assertions in Phase 5/6 source checks.
- Clarify that inbound request IDs are untrusted correlation metadata; middleware behavior is unchanged.
- Regenerate the migration inventory and `VERIFIED_MANIFEST.txt` from canonical SQL sources.

## Component review

Reviewed 214 TSX files. All nine raw `<img>` elements have alt attributes; all 22 `_blank` anchors include `rel`; the single `dangerouslySetInnerHTML` use renders locally generated QR SVG through `encodeQrSvg`. No component behavior was changed because no evidence-supported functional defect was established. The 205 KB Marketplace screen is a profiling/refactoring candidate, not proof of a runtime performance defect.

## Verification

- Release hygiene 20/20; project truth 11/11; documentation hygiene passed.
- RUN378 10/10; RUN379 21/21; RUN380 12/12.
- Phase 5 runtime acceptance guard 15/15.
- Run #305 quiet-premium interface 12/12; Phase 2 visual cohesion 13/13; Pass 48 accessible navigation passed.
- Pi environment classification 7/7; RUN332 audit remediation 16/16; RUN337 environment/ignore checks 7/7; RUN375 ACL proposal checks 11/11.
- API CSRF contract 7/7; Phase 1–12 hardening 19/19; RUN372 field isolation 8/8; public route boundary 12/12.
- Dependency-lock coverage and generated migration inventory passed; 231 SQL files remain classified 122 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 106 REVIEW_REQUIRED.
- Prebuild runner discovered 408 checks in dry-run mode; the complete prebuild command list was not executed.

## Limitations and release boundary

Node 22.16.0 is available; Node 24.15.0 is required. Dependencies are absent, so `npm ci`, full TypeScript, ESLint, production build and AST-based JSX checks were not run. The known dependency audit remains at 22 findings (1 critical, 13 high, 6 moderate, 2 low). Browser/device, live Testnet, database concurrency/query-plan and production CSP/Pi SDK acceptance remain outstanding. Testnet remains NOT CERTIFIED; Mainnet remains NOT APPROVED. No database, ledger, payment, payout, Pi transfer, GitHub or deployment operation was performed.

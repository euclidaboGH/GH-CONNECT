# RUN368 — Source-of-truth audit and documentation hygiene repair

Date: 2026-11-19
Source archive: RUN365 full project archive supplied by the project owner.

## Source identity

- Package version: `0.338.99`.
- Node engine: `^24.15.0`; `.nvmrc` pins `24.15.0`.
- ZIP integrity: verified before extraction; 3,286 entries; root `run359/`.
- Archive SHA-256: `334a2fb91693933b7b8a588cce922e60ef52353ae5b6209c0927738de2e84224`.
- SQL migration source manifest: 231/231, as verified by the repository's static verification suite.

## Confirmed local defect repaired

`npm run verify:static` on the supplied RUN365 archive failed only at its final documentation-hygiene stage because `docs/security/RUN365-AUDIT-AND-FIX-2026-11-19.md` was not explicitly classified in `scripts/check-doc-hygiene.mjs`.

The report is a legitimate current engineering record. Added its exact path to the checker's required-document set. This is a narrow allow-list correction; the recursive scan and unclassified-document rejection remain enabled. No historical report was moved, deleted, or duplicated.

## Focused regression evidence

- `scripts/check-run343-pi-auth-timeout.mjs`: 8/8 PASS.
- `scripts/check-run344-pi-auth-diagnostics-ux.mjs`: 10/10 PASS.
- Before the fix, `npm run verify:static` reached the end of the suite and reported exactly one failure: the RUN365 audit document above. All preceding printed checks, including the 231/231 migration source manifest, passed.
- After the fix, `npm run verify:static` was rerun; final result recorded separately in the delivery summary.

## Dependency security findings — unresolved

The committed audit snapshot `docs/security/RUN364-NPM-AUDIT-2026-11-18.json` reports 22 findings: 2 critical, 13 high, 6 moderate, and 1 low. It identifies, among others:

- `next` 15.5.26 (critical; npm's report identifies 15.5.29 as a non-major fix candidate).
- `dompurify` 3.4.15 (critical; affected range includes versions through 3.4.16).
- `@playwright/test` / `playwright`, `sharp`, `undici`, `follow-redirects`, `source-map-js`, `brace-expansion`, `minimatch`, and `@typescript-eslint/*` findings.
- `@simplewebauthn/server` 13.2.2 (low; npm's report identifies 13.3.3 as a non-major fix candidate).
- `zod` 3.x with a fix candidate in 4.x, which is a major migration.
- `pi-backend` -> `stellar-sdk` -> nested Axios and TOML advisories, with no automatic fix reported in this snapshot.

No dependency or lockfile edits were made in this run. The latest uploaded RUN365 archive does not include a fresh npm audit result; the committed report is dated 2026-11-18. A secure remediation requires a clean Node 24.15.0 install, compatible direct/transitive upgrades, lockfile regeneration, test coverage, and a fresh registry audit. Do not use `npm audit fix --force`, speculative overrides, or a weakened security gate.

## Verification boundaries

The local container is Node 22.16.0, below the declared project engine. It can run the two focused Pi-auth checks above, but it cannot certify the project's Node 24.15.0 CI build. The user-supplied Vercel excerpt shows checks 395 and 396 beginning/passing individual assertions, but does not prove the entire 396-check chain, TypeScript, ESLint, or Next.js production build completed successfully.

## Operational safety

- Production remains NOT APPROVED.
- No GitHub push, Vercel deployment, Supabase migration, or Mainnet operation was performed.
- Pi Testnet financial boundaries, server-side identity verification, GHC/economy invariants, and the dependency security gate were not weakened.

## RUN369 — Vercel production-build TypeScript repair

The project owner supplied a Vercel build log showing that all 396 prebuild checks completed and Next.js compilation succeeded, but TypeScript validation failed at `features/orders/index.ts`: the barrel explicitly re-exported `normalizeOrderTimeline`, `buyerCanConfirmDelivery`, and `sellerCanStartFulfilment` from `lib/active-upgrades/orders.ts`, where none of those exports exists.

The actual canonical modules were inspected. The active-upgrades module provides `isTerminalOrderStatus` and `orderStatusLabel`; the marketplace lifecycle module already provides the canonical lifecycle helpers and remains wildcard-exported by the barrel. The barrel was corrected to explicitly re-export only the two helpers that actually exist, while retaining the canonical lifecycle wildcard. No placeholder or guessed implementations were added, and no order transition authority was moved to the client.

Added `scripts/check-run369-orders-barrel.mjs` and wired it into `verify:static` so every explicit named re-export in this barrel is checked against its source module. The guard reports 2/2 named exports valid and confirms the canonical lifecycle wildcard remains present.

Verification after this repair:
- Active-module regression suite: 59/59 PASS (Node's experimental TypeScript stripping mode).
- RUN350 economy surfaces: 14/14 PASS.
- Documentation hygiene: PASS.
- Full `npm run verify:static`: exit 0, including dependency policy 11/11, fee/referral 10/10, RUN343 8/8, RUN344 10/10, and the new RUN369 export-contract guard.

The local environment remains Node 22.16.0, not the project's required Node 24.15.0, and has no installed project dependencies. Therefore this run does not claim a completed local Next.js production build or a clean Vercel deployment. The exact reported missing-export defect is repaired at source; the next Vercel build must confirm the subsequent type-check stages. The separate 22-finding dependency audit snapshot remains unresolved and the security gate stays enabled.

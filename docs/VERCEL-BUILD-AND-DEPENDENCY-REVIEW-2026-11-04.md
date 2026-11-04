# Vercel build and dependency review — 2026-11-04

## Confirmed build blocker and correction

The supplied Vercel log fails in `prebuild` at `scripts/check-pass21-discovery-intelligence.mjs` (8/9). The discovery screen already imports and calls `buildDiscoveryOutcome` from `lib/discovery-outcome.ts`, and renders the result in an accessible section labelled through the translated `discoveryOutcome` key. The guard incorrectly required the literal English phrase `Discovery outcome` to appear in the component source. That phrase is not required because the UI uses the translation catalog. The guard now verifies the real integration contract: the shared model import, invocation, and translated accessible label. It does not remove or weaken the outcome-model requirement.

## Findings from the supplied log

- `npm ci --legacy-peer-deps` completes, but reports 29 advisories: 1 low, 13 moderate, 13 high, and 2 critical.
- The log reports `isomorphic-dompurify@3.20.0` as deprecated due to a Node engine/semver mismatch; npm's warning explicitly identifies 4.x for compatible newer Node runtimes, or 3.19.0 for Node versions below 22.22.2. The project's declared engine is Node `^24.15.0`, and the deployment log ran Node `v24.22.2`; confirm package compatibility and test before changing the major.
- `stellar-sdk`, `stellar-base`, and `js-xdr` are deprecated in favour of the `@stellar/*` package names. The lockfile shows `stellar-sdk` is brought in through `pi-backend`; migrate only after confirming the SDK import/API contract and `pi-backend` compatibility. Do not blindly replace transitive packages.
- ESLint 9.39.5 is reported unsupported by the upstream support policy. Upgrade ESLint and its Next.js integration as a coordinated set after checking the project's legacy `.eslintrc` and `ESLINT_USE_FLAT_CONFIG=false` setup.
- npm reports unknown environment config `cache-dir`. It is not present in the supplied repository `.npmrc`; inspect Vercel Project Settings → Environment Variables and remove/rename the obsolete `NPM_CONFIG_CACHE_DIR`/`npm_config_cache_dir` setting if configured. Do not add a speculative `.npmrc` workaround.
- npm reports install scripts for `sodium-native` and `unrs-resolver`. Review their provenance and necessity, then allow only required scripts through the package manager's explicit script-approval mechanism. Do not globally allow all install scripts.

## Validation limitations

The Discovery Intelligence guard now passes 9/9 and project-truth passes 10/10 in the inspection environment. The inspection container has Node `v22.16.0`, below the repository's declared Node `^24.15.0`; therefore it is not a valid environment for a full project build. A live `npm audit` request could not reach `registry.npmjs.org` from this environment. The 29 advisory records were not included in the supplied log, so exact vulnerable dependency paths and safe fixed versions cannot be asserted. No broad dependency upgrades or `npm audit fix --force` were applied without those records and a Node 24 build/test environment.

## Required next verification

1. Run `npm audit --json` using the project's Node 24 runtime and preserve the full report.
2. Apply non-breaking patched versions first; treat major upgrades (DOMPurify, Stellar SDK, ESLint/Next.js) as separate tested migrations.
3. Run `npm ci --legacy-peer-deps`, the complete `npm run prebuild`, `npm run typecheck`, `npm run lint`, and `npm run build` on Node 24.15+.
4. Confirm the two native install scripts are needed and explicitly approve only those required.
5. Redeploy to Vercel Preview before promoting to Production.

## GitHub Actions release-hygiene follow-up

The later GitHub Actions log failed because the repository tree did not contain `.env.example`, despite `.gitignore`, the canonical project documentation, and multiple existing release gates requiring that safe template. Restored the root template with empty credential placeholders and only conservative `0`/`1` feature defaults. Pi payout requests and execution, registration bonuses, referral settlement, curation redistribution, and other issuance switches remain disabled by default; `PI_NETWORK` is intentionally left blank and documented as a deployment setting for Testnet-only gated flows. No live credentials or wallet seeds were added.

Validation after restoring the template:

- `npm run check:release-hygiene`: 11/11.
- `npm run verify:static`: passed (exit 0).
- Phase 1 foundation: 10/10; Phase 2 operator hardening: 7/7; registration bonus: 18/18; wallet A2U: 16/16; economy Stage 1: passed; Phase 26 wallet resilience: 17/17.
- CI-equivalent checks for JSX safety, bounded JSON runtime, Phase 17–19 contracts, security headers, CSRF, production safety scan, payment recovery/timeline, project truth, Pi backend lock, clean migrations, migration release readiness, database recovery/catalog, and recovery-gate runtime tests passed.
- The broader `verify:production` pack is not clean in this Node 22.16.0 inspection container: it reports existing failures in post-curation dashboard, Stories rail v2, and feed/creator verification checks, and did not complete within the available execution window. These failures are separate from the missing environment template and require their own source-level investigation.
- Full prebuild/typecheck/lint/Next.js build and Vercel deployment remain unverified here because the available Node runtime is 22.16.0 while the project requires Node 24.15.0 or newer.

## Follow-up — offline messaging copy contract

- Corrected the conversation-thread offline notice: it now tells users to reconnect before sending new messages and confirms that an unsent draft remains in the composer, rather than making a blanket automatic-queue promise from that surface.
- Corrected the global offline banner so it no longer implies every action is queued. It now distinguishes actions that can be saved for retry from actions that require a live connection.
- Kept the existing durable offline queue and reconnect flush implementation intact; no send, persistence, retry, or delivery semantics were changed.
- Verification: `node scripts/check-pass17-relationship-intelligence.mjs` passes 8/8; `node scripts/check-pass47-experience-cohesion.mjs` and `node scripts/check-pass48-accessible-navigation.mjs` pass.

## Follow-up — GitHub Actions run 41813354746 (wallet, matching, stories, curation and feed contracts)

The supplied CI output exposed a mixture of stale source-contract assertions and a few product-surface gaps. The fixes preserve the existing product architecture and do not remove wallet, rewards, matching, creator analytics, or story behavior.

- Wallet Phase 2: clarified the GHC-rail handoff copy to identify the Pi destination as **PI earnings & cashback**. The PI earnings dashboard remains visible only when the Pi rail is selected; the GHC rail keeps its compact handoff. Phase 2 dual-asset wallet now passes 11/11 and the Phase 5 wallet release gate passes 17/17.
- Opportunities: the rewards tabs use the locale-aware `msg("opportunities")` catalogue entry. Updated the static contract to assert the real localized tab ID and message lookup rather than requiring an English literal in source. Opportunities/matching passes 9/9.
- Post curation: retained the accessible modal analytics experience, explicit dialog trigger, keyboard focus handling, bounded requests, server-authoritative reward/insights endpoints, event refresh, and truthful unavailable states. Updated the legacy checker to validate the current modal and the actual server/feed view fallback semantics, rather than an older inline expandable-dashboard design. Post curation passes 12/12.
- Stories rail: added the clear **Create** action, distinct gradient ring for unviewed stories, muted seen-story treatment, emerald own-story ring, and a compact **Be first** empty state. Story ownership, audience filtering, story opening, progress animation, and feed mounting remain intact. Stories rail v2 passes 9/9.
- Feed/creator: the location, intent and focus controls were already present and localized through translation keys, with preferences persisted locally. Updated the verifier to assert those actual controls and state handlers rather than hard-coded English labels. Feed/creator passes 10/10.
- Three additional production-pack failures were obsolete assertions: two still pinned release version 0.301.0, and the social-loop verifier expected retired English toolbar/curation labels. Updated them to validate package/app release synchronization and the current accessible/localized interface contract.

Validation on this inspection environment:

- `npm run verify:static`: passed (57/57 top-level static checks; subordinate checks included).
- `npm run verify:production`: **248 passed, 0 failed**. The report explicitly records Node `v22.16.0` as unsupported; the decision is `SOURCE_CHECKS_PASS — BUILD_AND_OPERATOR_VERIFICATION_STILL_REQUIRED`. This is not a production approval or a successful Node 24 build.
- Focused checks: wallet Phase 5 17/17; Phase 9 opportunities/matching 9/9; post-curation 12/12; Stories rail 9/9; feed/creator 10/10; wallet/rewards separation 13/13.

Remaining release gate: rerun full prebuild, typecheck, lint, Next.js build and operator verification on the required Node `^24.15.0` runtime, then deploy to a Vercel Preview and verify before production promotion. No GitHub push or deployment was performed.

## GitHub Actions run 7964246570090bjhkjbk / #194 — regional formatter TypeScript contract

- Corrected `RegionalContextValue` formatter signatures in `contexts/regional-context.tsx` to describe the provider-bound API. The provider supplies the locale internally, so consumers receive only the relevant options (`Intl.NumberFormatOptions`, `Intl.DateTimeFormatOptions`, `Intl.ListFormatOptions`) rather than the underlying helper's locale string parameter.
- Applied the same context-bound signature correction to currency and relative-time formatters to prevent the same parameter-position mismatch from reappearing at other call sites.
- No casts, `any`, compiler suppressions, or weakened TypeScript settings were introduced.
- Regional-context checks: 10/10; global-locale formatting checks: 11/11; Phase 12 locale integration checks: 14/14.
- Local full `tsc --noEmit` could not be treated as a valid project typecheck in this container: project dependencies (including React/Next and their type declarations) are not installed, and the available runtime is Node 22.16.0 rather than the CI-required Node 24.15.0. The compiler consequently reports missing dependency/type-environment errors across the repository. Re-run `npm ci` and `npm run typecheck` on Node 24.15.0 in CI before treating the full TypeScript gate as passed.

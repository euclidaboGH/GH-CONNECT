# Phase 24 release gate — GH-CONNECT 0.62.4

## Implemented

- Device-first CSS refinements across Feed, Marketplace, Wallet, Messages, Communities, Profile, Onboarding, Settings, shared navigation and dialog surfaces.
- Mobile safe-area and 16px input sizing, responsive tablet columns, bounded desktop navigation, long-content/media overflow handling, forced-colors focus and reduced-motion support.
- Browser screenshot/overflow E2E suite at 320/360/390/768/1024/1440 CSS px. Authenticated tab review is conditional on an existing QA session; no user identity or balance is faked.
- Added keyboard-reduced viewport, browser-offline, API failure, fresh-load recovery, and delayed-API shell captures. These are browser-emulation checks, not proof of native Pi Browser keyboard or provider recovery.
- Preview and production-smoke workflows upload screenshots, traces, and Playwright HTML reports for review. Preview authenticated screen capture can use `GHC_E2E_COOKIE_A` from a dedicated QA account; this cookie is ignored on production targets.
- Phase 24 source regression gate is part of `ci:verify`.

## Verified in this workspace

- 128/128 `scripts/test-*.mjs` suites passed.
- Phase 24 checks 20/20; Phase 23 checks 24/24; Phase 22 checks 38/38; Phase 21 checks 14/14.
- Release hygiene 11/11; JSX safety 687 files; migration inventory synchronized at 105 SQL files.

## Blockers / evidence not obtained

1. `package-lock.json` still lacks the resolved `node_modules/pi-backend` package graph. Registry access failed with `EAI_AGAIN`.
2. Available Node is 22.16.0; required minimum is Node 22.22.2 in the 22.x line or 24.15.0 in the 24.x line.
3. Actual React browser screenshot suite was not run: dependencies are absent and the preview could not be reached from this workspace. The added Playwright suite must run in configured preview CI and its artifacts be reviewed.
4. Typecheck, lint, clean install, production build, rendered-browser screenshots, real Pi Browser/Testnet payment, Supabase concurrency, and Paystack Test Mode remain unverified. No provider, Supabase, or visual-QA environment variables were configured in this workspace.
5. No Supabase migrations were applied, no GitHub push occurred, and no production deployment was performed.

## Additional release-command attempts in this workspace (2026-10-19)

- `npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit --no-fund`: timed out after npm registry retries reported `EAI_AGAIN` for `registry.npmjs.org/pi-backend`; the lockfile was not repaired.
- `npm ci --legacy-peer-deps --no-audit --no-fund`: timed out while registry access was unavailable; no clean install completed.
- `npm run typecheck`: failed because dependencies/types are absent (`react`, `next/server`, `@types/node`, and other package modules cannot resolve). This is not a clean typecheck result.
- `npm run lint`: could not start because `eslint` is not installed.
- `npm run build`: JSX safety precheck passed (687 files), but production build could not start because `next` is not installed.
- `npm run ci:verify`: stopped at the deliberate dependency-lock integrity gate because `node_modules/pi-backend` is missing from `package-lock.json`.
- `npm run test-*.mjs` regression loop: 128/128 passed. Phase 24 responsive source checks 24/24, Phase 23 screen checks 24/24, Pi durable-payment/A2U source checks 49 passed/0 failed, Paystack source checks 42/42, release hygiene 11/11, and migration inventory (105 files) passed.
- Playwright E2E/screenshots and live provider tests were not executed. No `GHC_E2E_*`, `PI_*`, `PAYSTACK_*`, or `SUPABASE_*` variables were configured in this workspace. A browser binary alone is insufficient: the application dependencies and configured Preview/Testnet app/database/provider credentials are required.

## Required supported-runtime release commands

```bash
node --version
npm install --package-lock-only --legacy-peer-deps
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run ci:verify
npm run build
GHC_E2E_BASE_URL=https://<preview-host> npx playwright test --project=chromium --project=mobile-chrome
```

Review the actual dependency-lock diff; use a non-production Preview/Testnet host for routine E2E. Do not enable Pi A2U or bank/GHC payouts without their separate provider, database and test evidence.

**Status: NOT CLEARED FOR PRODUCTION.**

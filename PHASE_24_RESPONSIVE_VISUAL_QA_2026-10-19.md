# Phase 24 — Responsive visual QA and device-first polish

**Release:** GH-CONNECT 0.62.4  
**Scope:** Feed, Marketplace, Wallet, Messages, Communities, Profile, Onboarding, Settings, shared navigation and common overflow/focus behavior.

## Source changes

- Added a device-first visual-QA layer on top of the Phase 21 design system without replacing existing component or financial logic.
- Prevented document-level horizontal overflow while preserving nested horizontal tabs/carousels and scrollable message logs.
- Added long-content/media overflow containment, mobile input font sizing to avoid browser zoom, dynamic viewport and safe-area treatment, and tablet-specific bounded columns.
- Centered/bounded desktop navigation while keeping the application workspace full-width.
- Added reduced-motion and forced-colors keyboard-focus refinements.
- Added `e2e/responsive-screen-review.spec.ts`. With the actual app running at `GHC_E2E_BASE_URL`, it captures browser screenshots at 320, 360, 390, 768, 1024 and 1440 px, asserts the document/body do not overflow horizontally, and exercises primary tabs plus Profile-launched Wallet/Settings when an authenticated QA session is already present. Preview CI runs desktop Chromium and mobile-Chrome emulation. An optional `GHC_E2E_COOKIE_A` GitHub secret seeds a real `gh_session` only for non-production targets; production runs intentionally ignore it. It never fabricates Pi identity or balances.
- Added responsive recovery-state coverage for focused onboarding fields with a keyboard-reduced viewport, offline browser context, API-route failures, fresh-load recovery, and delayed API responses. The keyboard case is an emulation; it does not replace a real Android keyboard/Pi Browser test.
- Preview and production-smoke CI jobs now upload Playwright screenshots, traces, and HTML reports as 14-day artifacts, including on failure.
- Added `scripts/test-phase24-responsive-visual.mjs` and included it in `ci:verify`.
- Regenerated `VERIFIED_MANIFEST.txt` after the release bump.

## What was actually verified in this workspace

- All 128 repository `scripts/test-*.mjs` regression suites passed.
- Phase 24 responsive visual-QA source checks: 23/23 after adding recovery-state assertions.
- Phase 23 Pi/screen source checks: 24/24. Pi durable-payment/A2U static checks: 49 passed, 0 failed, including incomplete-payment recovery and Testnet execution-lease invariants.
- Phase 22 Paystack source checks: 42/42 after adding explicit webhook idempotency, failed/reversed reservation, reconciliation-evidence, and deterministic-retry assertions.
- Phase 21 UI source checks: 14/14.
- Release hygiene: 11/11.
- JSX safety: 687 files scanned.
- Migration inventory is synchronized: 105 SQL files (77 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 25 REVIEW_REQUIRED).
- ZIP archive integrity must pass after packaging.

## Rendered-browser evidence status

**Not executed in this workspace.** The app cannot be started here because `node_modules` is absent, npm registry DNS resolution fails with `EAI_AGAIN`, and the available Node runtime is 22.16.0 while the project requires `^22.22.2 || ^24.15.0`. The deployed preview URL was also unreachable from this workspace. Therefore no screenshots from the actual React app are claimed in this report.

The browser suite is added to the existing CI E2E workflow, which runs against `GHC_E2E_BASE_URL` when configured. The authenticated screen sweep can use `GHC_E2E_COOKIE_A` from a dedicated QA account in that same non-production environment. Configure a non-production Preview/Testnet URL and a dedicated QA session cookie from that same environment for the Testnet branch, then review the uploaded Playwright screenshot/report artifact before accepting visual QA as passed. New degraded-network tests preserve the public shell and verify a fresh navigation after restoring network; they do not claim payment-route retry correctness. An authenticated visual-QA session is needed for the primary-tab sweep; no Pi login or financial values are mocked.

## Manual Pi Browser/device matrix still required

Use the registered Pi app and real Android Pi Browser. Capture portrait and landscape at 320/360/390/768/1024/1440 CSS px where applicable; inspect keyboard-open state, browser back, safe-area edges, slow/offline network, large text, long handles/IDs, failed media, empty/loading/error states, reduced motion, forced colors, and focus order. Verify marketplace checkout only completes after the authoritative server confirmation. Verify PI and GHC remain distinct assets and no UI asks for a Pi wallet passphrase/seed phrase.

## Release gate

The dependency lock is still incomplete for `pi-backend@0.1.3`. The genuine dependency graph must be generated in a registry-connected supported Node environment; do not hand-write integrity values or bypass the lock check. Then pass `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run ci:verify`, `npm run build`, and the configured preview browser E2E suite. This release is **not cleared for production** until these checks and Pi Testnet/provider/database evidence are recorded.

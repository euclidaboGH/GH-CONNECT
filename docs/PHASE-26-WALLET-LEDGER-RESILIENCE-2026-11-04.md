# Phase 26 — Wallet ledger resilience and premium wallet experience

## Problem

The wallet relied on multiple independently-triggered reads. Some requests could overlap, older requests could outlive newer refreshes, and a slow/unresponsive ledger request could leave a loading state visible too long. A cached/local GHC value could also be visually confused with a freshly server-confirmed balance.

## Resolution

- GHC wallet summary requests have a 10-second timeout.
- The wallet read provider cancels superseded requests and cleans up timers/controllers.
- The unified PI earnings dashboard has one refresh controller, a latest-request-wins sequence, a 10-second deadline and unmount cleanup.
- PI and GHC remain separate asset rails; they are never aggregated.
- The wallet hero displays one selected rail and its own available/pending/locked or withdrawable/reserved figures.
- GHC is described as server-confirmed only when the validated snapshot is both ready and server-sourced. Otherwise the UI says unavailable and explains that confirmation is required.
- The design uses GreenHaven's deep emerald/navy identity with restrained gold detail. It does not imitate another provider's logo or imply a bank account, card-issuing licence or unsupported service.

## Documentation authority

`docs/CURRENT_BUILD_CONTEXT.md` is the current concise brief for future implementation prompts. Versioned worklogs and older design references remain historical evidence only. Existing migration/audit fixtures are preserved because regression checks and operator evidence may depend on them.

## Verification

Run `node scripts/check-phase26-wallet-ledger-resilience.mjs`, `npm run verify:static`, `npm run check:doc-hygiene`, and the wallet Phase 1–5 regression gates. Supported Node 24.15.0 typecheck/lint/build and browser/device testing remain separate requirements.

No SQL migration or financial mutation authority was changed. Production remains **NOT APPROVED** until live database, provider, build and operational acceptance gates pass.

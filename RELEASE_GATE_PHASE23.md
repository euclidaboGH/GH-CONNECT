# Phase 23 release gate — GH-CONNECT 0.62.3

## Implemented in source

- Screen-specific responsive and accessibility refinements across Feed, Discover, Profile, Messages, Communities, Marketplace, Wallet, Settings, onboarding and shared navigation/dialog surfaces.
- Named landmarks for core screens and forced-colors focus/border support.
- Dynamic app version in Settings.
- Pi SDK initialization now fails closed; U2A no longer proceeds after a swallowed init error; metadata reserved keys and payment input bounds hardened.
- Official Pi Core Team documentation reviewed and mapped to implementation/operational evidence in `PI_CORE_TEAM_COMPLIANCE_REVIEW_2026-10-19.md`.

## Mandatory blockers

1. `package-lock.json` still does not contain the complete resolved package graph for `pi-backend@0.1.3`. The package is maintained in the Pi Core Team `pi-apps/pi-nodejs` repository, but its resolved transitive graph is missing from the lockfile. Keep A2U disabled until the genuine lock is refreshed and Testnet end-to-end verification passes.
2. Node runtime in the workspace is 22.16.0, below `package.json`'s minimum `^22.22.2 || ^24.15.0`.
3. Clean install, TypeScript, ESLint, Next production build and full `ci:verify` have not passed in this workspace because dependencies are unavailable and npm registry access timed out.
4. No live Pi Browser Testnet payment, Developer Portal configuration check, Supabase concurrency run, Paystack Test Mode transfer, or real device screenshot review has been completed.
5. Verify Pi app network, app URL, server API key and Supabase project independently for Preview/Testnet and Production/Mainnet. Do not infer that setting `NEXT_PUBLIC_PI_SANDBOX` changes the network registered for an app in Developer Portal.
6. Review rewarded ads and notifications against current official docs. Rewarded-ad value must only be granted after server-side Platform API verification with `mediator_ack_status === "granted"`; Core Team monetization approval is separate from code integration.

## Required commands on supported, registry-connected Node

```bash
node --version
npm install --package-lock-only --legacy-peer-deps
npm ci --legacy-peer-deps
npm run test:phase23-pi-screen-review
npm run typecheck
npm run lint
npm run ci:verify
npm run build
```

Review the genuine `package-lock.json` diff before committing it. Do not hand-write registry integrity hashes. Run the device matrix in `PHASE_23_SCREEN_BY_SCREEN_REVIEW_2026-10-19.md`, then the official Pi Testnet payment checklist. Keep payout/A2U flags off until provider, database, and Testnet evidence is recorded.

**Status: NOT CLEARED FOR PRODUCTION.** Phase 23 is a source and static-hardening pass; live and clean-build evidence remains required.

# GH-CONNECT v0.90.6 — Phase 2 + Four-Phase Hardening Review

## Scope
This release is based on the v0.90.4 Phase 4 archive. Phase 2 (daily claims, Rewards Centre, wallet reconciliation) is the primary implementation focus, with a cross-phase source review of wallet settlement, marketplace fee verification, and community creation/payment boundaries.

## Changes in this pass

- Daily claim client now treats only an explicit successful `ALREADY_CLAIMED_TODAY` server result as an idempotent replay. Unrelated HTTP 409 responses no longer become false successes.
- Daily claim POSTs and matured-reward claim POSTs explicitly bypass browser caching.
- Rewards Centre no longer generates a fresh timestamp-based request ID for every retry. The durable hold ID remains the stable identity passed to the server claim endpoint.
- Rewards Centre feedback no longer claims GHC is already available before wallet reconciliation; it confirms server redemption and announces refresh.
- Wallet pending-hold UI now handles grouped/stacked holds safely. Partial settlement no longer displays the full aggregate amount as available, and the UI keeps the remaining items retryable while requesting authoritative wallet refresh.
- Fixed the feed Marketplace interstitial TypeScript error: Marketplace is an overlay destination, not a primary `Tab`; the action now dispatches the canonical `ghc:navigate-tab` event handled by the app shell. A regression guard prevents reintroducing the invalid `setTab("marketplace")` call.
- Package version and lockfile root version are synchronized to 0.90.6.

## Four-phase review outcomes

### Phase 1 — Wallet and reward settlement
- Claim actions remain server-authoritative and fail closed when the API does not confirm settlement.
- Wallet refresh is requested after successful or partial settlement; client UI does not optimistically mint or credit GHC.
- Maturity remains server-enforced; the client refresh interval is a reconciliation mechanism, not a substitute for the ledger.

### Phase 2 — Daily claim and Rewards Centre
- Daily status remains server-derived and periodically refreshed while visible/online.
- Daily claims remain pending entitlements until the server-enforced 48-hour maturity/claim endpoint permits settlement.
- Error/replay classification is stricter and avoids treating arbitrary conflicts as success.

### Phase 3 — Marketplace
- Listing activation still requires the server fee policy and verified fee settlement for the selected currency.
- Pi listing fees continue to require a completed durable payment intent bound to the listing and seller.
- No client-provided fee amount is trusted as economic authority.

### Phase 4 — Community payments
- Community creation remains blocked when durable community persistence is unavailable.
- Server-derived fees and payment verification remain required when fees are enabled.
- Known transactional caveat remains: fee settlement and community creation are not yet one database transaction. Operators must test recovery for payment-success/create-failure before production enablement.

## Verification status
Static, repository-local checks should be run using the scripts listed below. The new Marketplace navigation regression is included in the Phase 2 reward/payment contract guard. Full TypeScript/build checks require the project's pinned Node.js 24.15.0 runtime and installed dependencies. Live Pi Browser checkout, GHC settlement, multi-session concurrency, and 48-hour maturity tests require the deployed testnet and must not be marked passed from static source checks alone.

Recommended checks under Node.js 24.15.0:

```bash
npm ci --legacy-peer-deps
npm run check:jsx
npm run test:safety
npm run check:dependency-lock-integrity
npm run check:pi-backend-lock
npm run check:project-truth
npm run check:release-hygiene
npm run check:database-contract-source
npm run check:migration-release-readiness
npm run typecheck
npm run build
```

## Release rule
This archive is a code hardening candidate, not a declaration of production certification. Do not enable real-value payments or advertise fully verified settlement until CI and end-to-end testnet evidence pass.

## Results from this archive's local checks

- Static verification suite: 8/8 passed, including the new Phase 2 reward/payment contract regression guard.
- JSX safety: 772 files scanned, passed.
- Production safety scan: 21 passed, 0 failed.
- Project truth: 10 checks passed, 0 failed.
- Release hygiene: 11/11 passed.
- Dependency lock integrity: passed.
- Pi backend lock: passed.
- Database contract source: 114 executable tables across 131 migration files; proposal-only tables remain non-executable.
- Migration inventory: 131 unique migrations, synchronized.
- TypeScript, lint, and Next.js production build: not run here because this environment is not using the required Node.js 24.15.0 runtime and dependencies are not installed.

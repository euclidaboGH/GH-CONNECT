# Phase 29 — Daily rewards and lightning claim reliability

Baseline: GH-CONNECT 0.91.0 notification-center upgrade. Release: 0.91.1.

## Audit findings

- The global lightning prompt was only rendered when the status endpoint had already returned a successful `claimable=true` response. A transient status failure left the Rewards Journey able to dispatch `ghc:open-daily-claim`, but the global modal could show a permanently disabled action because it interpreted unknown status as ineligible.
- The prompt was a floating button only; there was no automatic daily popup when the server transitioned the account to a new claimable day.
- The Rewards feed and global prompt used the same server endpoint but had different loading/error affordances. The feed had retry feedback; the global prompt did not expose a path to attempt a server-validated claim while status was unknown.

## Changes

- Automatically open the daily claim popup once when the server confirms a claimable reward day; session-scoped per-user/day suppression prevents repeated interruptions after dismissal.
- Keep the lightning action available when status is unknown, and allow a claim attempt to reach the authenticated server endpoint. The server still determines eligibility and amount; the client cannot mint GHC.
- Added explicit status-check copy and made retry errors accessible. Duplicate submissions remain blocked; the close control is disabled while a claim request is in flight.
- Kept server-authoritative status reconciliation, the atomic claim RPC, rate limiting, idempotency, the 48-hour pending lock, and wallet refresh events intact. No direct balance credit or economy bypass was added.
- Added a daily reward regression suite to the static verification pipeline.

## Research applied

- Pi Network's official support FAQ describes the daily lightning action as a manual 24-hour session restart and recommends reminders when a session needs restarting: https://minepi.com/support/ and https://minepi.com/faqs/how-does-the-pi-app-work-2/
- Rubi's public mining FAQ also describes user-activated 24-hour cycles: https://www.rubi.global/
- Product design takeaway: make the daily action conspicuous and timely, but keep activation explicit; show server-confirmed status, retryable failures, and clear pending/available states. These patterns are adapted to GreenHaven's GHC economy, not represented as identical mining mechanics.

## Validation

Run `node scripts/check-daily-reward-ux.mjs`, `node scripts/verify-phase14-static.mjs`, `node scripts/check-release-hygiene.mjs`, `node scripts/check-project-truth.mjs`, and `node scripts/scan-production-safety.mjs`. A Node 24.15+ runtime with installed dependencies is required for full TypeScript and Next.js production build validation. Testnet verification must confirm the `ghc_execute_daily_claim_v12` migration is applied and server environment is configured.

# Upgrade worklog — 0.271.5

## Product fixes

1. **Pi wallet authorization / WALLET_AUTHORIZATION_REQUIRED**
   - Withdrawable API now returns both `walletAuthorization.active` and `authorizationActive`.
   - Earnings UI reads either field so consent status is not stuck null/false incorrectly.
   - Authorize CTA shows whenever Pi is linked and authorization is not active.
   - Withdraw button routes to authorize when consent is missing (does not call payout until active).

2. **Post card actions (profile/feed)**
   - Engagement toolbar uses `flex-nowrap` + horizontal scroll so comment/share cannot wrap over downvote controls.

3. **Auto-refresh after login**
   - When `authLifecycle.serverVerified` becomes true, soft-refresh feed, messages, communities, marketplace, wallet, notifications, profile, and rewards once (`minIntervalMs: 0`).

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-01.

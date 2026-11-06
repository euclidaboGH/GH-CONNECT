# Upgrade worklog — 0.271.6

## Screenshot-driven fixes

1. **Pi withdraw / WALLET_AUTHORIZATION_REQUIRED**
   - Large violet **Authorize Pi wallet for payouts** panel when consent is not active (not only after error).
   - Withdraw routes to authorize until consent is active.
   - Error line always runs through `humanizeApiError` — no raw `WALLET_AUTHORIZATION_REQUIRED` string.
   - Withdrawable API dual-field `active` + `authorizationActive` retained.

2. **Profile/feed post actions**
   - Action toolbar is a 7-column CSS grid: quality · up · down · spacer · comment · save · share.
   - Comment icon cannot sit on the downvote control.

3. **Stories rail**
   - Removed duplicate centered + on “Add story”.
   - Single bottom-right + badge (Instagram-style). Avatar remains tappable to create; other rings open viewers.

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-01.

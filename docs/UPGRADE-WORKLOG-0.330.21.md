# Upgrade worklog — 0.330.21

Date: 2026-11-07

## Phase 2 Wallet completion increment

- Extended GHC transaction details and copy/download receipts with bounded, control-character-filtered allowlisted correlation references already present in row metadata: order, reward, request, payment intent, correlation and provider payment IDs. Existing transaction/reference IDs, timestamps, source and ledger-only disclaimer remain.
- Added a single shared search field to the full Wallet history experience. The query is applied to GHC transaction IDs, correlation references, descriptions, source events, kinds and statuses, and independently to Pi intent IDs, references, provider payment IDs, purpose, product and status. Selecting Pi in full history activates the existing authenticated, no-store, read-only Pi history loader. The UI continues to render and open each asset rail independently; no cross-asset totals or conversions are introduced.
- Reworked month-to-date GHC insight aggregation. Settled incoming/outgoing totals now include only posted ledger rows; pending movement is separately displayed; transfer-request memo rows and failed, reversed, cancelled, canceled and expired rows do not inflate settled movement. The scope remains loaded GHC records only.
- Preserved the existing canonical GHC Send, Request, Receive and withdrawal components and the dedicated Pi withdrawal consent/quote sheet. No new client-side payment execution path was added.
- Added a 12-contract completion checker to both `prebuild` and `verify:static`.

This is source-only verification, not production acceptance.

## Checks actually run

- New Phase 2 completion source contract: 12/12.
- Prior Phase 2 Wallet product transformation contract: 14/14.
- Wallet asset/history contract: 11/11.
- Wallet security hardening: 11/11.
- Withdrawal journey: 11/11.
- Wallet release gate: 19/19.
- Wallet ledger resilience: 17/17.
- Project truth: 10/10.
- Migration source manifest: 191/191.

The complete `npm run verify:static` completed successfully after reconciling stale release-version assertions in the Phase 1 Feed checks, restoring compatibility wording for the independent GHC/Pi rails, registering the new Phase 2 completion documentation with documentation hygiene, and updating the current Phase 1–12 release reports. The captured run contains 1,649 PASS assertions and 0 FAIL assertions.

## Runtime/device acceptance still open

The project pins Node.js 24.15.0, while this execution environment provides Node.js 22.16.0 and has no installed dependencies. TypeScript, ESLint and Next.js production build were not run. No physical low-end Android handset, Android WebView or Pi Browser is available here. Responsive classes and source contracts were inspected, but that is not device acceptance.

Required device matrix: (1) 360×640 Android viewport and 320 CSS-pixel narrow viewport; (2) Android WebView with limited memory and slow network; (3) Pi Browser login and payment history; (4) keyboard/screen-reader labels and focus; (5) large text/system font scaling; (6) offline-to-online refresh; (7) GHC Send/Receive/Request and Pi Withdraw test journeys on test accounts; (8) long transaction IDs/references wrapping without horizontal overflow; (9) modal safe-area, keyboard and back navigation; (10) large history scrolling and query responsiveness. Capture device/browser versions, screen recordings, console/network logs and pass/fail evidence.

No database migrations, ledger writes, payment execution, payout execution, live provider operations or production deployment were performed. Production remains NOT APPROVED.

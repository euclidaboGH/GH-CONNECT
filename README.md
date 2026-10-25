# GreenHaven — GH Connect

**Current source version:** `0.91.2`

GH Connect is the GreenHaven social, matching, community, messaging, marketplace, and GHC utility platform.

## Engineering and release safety

- Use Node.js `24.15.0` or the compatible Node 24 runtime specified by `.nvmrc` and `package.json`.
- Install locked dependencies with `npm ci`.
- Run `npm run verify:static`, `npm run typecheck`, `npm run lint`, and `npm run build` before release.
- Database migration inventory is source metadata only. It does not prove migrations are applied to Testnet or Mainnet. Reconcile remote migration history and validate review-required migrations on disposable PostgreSQL/Testnet before applying them.
- Financial balances, rewards, payments, and entitlements must remain server-authoritative. Do not add client-side financial authority, fabricated financial data, or authentication/RLS bypasses.

See `docs/PROJECT_TRUTH.md`, `docs/MIGRATION_CHECKLIST.md`, and `PHASE-26-SURGICAL-RELIABILITY-FIXES.md` for release constraints and current verification limits.


## v0.90.9 payment retry reliability
Community creation and marketplace listing payment failures preserve the in-progress draft and expose retry guidance. See `PHASE-27-PAYMENT-RETRY-AND-DRAFT-PRESERVATION.md`; payment retry contract passed 10/10 and full static verification passed 11/11. Live testnet payments still require operator validation.

## v0.91.0 notification center restoration

The global notification bell is mounted in the primary app shell again. The notification center now fetches the unified, social, economy, and announcement sources separately, refreshes on domain updates without overlapping polls, and uses a more precise Home activity indicator. Browser notification permission is not requested merely by opening the inbox. See `PHASE-28-NOTIFICATION-CENTER-RESTORATION.md`.


## v0.91.2 daily rewards reliability

- Daily GHC claim popup automatically appears once when the server confirms a new eligible reward day.
- A persistent floating lightning action remains available when eligibility status is temporarily unknown, and the dialog can attempt a server-authoritative claim instead of showing a dead disabled button.
- Retryable errors remain visible; duplicate submissions are guarded and the dialog cannot be dismissed during an in-flight claim.
- Daily claims still use the authenticated, rate-limited, idempotent server endpoint and remain pending under the 48-hour lock.
- Run `node scripts/check-daily-reward-ux.mjs` and the full static verification suite before release.


## v0.91.2 wallet and utility reliability

- Rewired the legacy wallet boost shortcut to the real Spend GHC panel rather than silently calling a missing domain method.
- Added recoverable utility catalog loading, refresh controls, a review-before-spend step, and target validation for target-bound utility purchases.
- Utility spend retries now reuse a stable request idempotency key until success; the server requires a key and no longer invents minute-bucket references.
- Unconfigured boosts/tools remain explicitly unavailable and fail closed: no GHC is charged without a durable activation path.
- Added wallet/utility regression checks covering button wiring, server pricing, idempotency, and fail-closed behavior.

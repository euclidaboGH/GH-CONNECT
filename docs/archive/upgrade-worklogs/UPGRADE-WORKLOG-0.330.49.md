# Upgrade worklog — 0.330.49 (2026-11-08)

## Phase 3 — Wallet, Rewards & Membership hardening

Starting source: `GREENHAVEN-0.330.48-PHASE-3-REWARDS-MEMBERSHIP-IMPLEMENTATION.zip`.

### Implemented

- Added explicit per-request Pi payout reservation explanations and unlock conditions.
- Restricted user-triggered release to Pi Testnet payout requests that are provably unstarted: reserved status, no provider payment ID, no txid, no execution start, no lease and zero execution attempts.
- Preserved processing/uncertain reservations until authoritative Pi provider reconciliation. A timeout alone cannot release or forfeit funds.
- Returned detailed status/reason/unlock-condition items from the authenticated recovery endpoint and rendered those explanations in Wallet.
- Prioritized human-readable ledger reason text over opaque unique references.
- Corrected withdrawal request success wording so it does not claim execution is disabled after the execution feature gate has passed.
- Serialized GHC membership entitlement preflight, debit and grant under one per-account advisory lock; added SQL-level active same-tier no-double-charge and active VVIP downgrade guards.
- Made reward-claim replay idempotent for both original pending-row IDs and rewardId metadata aliases.
- Hardened Pi payment recovery: provider lookup precedes provider-ID binding; exact payment identifier, direction, network, authenticated payer UID and amount are checked; completed status requires transaction verification and txid; cancelled/transaction conflicts are held for review.
- Added durable fail-closed per-account rate limiting and private no-store responses to Pi payment recovery.
- Added missing `APP_RELEASE_SUMMARY` export used by the app release-notice consumer and synchronized package, lockfile, in-app and manifest version to 0.330.49.
- Added a 43-check Phase 3 closeout source contract to `prebuild` and `verify:static`.

### Database migration

`20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` is classified **REVIEW_REQUIRED**. It is not applied. Reconcile each target project's migration history and validate on disposable PostgreSQL before operator-approved Testnet application. Do not run a blind `db push`.

### Verification

- Phase 3 closeout source contract: 43/43.
- Targeted suites: 31/31 suites passed, including unified earnings ledger, reward/membership guards, reward history and missions, membership lifecycle/renewal, Pi intent security, payout request lifecycle, verified settlement/recovery, payout worker, wallet withdrawal journey/security and cross-feature reconciliation.
- Migration source manifest: 197/197 synchronized.
- Repository consistency: 6/6; release hygiene: 11/11; project truth: 10/10.
- TypeScript route/server-file syntax checks passed under the available Node runtime.

### Not verified / operator gates remain

- Runtime here is Node 22.16.0, while the project requires Node 24.15.0; project dependencies are not installed. Full dependency-backed typecheck, ESLint, Next.js build and full `prebuild`/`verify:static` have not been run.
- No PostgreSQL server, Supabase credentials or Pi API credentials are available in this workspace. Real concurrent claim/purchase database tests, live authenticated Pi Testnet payment/entitlement recovery, the reported 3.00 π reservation investigation, ledger reconciliation against the user's actual database and provider settlement were not executed.
- Pi Testnet payout execution must remain disabled until migration reconciliation, provider configuration, worker verification and operator approval are complete.
- Browser, Pi Browser, Android/WebView, screen-reader and physical-device acceptance remain open.

**Phase 3 remains `Implemented, awaiting verification`. Production remains NOT APPROVED.**

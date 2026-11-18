# Phase 5 — Settings, Privacy & Account Controls

Date: 2026-11-14  
Baseline: `GREENHAVEN-PHASE4-PROFILE-IDENTITY-2026-11-14.zip` (project version 0.338.67)

## Scope

Phase 5 continues the Settings and account-control workstream: notification preferences, privacy controls, account-scoped state, session safety, appearance, accessibility, and device data/performance controls. The existing Settings architecture and authenticated server preference endpoint remain canonical; no parallel preference store or client-supplied account identity was introduced.

## Verified defect and surgical fix

In `components/ghc/settings.tsx`, the notification channel toggle could outlive the account identity that initiated it. The browser permission prompt resolves asynchronously, and the account can change while it is open. The previous callback could then update the currently displayed Settings state using preferences captured for the prior account. Asynchronous preference-save responses could also emit stale feedback after an account switch.

The update now:

- Captures the account owner at interaction time.
- Rejects interactions when the captured owner is no longer active.
- Rechecks ownership after the browser permission prompt resolves.
- Reloads the captured account's preference cache before applying the delayed push toggle.
- Rechecks ownership before local state mutation and before presenting async success/failure feedback.
- Continues to send account-level preferences to the existing authenticated endpoint; the server derives identity from the authenticated request.

This is a client-side account-isolation hardening. It does not claim to replace server authorization or make browser push delivery operational. Remote push remains explicitly unconfigured in the existing architecture.

## Checks executed

- New Settings account-switch regression contract: 9/9
- Existing Settings transformation contract: 16/16
- Settings performance/data contract: 14/14
- Notification preference integration contract: 17/17
- Notification preference runtime contract: 12/12

Total: **68/68 targeted assertions passed**.

The new check is registered in `verify:static` and `prebuild:checks`. Full prebuild execution was not performed; the repository requires Node 24.15.x while the available runtime is Node 22.16.0. No claim is made that TypeScript, ESLint, dependency installation, or production build passed.

## Safety and release boundaries

- No database mutation or migration was executed.
- No deployment, promotion, or Mainnet operation was performed.
- No financial or entitlement authority moved to the client.
- Pi-funded GHC acquisition, paid business checkout, issuance, settlement, withdrawals, and payouts remain gated.
- Existing server-side authentication and notification preference validation remain authoritative.

## Remaining acceptance work

1. Run the complete verification pipeline under Node 24.15.x, including install, typecheck, lint, and production build.
2. Exercise account switching during an actual browser notification permission prompt and while a preference PATCH is in flight.
3. Validate server preference durability and RLS/API authorization on Testnet with two distinct accounts.
4. Verify privacy, session revocation, data export/deletion, and device settings on Android/Pi Browser and desktop.
5. Continue migration-source reconciliation and the outstanding PostgreSQL rehearsal from the Phase 0 baseline.

## Status

**Phase 5 implementation increment delivered; release certification remains open.**

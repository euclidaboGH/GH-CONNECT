# GreenHaven 0.330.43 — Phase 11.2.2 Notification Delivery Architecture

Date: 2026-11-08

## Scope

Separate the three delivery concepts and make the current capabilities explicit. This phase does not integrate a remote push provider, add a subscription API, add a migration, or claim offline delivery.

## Forensic findings

1. **Durable in-app inbox:** the authenticated `/api/notifications` route calls the `gh_notification_inbox_list` RPC and returns a `durable` result flag. The bell also retains compatibility with separate social/economy/announcement sources and device-local notification storage. The unified inbox is therefore the server-backed canonical feed, while local storage remains a compatibility mirror and is not itself durable server storage.
2. **Browser alerts:** `lib/notifications.ts` may display a local browser notification when the account-scoped category preference is enabled and browser permission is `granted`. It uses the service worker registration when available and falls back to the browser Notification constructor. This is a local display attempt initiated by an active app session, not remote delivery.
3. **Remote Web Push:** `public/sw.js` contains a `push` event receiver and a notification click handler. The repository does not contain PushManager subscription registration, subscription persistence, a server-side provider sender, VAPID configuration, or a delivery worker. Consequently remote push is **NOT CONFIGURED**. A service-worker receiver alone is not proof of a working push service.
4. **Delivery status:** the new `lib/notification-delivery.ts` contract reports channel capabilities without conflating permission with delivery. Browser permission `granted` means a local alert may be attempted; it does not mean the user is subscribed or a remote push was delivered.

## Source changes

- Added an explicit delivery capability contract for `in_app`, `browser_alert`, and `remote_web_push`.
- In-app inbox capability is identified as server-backed API delivery; browser alerts are labelled local-only; remote Web Push is explicitly marked not configured.
- Renamed the legacy smart-notification queue to `browserAlertQueue` and its flush operation to `flushBrowserAlertQueue`; it is no longer described as a remote push queue.
- Removed the duplicate local browser-alert scheduling from `smartNotifications.create`; `notificationSystem` remains the single path for its mirrored in-app/browser-alert attempt.
- Clarified Settings copy: browser alerts require permission and an active app session; remote push to offline devices is not configured.
- Hardened the service-worker receiver's payload bounds and notification-click navigation to same-origin/same-protocol URLs only.
- Kept API authorization, inbox RPCs, recipient identity, preferences, and database schema unchanged.

## Delivery and retry semantics

- In-app persistence outcome is reported by authenticated inbox APIs and their `durable` flag.
- Browser alert outcome is a best-effort local display attempt. Browser permission and service-worker availability are capability inputs, not delivery receipts.
- Remote Web Push has no subscription lifecycle, sender, provider response, attempt journal, or delivery receipt in this release. There is therefore no remote retry state to expose.
- The existing in-memory browser-alert compatibility queue is not durable and is cleared on account changes. It must not be used as a remote retry mechanism.

## Verification

- `check-phase1122-delivery-architecture.mjs`: 13 source-contract checks.
- `test-phase1122-delivery-capabilities.mjs`: 14 runtime assertions across unsupported, granted and denied browser permission states.
- Service-worker policy/receiver/click-routing tests: 16/16. Existing notification action, priority, account-isolation and RPC privilege suites remain part of the project verification chain.

## Deferred before real remote push

- Choose and approve a provider and operational owner.
- Design authenticated subscription registration/deletion, endpoint uniqueness, encryption-key handling, device/account ownership, and logout/revocation semantics.
- Store subscription material server-side with strict RLS/service-role boundaries and retention policy.
- Add a durable outbox with idempotency, lease/claim, retry/backoff, provider response classification, dead-letter handling and observability.
- Send only minimal, privacy-safe payloads; fetch sensitive details after authenticated app navigation.
- Implement and test subscription rotation, permission revocation, endpoint expiry, account switching, multi-device delivery, provider outages and duplicate suppression.
- Reconcile Testnet/Mainnet migration history independently and obtain explicit migration approval before any schema change.

## Environment and release gate

No database migration was added or applied. Runtime environment is Node 22.16.0 while `.nvmrc` and package engine require Node 24.15.0; dependencies are absent. Dependency-backed typecheck, lint and Next production build are not certified. No real browser/device or provider delivery acceptance was performed. Production remains **NOT APPROVED**.

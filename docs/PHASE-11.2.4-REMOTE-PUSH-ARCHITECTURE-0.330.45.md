# GreenHaven 0.330.45 — Phase 11.2.4 Remote Push Architecture

Date: 2026-11-08  
Status: **Architecture/source increment completed; provider sender and live delivery are not enabled. Production is not approved.**

## Decision and scope

- Preserve three distinct channels: durable in-app inbox, local browser alerts, and remote Web Push.
- Select the standards-based Web Push protocol with VAPID as the provider-neutral protocol. No vendor-specific delivery vendor is selected.
- Do not claim remote delivery until a sender implementation, configured VAPID keypair, database proposal deployment, worker/cron operation and offline-device acceptance are complete.
- Keep VAPID private key server-only. `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT` are documented as empty deployment variables.

## Source implementation

- `lib/notification-push-contract.ts`: HTTPS endpoint validation, key length validation, endpoint SHA-256 hash, device ID and category preference validation.
- `lib/server/notifications/push-architecture.ts`: provider-neutral Web Push/VAPID capability configuration and service-role RPC transport.
- `app/api/notifications/push/config`: no-store capability endpoint. It reports `remoteDeliveryEnabled: false` and does not expose private key material.
- `app/api/notifications/push/subscriptions`: authenticated, rate-limited list/register/revoke API. Recipient ownership is derived from `resolveAuthenticatedUser`, never from a request-supplied user ID.
- `lib/notification-push-client.ts`: explicit-user-gesture client registration/revocation helper. It refuses registration unless the server explicitly reports remote delivery enabled; unsubscribe occurs only after durable server revocation succeeds.
- `public/sw.js`: existing push receiver remains separate from local alert generation. Same-origin click navigation guard is retained.

## Database design proposal (not applied)

`supabase/proposals/20261108_notification_remote_push_proposal.sql` defines:

- `gh_notification_push_subscriptions`: one active endpoint owner, device ID, encrypted subscription material, expiration and per-device category preferences.
- `gh_notification_push_outbox`: idempotency key `(notification_id, subscription_id)`, bounded attempts, leases and next-attempt scheduling.
- `gh_notification_push_attempts`: sanitized outcome/HTTP-status audit trail.
- Authenticated-user-scoped service-role RPCs to register, list, revoke, claim and complete.
- An inbox insert trigger to enqueue only categories explicitly enabled for each active device.
- `FOR UPDATE SKIP LOCKED` claiming, bounded exponential retries (30 seconds through a six-hour ceiling, respecting provider Retry-After), abandoned-lease failure closure and 404/410 endpoint revocation.
- RLS deny-all for browser roles and explicit service-role-only execution grants.

This is a **proposal**, not a migration in `supabase/migrations`; it is not included in the migration source manifest and has not been applied. Reconcile Testnet and Mainnet migration history independently, then run the SQL against disposable PostgreSQL and review before requesting approval.

## Provider and worker boundary

The sender is intentionally not implemented in this increment. No unverified custom Web Push encryption, hand-written VAPID signing, direct arbitrary endpoint fetcher, or fake provider receipt was introduced. The outbox claim/complete contract is designed for a separately tested sender adapter. Until that adapter is installed, the config endpoint and client helper keep remote registration/delivery disabled.

## Security and operational controls

- Authenticated user ID is server-derived.
- Subscription endpoint must be HTTPS and use a known browser push-service host (FCM, Mozilla, Windows or Apple); localhost, arbitrary hosts, credentials, fragments, non-443 ports and oversized endpoints are rejected. This constrains future outbound requests and reduces SSRF exposure.
- Subscription key material is bounded and stored only in the service-role-protected proposal tables.
- Endpoint ownership is unique and a re-authenticated browser can transfer the endpoint to its current account, rather than sharing one endpoint across accounts.
- Registration, list and revocation routes are rate-limited and return no-store responses.
- Revocation is server-first; local `unsubscribe()` is not called when server revocation fails.
- No notification inbox, financial ledger, Pi payment or GHC balance semantics are changed.

## Verification

- `scripts/check-phase1124-remote-push-architecture.mjs`
- `scripts/test-phase1124-push-contract.mjs`
- Existing Phase 11 notification action, account-isolation, delivery, preferences, service-worker and RPC privilege suites remain in `verify:static`.

## Explicitly unverified / next acceptance gates

- SQL proposal has not been run on PostgreSQL or applied to Testnet/Mainnet.
- No VAPID keys are configured and no sender/provider package is integrated.
- No outbox worker/cron dispatch is enabled; therefore no provider delivery receipts or actual retry cycles exist yet.
- No real offline Android/iOS/desktop/browser push acceptance, permission revocation test, multi-account physical-device test, or provider 404/410 test.
- Runtime remains Node 22.16.0 in this environment while project requires Node 24.15.0; dependencies are absent. Full dependency-backed typecheck, lint and Next production build are not certified.

**Release truth:** durable in-app inbox = existing server-backed path; browser alerts = local active-session display; remote Web Push = protocol/schema/API architecture prepared but disabled and not operational.

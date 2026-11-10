# GreenHaven 0.330.44 — Phase 11.2.3 Notification Preferences and Account/Device Boundaries

Date: 2026-11-08

## Scope

Separate account-level in-app inbox preferences from browser-local alert preferences, establish explicit account/device boundaries, support account preference synchronization across devices, refresh browser permission state after permission changes, and prevent preference leakage when accounts switch on a shared browser. Remote Web Push subscription/provider integration remains out of scope.

## Architecture

- **Account-level channel:** `inApp` category preferences are stored in the authenticated user's `gh_user_profiles.profile_payload.notificationPreferences` namespace through `/api/notifications/preferences`. The API derives the owner exclusively from `resolveAuthenticatedUser`; it does not accept a client-supplied user ID. The client keeps an account-scoped local cache for immediate use and offline presentation.
- **Device-level channel:** browser alert category preferences (`push` retained as a compatibility field in the existing client contract) are stored under a distinct account + browser-device key in localStorage. The device identifier is generated once per browser storage profile. Another browser/device receives independent defaults and can choose different alert categories.
- **Permission:** browser Notification permission is an independent platform gate. Settings refreshes its displayed state on focus and visibility changes. A denied permission is not silently re-requested; the user must change the site permission in browser settings. The user preference and browser permission must both allow a local alert.
- **Compatibility:** prior account-scoped notification preference records are read as a migration source; values are split into account in-app and current-device browser-alert caches when saved. The legacy unscoped Studio key is never assigned to an authenticated account.
- **Delivery truth:** browser alerts remain local-only. No remote push provider, subscription lifecycle, offline delivery or delivery receipt is introduced.

## Persistence caveat

The account-level preference namespace reuses the existing server profile payload and existing profile-store service-role persistence path. It is authenticated and cross-device when the durable profile store is configured. The existing profile store uses read/merge/upsert semantics rather than a dedicated atomic preference RPC; concurrent profile payload writes can be last-write-wins. A dedicated notification-preferences table/RPC may be warranted after live schema and migration-history reconciliation. No migration was added or applied in this phase.

## Source changes

- Added authenticated GET/PATCH `/api/notifications/preferences` with category allowlisting, in-app-only account payload validation, bounded JSON, and per-account rate limits.
- Split account and device preference caches in `lib/domains/notification-domain.ts`; added server hydration/merge and account-only serialization helpers.
- Updated notification delivery preference reads to consume the account in-app cache and current-device browser-alert cache separately, retaining legacy reads for migration compatibility.
- Updated Settings to show independent **In-app** and **This device** controls for each category group, synchronize account preferences with the authenticated API, and report when account sync is unavailable.
- Browser permission state is refreshed on window focus and document visibility return. Browser permission denial is not represented as a user preference change.
- No remote push sender, PushManager subscription registration, VAPID secrets, provider dependency, new migration, or financial authority was introduced.

## Verification

- Phase 11.2.3 preference source contracts: 17/17.
- Phase 11.2.3 preference runtime checks: 12/12.
- Phase 11.2.1 action source/runtime: 10/10 and 8/8.
- Phase 11 account-isolation runtime: 16/16.
- Phase 11 priority runtime: 14/14.
- Phase 11 transformation contracts: 19/19.
- Phase 11.2.2 delivery architecture/capability: 15/15 and 14/14.
- Service-worker policy: 16/16.
- Notification center contracts: 10/10.
- Notification ordering: 15/15.
- Notification RPC privileges: 18/18.

## Acceptance limitations

Node 22.16.0 is available; the repository requires Node 24.15.0. `node_modules` is absent. Full dependency-backed typecheck, lint and Next.js production build are not certified. Real multi-device synchronization against Testnet/Mainnet Supabase, shared-browser account-switch acceptance, Android/Pi Browser/mobile acceptance, browser permission revocation in supported browsers, and screen-reader testing remain outstanding. Production remains NOT APPROVED.

## Next

Phase 11.2.4 should design remote push subscription ownership, per-device endpoint registration/revocation, VAPID/provider selection, durable outbox/idempotency, retry/backoff, provider receipts, expired endpoint cleanup and delivery observability. It must begin with provider-neutral threat modeling and live schema reconciliation; do not claim remote push until real end-to-end tests succeed.

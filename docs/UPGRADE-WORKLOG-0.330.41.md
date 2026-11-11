# Upgrade worklog — 0.330.41 — Priority 11 Notifications

## Baseline

- Source archive: `GREENHAVEN-0.330.40-PRIORITY-10.2-FILTER-STATE-SERVER-PARITY.zip`
- New release: `0.330.41`
- Scope: Priority 11 notification prioritization, actions, preferences and accessibility.

## Delivered

- Explainable critical/high/normal/low priority classifier and priority sorting.
- Account-scoped browser notification cache and device-local dismissed markers; legacy unscoped cache is only imported for the local Studio placeholder identity.
- Account-scoped category preferences, connected to Settings and domain in-app/push delivery.
- Security/system notices remain in-app by default; optional profile views and product updates default off.
- Legacy smart notification queue now checks account-scoped category push preferences and browser API availability.
- Mark-read errors reconcile optimistic state; bulk-read success is not announced until all durable source writes succeed.
- Device-local hide semantics are explicit; no false claim that a server record was deleted.
- Notification dialog initial focus, Tab/Shift+Tab trap, Escape close and focus restoration.
- No database migration; no wallet/GHC/Pi/payment/settlement authority changes.

## Verification

- Phase 11 priority runtime tests: 14/14.
- Phase 11 account-isolation and independent in-app/push preference runtime tests: 16/16.
- Phase 11 integration contracts: 19/19.
- Existing notification center: 10/10.
- Notification ordering: 15/15.
- Notification RPC privileges: 18/18.
- Notification UX: 9/9.
- Attention intelligence: 8/8.

## Limitations

This is source-only verification, not runtime or production acceptance.

Node 22.16.0 is installed but `.nvmrc` requires Node 24.15.0. `node_modules` is absent. Dependency-backed typecheck, lint and production build are not certified. Browser/device, live push delivery, screen-reader, shared-device two-account and live Supabase acceptance remain outstanding. Durable inbox feeds still merge unified, social, economy and announcements client-side; consolidation requires separate backfill/retention/dedupe/privacy analysis. Production remains NOT APPROVED.

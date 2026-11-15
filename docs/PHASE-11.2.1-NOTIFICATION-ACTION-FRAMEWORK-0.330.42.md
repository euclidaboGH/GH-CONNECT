# Phase 11.2.1 — Notification Action Framework (0.330.42)

Date: 2026-11-08

## Objective

Standardise the notification detail actions while retaining the current recipient-scoped server APIs and avoiding a premature durable-inbox or database redesign.

## Implemented

- Added `lib/notification-actions.ts` as the shared, typed presentation contract for `open`, `mark_read`, `retry` and `dismiss`.
- Contextual Open labels are derived from known destination metadata (transaction, transfer request, friend/group request, message, marketplace item, wallet, rewards, community, post and account notice). The label selection does not execute arbitrary notification-provided commands.
- Mark Read is offered only for unread notifications.
- Retry is exposed only for a notification whose previous mark-read attempt failed; retry repeats the existing recipient-authorized mark-read path.
- Dismiss is explicitly device-local: it writes the account-scoped deleted marker and hides the row without changing the server-side read state. It does not claim to delete the durable server record.
- Notification detail now renders actions from the shared contract and gives controls accessible descriptions.
- Added runtime and source-contract tests and registered them in `prebuild` and `verify:static`.
- Updated release metadata and current project-truth documents to `0.330.42`.

## Security and data boundaries

- No new API route, RPC, migration, push provider or durable deletion path was introduced.
- Existing authenticated recipient resolution and service-role-only notification RPC grants remain unchanged.
- Contextual actions are navigation-only; no notification metadata is treated as authorization or proof of a financial outcome.
- Retry is limited to the existing mark-read operation. It cannot retry payments, GHC transfers, claims, membership changes, orders or other financial operations.
- No notification-feed consolidation or retention deletion was attempted in this increment.

## Verification

- Phase 11.2.1 action runtime contract: 8/8.
- Phase 11.2.1 source contracts: 10/10.
- Phase 11 notification transformation contracts: 19/19.
- Phase 11 priority runtime tests: 14/14.
- Phase 11 account isolation runtime tests: 16/16.
- Existing notification center contracts: 10/10.
- Notification ordering contracts: 15/15.
- Notification RPC privilege contracts: 18/18.

## Outstanding acceptance

Node 22.16.0 is present while the repository requires Node 24.15.0; dependencies are not installed. Therefore dependency-backed typecheck, lint and production build are not certified. Actual browser/mobile, keyboard/screen-reader, real shared-device two-account, remote push provider, live Supabase/Testnet/Mainnet and operator acceptance remain outstanding. No migration was added or applied. Production remains NOT APPROVED.

## Next increment

Phase 11.2.2 should audit delivery channels and provider boundaries, then Phase 11.2.3 should reconcile category/account/device preference semantics. Do not consolidate durable feeds or add retention deletion before duplicate identity, financial/security retention and target-specific database history are understood.

# Phase 8 — Realtime transport trust-boundary hardening

**Project:** GH-CONNECT 0.61.1  
**Date:** 2026-10-18  
**Status:** Source candidate; no deployment or live integration verification.

## Scope

This pass tightens the existing realtime bridge without changing the domain-event API or requiring a new backend service.

## Changes

1. Added a runtime `DomainEventType` allowlist in `lib/realtime/event-bus.ts`, so a remote WebSocket message cannot introduce an arbitrary event name into the event bus.
2. Hardened remote event envelope validation: rejects arrays/non-object envelopes, unknown event types, empty or oversized actor IDs, non-finite/non-positive timestamps, oversized request IDs, invalid origin values, array payloads and messages larger than the existing 48,000-character cap.
3. Rejects remote assertions of server-authoritative financial outcomes, including wallet balance/transfer events, reward issuance/redemption, membership activation, referral verification and payment completion/failure. Clients must reconcile those outcomes through authenticated APIs and authoritative ledger/entitlement state; a realtime message is never proof of payment or GHC credit.
4. Suppresses duplicate WebSocket connection attempts while the socket is connecting/open or a reconnect timer is already pending.
5. Added `scripts/test-realtime-transport-hardening.mjs` and registered it in `package.json`'s `ci:verify`. GitHub Actions already executes every `scripts/test-*.mjs` script.
6. Corrected the marketplace finite-stock release guard. An environment flag can never authorize unsafe stock handling; Phase 9 now adds a real database-backed atomic reservation RPC and wires order creation to it. The migration must be applied and validated on Testnet before finite-stock checkout is considered release-ready; missing RPC/schema fails closed.

## Source-level verification

- Realtime transport hardening checks: 15/15 passed.
- Deployment network safety: 10/10 passed.
- Ten-phase baseline: 8/8 passed.
- Messaging reliability: 32/32 passed.
- Release hygiene: 10/10 passed.
- All 85 `scripts/test-*.mjs` regression scripts passed in the Phase 8 local static test loop. Phase 9 adds a separate atomic inventory reservation suite; the current combined candidate has 86 scripts and all passed in the latest local static loop.

The production safety scan passed 21/21 checks, deployment network safety passed 10/10, JSX safety scanned 641 files, and migration release-readiness static checks completed with 10 future-dated migration files flagged for operator review. These tests are source/static checks; they do not instantiate a live WebSocket server or prove end-to-end authentication at the transport provider.

## Outstanding release gates

- Clean dependency install, full TypeScript typecheck, ESLint and Next.js production build.
- Integration test with the actual authorized realtime service, including malformed frames, unknown event names, duplicate connection attempts, reconnect behavior and server-authoritative API reconciliation.
- Live Testnet reconciliation for Supabase migration history/schema, Pi payment approval/completion/replay and membership entitlement fulfillment.
- Marketplace finite-stock purchase tests under concurrency; the source RPC is now wired, but release remains blocked until the migration is reconciled and validated on disposable Testnet.
- Economy work remains pending: referral issuance, balance-funded curation redistribution, marketplace/community fees, and Testnet validation of all eight Pi and GHC subscription products.

## Change boundaries

Phase 9 adds `202610180011_atomic_marketplace_inventory_reservation.sql` as a source candidate; it has not been applied. No remote database was queried or mutated. No GitHub push, Vercel deployment, Pi payment, or Mainnet operation was performed.

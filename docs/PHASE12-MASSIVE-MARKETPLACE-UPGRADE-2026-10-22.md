# GreenHaven Phase 12 — Massive Marketplace Upgrade

**Date:** 2026-10-22
**Scope:** Durable marketplace saves, server-authoritative save state, saved-listings library, concurrency hardening, migration inventory refresh.

## What was upgraded

### Marketplace product experience
- Replaced the previous non-functional **Save** placeholder with a real durable account feature.
- Listing detail now loads saved state from the server and can save/unsave without trusting client identity.
- Added a dedicated **Saved** marketplace surface alongside Browse, Sell and Orders.
- Saved listings are rehydrated from the authoritative marketplace catalog and can be opened directly.
- Save mutations broadcast a local UI event so the Saved surface refreshes immediately without a full app reload.

### Backend and security
- Added `gh_marketplace_saved_listings` with a composite primary key to make duplicate saves impossible.
- Direct client table access remains denied by RLS.
- Added service-role-only RPCs for toggle, list and per-listing status.
- Save writes are session-bound and rate-limited at the API boundary.
- Concurrent toggles for the same user/listing pair are serialized with a transaction advisory lock, preventing race-dependent double-save behavior.
- Saving requires the listing to exist and currently be active.

### Release/source integrity
- Canonical migration source is now **116** clean migrations.
- Executable GreenHaven table contract is now **100** tables in a fresh canonical install.
- Canonical installer regenerated from all 116 migrations.
- Migration inventory and Testnet verification metadata refreshed to the new source count/classifications.

## Verification

Passed:
- Clean migration checker: 116 unique 14-digit migrations.
- Database source contract: 100 executable GreenHaven tables across 116 migrations.
- Database tools: canonical installer covers all 116 migrations.
- Phase 12 marketplace saves: 17/17.
- JSX safety: 732 files scanned.
- Project integrity: 36/36.
- Latest CI regressions: 25/25.
- Phase 7 product experience: 27/27.
- Marketplace inventory reservation: 36/36.
- Marketplace stale-claim recovery: all checks passed.
- Project truth: 14/14.

## Runtime boundary

This phase was source/build engineering only. The available environment does not have the project's Node 24.15.0 runtime with installed dependencies, so this report does **not** claim a successful TypeScript check, ESLint run, Next.js production build, browser E2E, or live Supabase execution.

The existing Testnet database previously verified in this conversation contains 99 GreenHaven application tables. This new saved-listings migration has **not** been applied to that live database by this phase. Do not run the complete canonical installer against an existing environment; reconcile migration history first and apply the new migration individually on the approved target.

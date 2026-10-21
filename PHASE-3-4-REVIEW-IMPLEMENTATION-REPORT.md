# Phase 3–4 Re-review Implementation Report — 2026-10-21

**Baseline:** GH-CONNECT 0.63.25, from `GH-CONNECT-0.63.25-PHASE5-6-MASSIVE-REWORK-1.zip`  
**Scope:** Phase 3 company revenue foundation and Phase 4 GHC utility economy transparency/safety.  
**Mode:** source-level implementation and verification only.

## Implemented

### Phase 3 — Company revenue journal hardening
- Added database-level append-only enforcement for company revenue journal rows: UPDATE and DELETE now raise an exception. Corrections must be represented as compensating events.
- Added database constraints requiring metadata to be a JSON object and limiting its serialized size to 4 KiB.
- Hardened the server adapter against malformed runtime callers by checking the event type and provider at runtime instead of relying on TypeScript declarations.
- Added a single bounded retry for the database's explicit unique-key concurrency-race response. If the canonical row still cannot be reconciled, the adapter returns a failure rather than claiming success.
- Updated the phase report and source regression assertions.

### Phase 4 — GHC utility policy
- Re-reviewed the public read-only policy route, canonical economic configuration, fixed server-side spend catalog, wallet disclosures, and fail-closed purchase/withdrawal gates.
- Added a user-triggered retry for the read-only policy fetch so a temporary network/server failure can be recovered without leaving the wallet transparency panel stuck until a full reload.
- Preserved the existing economic version and price/issuance values; no client-authoritative pricing, minting, Pi-to-GHC acquisition, or withdrawal settlement was enabled.
- Corrected stale phase-report version wording to match the 0.63.25 baseline.

### Repository consistency
- Regenerated `VERIFIED_MANIFEST.txt` from the canonical migrations directory. It now reflects 109 SQL files and classifications of 77 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, and 29 REVIEW_REQUIRED.
- Confirmed the generated checklist and manifest are synchronized.

## Verification completed
- Phase 3 company revenue source invariants: PASS.
- Phase 4 GHC utility policy assertions: 27 PASS.
- Phase 5–6 massive hardening regressions: 71 PASS.
- Project integrity audit: 36 PASS, 0 errors, 0 warnings.
- Migration release-readiness static check: PASS with 15 future-dated/review-required migrations explicitly flagged.
- Release hygiene: 11/11 PASS.
- Phase 5 business monetization assertions: 19 PASS.
- Phase 6 Pi-funded GHC acquisition assertions: 20 PASS.

## Not verified / release gates remain
- No SQL was applied to Supabase and no live database was changed.
- PostgreSQL syntax/trigger/ACL behavior, concurrency, RLS, and RPC execution still need disposable PostgreSQL validation before applying the migration.
- Clean dependency install, TypeScript, lint, production build, browser E2E, and live Testnet/Pi Browser flows were not run in this environment.
- Company revenue recording remains unconnected to settlement flows by design. Do not call the adapter from user-controlled routes; only integrate after provider verification and an atomic/outbox handoff are implemented.
- Do not enable Pi-funded GHC acquisition or withdrawals based on this source-level work.

## Decision
**Phase 3–4 source hardening: implemented and static checks pass. Global launch / Mainnet approval: not granted.** The next correct engineering gate is disposable PostgreSQL validation of the journal migration and its concurrency/ACL behavior, followed by clean CI under Node 24.15.0 and two-account Testnet acceptance.

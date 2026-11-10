# GREENHAVEN Phase I — Trust and Platform Foundations

**Implementation baseline:** `0.338.6` (archive name supplied as `0.338.8`; internal package/build metadata remains `0.338.6`)
**Implementation date:** 2026-11-09
**Status:** **Source hardening delivered; Phase I remains IN PROGRESS.** This is not a production approval.

## Scope and safety decision

Phase I contains ten work packages. The source already includes substantial prior implementations in wallet/earnings, Pi payout state machines, PIN proof, wallet authorization, rate limits, governance and migration gates. This pass extends those existing authorities instead of replacing them.

No new migration was created or applied. No database rows, user balances, payout requests, reservations, payment states, provider settings, secrets, or deployment settings were changed. No Pi payment or payout was executed. Pi Mainnet remains out of scope; the new payout request guard continues to accept only the explicit `Pi Testnet` network label.

## Delivered source changes

### 1. Canonical domain ownership — extended

Updated `lib/architecture/domain-ownership.ts` to explicitly include rewards, communities, notifications, trust/safety and payment domains in addition to the existing identity, wallet, marketplace, membership, messaging, feed and media domains. The financial-domain list now includes rewards and payments, not only the wallet and commerce domains.

This remains an ownership map, not a proof that every legacy writer has been eliminated. Duplicate-writer detection and enforced import/dependency boundaries remain open.

### 2. Durable workflows and outbox — audited, not yet delivered

Existing source provides DB-backed idempotent operations, durable activity grants, payout request state, execution leases, receipt fencing and recovery. `lib/server/economy/durable-emission.ts` is not a general transactional outbox: it does not atomically commit arbitrary business mutations with an event record, and it does not provide a unified retry/dead-letter/replay control plane.

A general outbox requires a schema, transaction ownership and deployed worker/lease behavior. It is intentionally not simulated in application memory or introduced as an unreviewed migration. Design and disposable-PostgreSQL rehearsal remain required.

### 3. Dual-asset ledger integrity — source hardened

Added pure PI atomic-unit arithmetic in `lib/wallet/pi-atomic.ts`:
- safe-integer validation for atomic units;
- rejection of malformed/non-integer atomic strings;
- safe overflow handling during decimal-to-atomic conversion;
- floor-only conversion for balance-derived atomic amounts;
- `BigInt` fee preview arithmetic to avoid intermediate multiplication precision loss;
- bounded fee basis points and safe gross/net conservation in the preview.

Updated `lib/server/earnings/unified-ledger.ts` to re-export the shared helpers and reject invalid user identity, idempotency reference, payout request identity and atomic amounts before credit/reserve/settle/release RPC calls. Payout request creation now validates positive safe gross/net amounts, non-negative safe fee, `gross = fee + net`, non-empty request identity/fingerprint, and the explicit `Pi Testnet` network.

These checks are additional application-boundary guards. Database RPC constraints and transaction serialization remain the final authority. The existing cross-feature reconciliation endpoint remains read-only and does not repair balances.

### 4. Pi payment/payout assurance — existing state machine preserved

Existing source checks confirm request idempotency, server-derived recipient binding, Testnet enablement, durable execution lease, provider payment binding, read-after-write receipt verification, exact receipt matching, atomic settlement, and retention of reservations for uncertain outcomes. This pass adds stricter request-boundary amount validation. No live Pi Testnet transaction was run, so end-to-end acceptance remains open.

### 5. Identity/session/PIN — existing controls preserved

Existing short-lived withdrawal PIN proof is HMAC-bound to the user and idempotency key and verified using constant-time comparison. Existing PIN setup/recovery and wallet authorization paths were retained. Full account recovery, device/session revocation and multi-device acceptance remain open.

### 6. Authorization/data access — existing controls verified statically

Existing centralized ownership helpers, wallet authorization checks, authenticated routes, service-role RPC boundaries, RLS-deny client paths and bounded request handling remain in place. Static source checks do not replace deployed role/catalog inspection or authenticated IDOR testing.

### 7. Rewards/referral abuse — existing controls retained

Existing durable reward grants, request guards, idempotent ledger credits and abuse rate limits remain in place. This pass did not change reward economics, referral rewards, eligibility or user entitlements. Cross-campaign farming and adversarial multi-account testing remain open.

### 8. Trust/safety moderation — existing controls retained

Existing community governance, moderation input validation, durable abuse limits and report intake were inventoried. A unified moderation queue, evidence retention and end-to-end operator workflow are not claimed as complete.

### 9. Migration governance — source manifest verified

The current migration directory and `MIGRATION-SOURCE-MANIFEST.csv` both contain 198 SQL files, and the existing migration source-manifest gate passed. The target Supabase migration history was not queried. A source file marked required or statically verified is not evidence it has been applied to Testnet or Mainnet.

### 10. Backup/disaster recovery — verifier exists; restore proof outstanding

The repository includes `scripts/verify-database-backup-artifact.mjs`. This pass did not access a production backup, perform a restore, verify point-in-time recovery, or run a disaster-recovery exercise. Backup/restore readiness is therefore not accepted.

## New automated verification

- `scripts/check-phase1-strategic-foundations.mjs` — 15 source/inventory contract checks.
- `scripts/test-phase1-ledger-atomic-guards.mjs` — 22 atomic-unit and fee arithmetic assertions.
- Added `npm run check:phase1-strategic-foundations`.
- Registered the new checks at the end of `prebuild` and `verify:static` (where present).
- Updated `scripts/check-phase3-unified-earnings-ledger.mjs` to follow the pure-helper extraction while preserving the original atomic-scale invariant.

## Verification evidence from this pass

| Check | Result |
|---|---:|
| Phase I strategic foundation gate | 15/15 PASS |
| Phase I PI atomic guard tests | 22 assertions PASS |
| Unified earnings ledger regression gate | 20/20 PASS |
| Community governance closeout gate | 10/10 PASS |
| PI atomic guards | 22 assertions PASS |
| Prior Phase 1 architecture foundation | 12/12 PASS |
| PI payout request lifecycle | 21/21 PASS |
| PI payout settlement/recovery | 15/15 PASS |
| PI earnings execution worker | 21/21 PASS |
| Wallet authorization | 27/27 PASS |
| Security retention | PASS |
| Durable abuse controls | PASS |
| Wallet ledger resilience | 17/17 PASS |
| Migration source manifest | 198/198 PASS |
| Migration release-readiness source audit | PASS (static only) |
| SECURITY DEFINER source audit | 418 declarations passed static checks |
| Financial reconciliation source gate | 12/12 PASS |
| Pi Testnet release gate | 19/19 + 5/5 child suites PASS (static only) |

One existing Phase 3 ledger static gate initially assumed the atomic constant lived directly in `unified-ledger.ts`; it was updated to verify the new shared helper module and passed 20/20 on rerun.

## Not run / acceptance still required

- Node 24.15.x runtime validation (the available runtime during this pass was Node 22.16.0, below the repository's declared engine).
- `npm ci`, full TypeScript typecheck, full ESLint, complete `prebuild`, Next.js production build.
- PostgreSQL migration replay, concurrency/property tests against disposable PostgreSQL, RLS and deployed RPC privilege/catalog checks.
- Target Supabase migration history reconciliation for each environment.
- Authenticated browser/device testing, multi-user IDOR tests, recovery journeys and operator workflow acceptance.
- Pi Testnet U2A/A2U end-to-end tests and real provider receipt validation.
- Backup artifact verification, restore drill and PITR exercise.
- Vercel Preview/live deployment verification.

## Phase I acceptance status

| Work package | Status | Remaining proof / work |
|---|---|---|
| 1. Domain ownership | PARTIAL | eliminate duplicate writers; add enforced dependency/import rules |
| 2. Durable workflows/outbox | NOT COMPLETE | transactional outbox design, migration review, worker, leases, retry/dead-letter/replay and PostgreSQL tests |
| 3. Dual-asset ledger | PARTIAL | property/concurrency tests and operator reconciliation workflow; live ledger evidence |
| 4. Pi payment/payout assurance | PARTIAL | authenticated Testnet lifecycle and recovery acceptance |
| 5. Identity/session/recovery | PARTIAL | session/device lifecycle and recovery E2E acceptance |
| 6. Authorization/data access | PARTIAL | deployed RLS/ACL verification and multi-user IDOR testing |
| 7. Rewards/referral abuse | PARTIAL | adversarial campaign/referral farming tests and operator review workflow |
| 8. Trust/safety | PARTIAL | unified queue, evidence lifecycle, moderator operations and appeal E2E |
| 9. Migration governance | PARTIAL | reconcile 198 source files with each target DB's applied history; rehearse held migrations |
| 10. Backup/DR | NOT COMPLETE | prove backup integrity, restore to isolated DB, PITR and recovery objectives |

**Phase I is not complete.** Work packages 2 and 10, and the remaining acceptance evidence above, are blockers before declaring Phase I done or starting Phase II. Production remains **NOT APPROVED**.

## Follow-up implementation — 2026-11-09

### Delivered in source

- Added `lib/architecture/domain-mutation-route-owners.json` as an explicit single-domain owner registry for all 150 mutating `app/api/**/route.ts` handlers found in this baseline. Longest-prefix matching resolves nested routes. Added `scripts/check-domain-mutation-route-owners.mjs` and registered it in `prebuild` and `verify:static` where available. This establishes route-level accountability; it does **not** prove that legacy helper/RPC/database write paths have no duplicate writers. Those still require a deeper write-path graph and live database catalog audit.
- Added `docs/proposals/PHASE-I-TRANSACTIONAL-OUTBOX-DESIGN.sql` (proposal only, deliberately outside `supabase/migrations/`). It specifies stable event and idempotency identities, JSON object payloads, bounded retry counts, `FOR UPDATE SKIP LOCKED` claims, expiring/fenced leases, lease heartbeat, bounded exponential retry, dead-letter state and audited operator replay. `gh_outbox_enqueue` is intended to be called inside each owning business RPC transaction. A separate PostgREST enqueue after a mutation is explicitly not atomic.
- Added `lib/server/outbox/transactional-outbox.ts` with privileged RPC transport, batch claiming, acknowledgement, failure, lease heartbeat, at-least-once dispatch and audited replay wrapper. It is not enabled by a route or scheduler until the proposal is reviewed, deployed and event handlers are registered.
- Added `supabase/tests/phase1_transactional_outbox_rehearsal.sql` for disposable PostgreSQL. It covers idempotency, transaction rollback, lease fencing, acknowledgement, dead-letter and replay. It has **not** been executed because no PostgreSQL server/client is available in this workspace.
- Added `docs/operations/PHASE-I-LIVE-ACCEPTANCE-RUNBOOK.md` covering migration-history comparison, isolated restore/PITR, Pi Testnet, identity/IDOR, reward abuse, moderation and outbox acceptance.
- Added `scripts/check-phase1-outbox-contract.mjs` and npm script `check:phase1-outbox-contract`; registered the check in build/static verification. No package version or dependency was changed.

### Follow-up verification

- Domain mutation route ownership: 150/150 mutating route handlers assigned exactly one domain owner.
- Outbox static contract: 13/13.
- Phase I strategic foundations: 15/15.
- PI atomic guards: 22 assertions.
- Unified earnings ledger: 20/20.
- Pi payout request lifecycle: 21/21.
- Pi payout settlement/recovery: 15/15.
- Pi earnings execution worker: 21/21.
- Wallet authorization: 27/27.
- Rewards release gate: 15/15.
- Identity/authentication: 16/16; identity integration: 17/17; canonical identity: 17/17; profile identity: 16/16.
- Wallet/rewards/membership closeout: 43/43; reward/membership request guards: 10/10.
- Moderation log input: 6/6; durable abuse controls and security retention static gates passed.
- Pi Testnet release gate: 19/19 plus 5/5 child suites (static only).
- Migration source manifest: 198/198.
- Database recovery source gate: 25/25; restore catalog source gate: 10/10; restore evidence validator: 33/33. These are source-contract checks, not a backup restore.
- New TypeScript worker passed Node's syntax-only strip-types check. No TypeScript compiler or full build was run.

### Still not accepted / external evidence required

- No PostgreSQL binary/server/container is available here; outbox SQL rehearsal and real transaction/worker concurrency tests remain NOT RUN. The SQL is a proposal, not a deployable migration.
- No Supabase project credentials or connector are available. Applied migration history, RLS/ACL catalog, backup artifact, isolated restore and PITR remain UNKNOWN/NOT RUN.
- No Pi Browser/Testnet test accounts or provider receipts were supplied. The existing operator runner is ready for controlled Testnet execution; no live U2A/A2U transaction was run.
- No authenticated browser/device/operator test sessions were supplied. Identity recovery, IDOR, rewards farming and moderation workflow checks above remain source/static checks, not end-to-end acceptance.
- Underlying database duplicate-writer elimination is not complete: the new registry assigns one accountable domain per HTTP mutation route, but each route's helper/RPC/table write paths must still be traced and reconciled before claiming one canonical database writer per business command.
- Node 24.15.x `npm ci`, typecheck, ESLint and Next.js production build remain pending. Runtime available in this workspace is Node 22.16.0.

**Status remains Phase I IN PROGRESS; production NOT APPROVED.**

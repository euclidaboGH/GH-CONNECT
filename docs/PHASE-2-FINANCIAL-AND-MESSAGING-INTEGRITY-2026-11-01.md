# Phase 2 — Financial RPC Integrity and Durable Messaging

**Baseline:** GH-CONNECT `0.274.3` after Phase 1  
**Date:** 2026-11-01  
**Scope:** GHC transfer RPC result validation, messaging persistence correctness, regression protection, and preservation of existing economic/security boundaries.

## Confirmed defect 1 — transfer RPC success was insufficiently validated

`lib/server/economy/db.ts` previously accepted a non-error JSON object when it contained a debit and credit object. It did not bind the returned ledger legs to the exact transfer intent. That meant a malformed or mismatched RPC response could be represented to the API caller as a successful transfer, even if the sender, recipient, amount, reference, leg kind, or posted status did not match the request.

### Fix

The response mapper now requires:

- An object payload and explicit `ok: true`.
- A top-level `referenceId` equal to the submitted reference.
- A non-empty transaction ID on each leg.
- A debit leg for the exact sender, with kind `transfer_out`, status `posted`, matching reference, and amount exactly equal to the negative requested amount.
- A credit leg for the exact recipient, with kind `transfer_in`, status `posted`, matching reference, and amount exactly equal to the requested amount.
- Validation before numeric normalization, so normalization cannot conceal malformed response values.
- `idempotent` is treated as true only when the RPC returns the actual boolean `true`.

Invalid or incomplete payloads return a stable generic transfer failure. The API therefore does not report success or proceed with its success-only notifications for an RPC response that does not prove the expected dual-entry transfer. Existing RPC error mapping, timeout behavior, and server-only service-role access remain intact.

## Confirmed defect 2 — message writes could report success without durable confirmation

In `lib/server/messaging/message-store.ts`, when the database was configured but a message insert failed, a non-production environment could fall through to the process-memory store and return a successful result. Also, a nominally successful insert without a returned persisted row could be treated as success. The user could see a message that was not durable and that disappeared on refresh or another server instance.

### Fix

- A configured database remains authoritative in all environments.
- Failed durable inserts return `PERSIST_FAILED`, after the existing client-message-id retry lookup gets a chance to recover an already-committed message.
- The insert must return a representation containing a persisted row ID before the send is acknowledged.
- The successful message object is hydrated from that returned database row.
- The process-memory path remains available only when no database is configured and the existing non-production policy permits it; production still fails closed when durable storage is unavailable.

This does not alter message membership, attachment ownership checks, direct-message privacy checks, rate limits, or message schema.

## Regression checks added

- `scripts/check-phase2-transfer-rpc-result-integrity.mjs` — 10 checks covering exact intent binding and dual-entry response integrity.
- `scripts/check-phase2-messaging-durable-write.mjs` — 5 checks covering durable insert confirmation and safe idempotent retry recovery.
- Both checks are registered in `package.json` and in `npm run verify:static`.

## Verification performed

- `npm run verify:static` — **passed** across the complete registered static contract suite, including the two new checks.
- Transfer RPC result integrity — 10/10.
- Messaging durable-write integrity — 5/5.
- Wallet/transfer integrity — 8/8.
- Transfer-request idempotency intent — 11/11.
- Transfer-request RPC ACL — 8/8.
- Transfer RPC boundary — 9/9.
- Transfer streaming boundary — 9/9.
- Economy database boundaries — 10/10.
- Economy RPC timeouts — 11/11.
- Messaging bounded JSON — 28/28.
- Social upstream timeout contracts — 8/8.
- Migration source manifest — 175/175 synchronized.

These are source-level/static contract checks, not live financial transaction evidence.

## Preserved safeguards and change limits

- No SQL migration was added or applied.
- No balances, ledger rows, wallet authorization records, reward issuance rules, or payout states were changed.
- No financial flow was enabled, no payment was simulated, and no service-role secret was exposed.
- No package dependency was upgraded or downgraded; project version remains `0.274.3`.
- No unrelated UI, application architecture, or database schema was rewritten.

## Remaining release gates

The required runtime is Node `24.15.0` (`.nvmrc`); the current execution environment only provides Node `22.16.0`, and `node_modules` is absent. Therefore this phase did **not** claim a TypeScript check, ESLint run, `npm ci --legacy-peer-deps`, or production build. It also did not contact Supabase or Pi Testnet. Before production release, run the install/typecheck/lint/build gates under Node 24 and test the transfer result contract plus messaging persistence against a disposable database and dedicated Testnet users. Verify duplicate transfer retries, changed-payload reference reuse, transient database failure, and ambiguous network timeout recovery without creating duplicate ledger legs.

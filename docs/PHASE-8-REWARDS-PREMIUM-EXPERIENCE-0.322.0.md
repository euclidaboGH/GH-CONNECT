# Phase 8 — Rewards Premium Experience and Ledger History (0.322.0)

## Implemented in this increment

- Rewards history now requests up to 200 transactions from the authenticated same-user GHC wallet endpoint using credentials, `cache: no-store`, an eight-second timeout and `AbortController`.
- The server endpoint enforces authenticated same-user access; the client validates response success, row identity, positive finite amounts, valid timestamps, known transaction statuses and bounded display strings.
- Account changes clear the previous server ledger rows before the next request.
- Server ledger entries are sorted newest-first and support text search plus status filters (all, posted, pending, reversed, expired and failed).
- Local reward-domain records remain visible as supplemental activity, are independently filtered, and are not mislabeled as durable server ledger records.
- Durable achievement state is cleared immediately when the account identity changes before rehydration.
- Existing daily claim status coordinator already reconciles on focus, reconnect, visibility return and a bounded 60-second refresh cadence, so claims made on another device are eventually reflected without client-side crediting.
- The mission interface continues to state clearly that progress is not a reward credit. The server mission endpoint remains fail-closed (503) until durable verification and idempotent one-time claim storage exist.
- Added a Phase 8 source release-gate contract covering daily claim authentication/rate limits/body bounds, server-derived redemption, locked generic issuance, fail-closed missions, Testnet-only Pi cashback authorization and separation of financial authorities.

## Financial/security invariants

- The ledger endpoint is read-only in this flow; no client-side GHC credit, mint, settlement, transfer, cashback payout or maturity action was added.
- Pi cashback remains a separate PI statement/claim workflow and is not mixed into GHC reward history.
- Mission rewards are not enabled merely because a client submits a mission code.
- No SQL migration was added, changed or applied.

## Verification

- New Rewards ledger-history source contract: `scripts/check-phase8-rewards-history.mjs` (20/20).
- Rewards source release gate: `scripts/check-phase8-rewards-release-gate.mjs` (12/12).
- Existing Phase 8 integrity entry contract remains registered.
- Supported Node 24.15.x typecheck, lint, Next.js production build, browser/device accessibility/performance, live database/RLS, Testnet reconciliation and operator approval remain separate release gates.

## Phase 8 completion posture

Premium home, daily-claim honesty, progress/achievement presentation, reward history filtering and fail-closed protections have source coverage. Mission reward verification and any associated reward issuance remain intentionally unavailable until backend durable verification and atomic idempotency are supplied and independently reviewed. Therefore Phase 8 is not production-approved and should not be marked fully closed yet.

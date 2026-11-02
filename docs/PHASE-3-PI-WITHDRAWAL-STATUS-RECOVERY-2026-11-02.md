# GH-CONNECT — PI Wallet Phase 3: Withdrawal Status, Recovery and Error Boundaries

Date: 2026-11-02  
Baseline: Phase 2 action/eligibility archive, including Phase 1.1 identity reconnect hardening.  
Scope: Additive application-layer hardening; no database migration and no payout gate changes.

## Problems addressed

1. A client network failure after request submission was described as though no request had been created, even though the server might have committed before the response was lost.
2. Users lacked a dedicated, user-scoped view of durable PI earnings payout request status and verified transaction receipts.
3. A user could attempt another withdrawal while a previous request was still reserved, processing, or uncertain.
4. Unanticipated failures before endpoint-local `try/catch` blocks could escape to a generic framework error response.

## Changes

- Added `GET /api/economy/earnings/withdrawals/status`.
  - Requires the canonical authenticated GH user.
  - Queries only rows owned by that user, with a bounded result set and no-store response headers.
  - Returns the request ID, gross/fee/net atomic amounts, network, status and timestamps.
  - Returns a provider transaction ID only when the durable request is `paid`.
  - Does not return the recipient Pi UID, provider payment ID or provider receipt payload.
  - Uses a stable unavailable response for database, network and unexpected failures.
- Added a withdrawal request history panel to `components/ghc/unified-earnings-dashboard.tsx` with manual refresh, request ID, amount breakdown, current state, verified transaction ID for paid requests, and explicit guidance for uncertain outcomes.
- Retained the client idempotency key after an ambiguous network outcome and associated successful response IDs with the tracked request. The key is cleared only after a terminal status (`paid`, `failed`, or `released`) is observed.
- Blocked overlapping client submissions while the known recent payout history contains `reserved`, `processing`, or `uncertain` requests. The server-side reservation and idempotency rules remain authoritative.
- Added outer safe JSON error boundaries to the payout request, payout status, and payout execution endpoints. Responses are no-store and avoid returning exception details to clients; server logs record only the error class.
- Preserved transaction history, eligibility and identity controls, wallet authorization, server-side recipient mapping, Testnet-only execution gates, provider receipt verification, lease fencing and reservation recovery.
- Registered `scripts/check-phase3-pi-withdrawal-status-recovery.mjs` in both `verify:static` and `prebuild`.

## Verification

- Phase 3 withdrawal status/recovery contracts: **16/16 passed**.
- Phase 2 wallet actions: **13/13 passed**.
- Phase 1 identity reconnect: **13/13 passed**.
- Wallet authorization: **13/13 passed**.
- Earnings dashboard: **13/13 passed**.
- Wallet refresh stability: **10/10 passed**.
- JSX safety scan: **passed**.
- Full `npm run verify:static`: **passed**.
- Archive integrity: checked after packaging.

## Remaining release gates

The following were not verified in this environment: TypeScript/lint/production build under the project's declared Node version, authenticated browser testing, live Supabase request/status reads, Pi Browser authentication, and Testnet A2U end-to-end execution. Do not infer successful real withdrawals from static checks.

No migration was applied, no database was modified, no production environment variables were changed, and no payout was attempted. Payout intake and execution remain controlled by existing explicit Testnet gates.

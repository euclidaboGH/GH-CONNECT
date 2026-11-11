# Phase 29 — Wallet input stability and Rewards claim integrity (0.330.15 patch)

Baseline: `GH-CONNECT-0_330_15-SLIM-HEADERS-1.zip` (2026-11-07).

## Wallet defects corrected

- Global numeric tab shortcuts previously treated digits typed into amount/PIN inputs as navigation commands. Since changing the active tab closes the Wallet overlay, typing a withdrawal amount or PIN could unexpectedly return the user to Feed. Shortcuts now ignore editable elements, dialogs, modified/composition keystrokes, and are disabled while Wallet or Settings is open.
- Withdrawal PIN status previously treated failed/missing persistence as an unconfigured PIN in the client. The UI now accepts status only when the endpoint explicitly returns `ok: true` and a boolean `configured` value; otherwise PIN entry and submission remain blocked with a clear service/migration message.
- PIN setup previously used an upsert/PATCH fallback that could replace an existing PIN. First-time setup is now insert-only with duplicate conflicts ignored and detected; an existing PIN cannot be overwritten by repeating the setup action.

## Rewards defect corrected

- `pending_validation` reward records were labelled “Ready to claim” and offered a claim action even though the server claim endpoint correctly rejects holds still under review. Only `eligible` and `approved` records now expose the claim action. `pending_validation` is shown as under review.
- Pi cashback statement totals now fail closed when atomic totals or reservation totals are malformed. The UI renders an unknown amount as `—`, not a fabricated zero.

## Preserved financial and security boundaries

- No client-side balance authority, reward issuance, transfer, payout, or settlement was added.
- Daily GHC claim remains authenticated, idempotent and server-computed, with a 48-hour pending/maturity gate.
- PI registration bonus remains the one-time 3 PI policy with historical 0.05 PI claimant reconciliation to 2.95 PI, controlled by existing server policy and Testnet flags.
- PI cashback remains a separate quarterly 0.5% PI workflow and separate A2U payout lane.
- Generic activity/mission GHC issuance remains disabled; verified missions unlock non-financial achievements only.
- Existing RLS and service-role-only database boundaries remain unchanged. No migration is added or auto-applied by this increment.

## Verification performed

- Phase 28 consent/navigation/PIN contract: 29/29 static checks passed.
- Phase 8 Rewards entry contract: 18/18 passed.
- Phase 8 Rewards history contract: 20/20 passed.
- Phase 8 Rewards source release gate: 15/15 passed.
- PI withdrawal boundary: 12/12 passed.
- PI earnings request lifecycle: 21/21 passed.
- PI settlement/recovery: 15/15 passed.
- PI execution worker: 21/21 passed.
- Receipt and lease fencing: 13/13 passed.
- Available balance policy: 12/12 passed.
- Withdrawal fee: 8/8 passed.
- Earnings final gate: 39/39 passed, including its 12 child track suites.
- Wallet ledger resilience: 17/17 passed.
- Wallet withdrawal journey: 11/11 passed.
- Wallet release gate: 19/19 passed.

These are source-level/static contracts, not proof of a live Pi Testnet payout or database migration state.

## Remaining acceptance gaps

1. Apply/verify `20261105200001_withdrawal_pin_security.sql` in the intended Supabase Testnet project. A source archive cannot establish whether it is applied remotely.
2. Add a verified PIN-change/recovery journey; do not permit unauthenticated reset or direct overwrite.
3. Make failed-PIN attempt counting atomic under concurrent requests. Current read/compare/PATCH sequencing can race; harden with a service-role-only database RPC and PostgreSQL concurrency tests before treating lockout as concurrency-safe.
4. Add paginated/cursor-based reward history beyond the current 200-entry view.
5. Run Node 24 typecheck, lint and production build, then browser/mobile regression tests with Pi Browser and a funded Testnet wallet.
6. Validate daily claim, 48-hour redemption, registration bonus reconciliation, cashback statement and PI withdrawal against authenticated Testnet users and canonical database records.
7. Mainnet remains disabled; no Mainnet credentials, network flags or payout execution are introduced.

## Release boundary

Source remediation only. No database migration was applied, no live wallet was authorized, no PI transfer was executed, and no payout is represented as successful by this work.

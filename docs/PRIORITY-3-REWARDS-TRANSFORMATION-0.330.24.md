# Priority 3 — Rewards transformation (0.330.24)

Date: 2026-11-07  
Baseline: `GREENHAVEN-0.330.23-FEED-COMPLETE-ROADMAP-ALIGNED-ROOT.zip`

## Product objective

Treat Rewards as a complete user journey connected to Wallet, Feed, Communities, Profile and Membership. The UI must explain what users can do, what has been verified, what is awaiting review or maturity, what can be claimed, and what has actually been credited. Do not make missions look like a financial promise when the current policy only grants achievements.

## Baseline audit

The baseline already contains a substantial Rewards source foundation:

- Premium Rewards journey hero with server-confirmed GHC balance semantics.
- Daily claim route with authenticated identity, durable rate limiting, idempotency and server-computed issuance.
- 48-hour maturity/lock policy for daily claims.
- Seven durable mission proof types and server-side idempotent achievement unlocks.
- Authenticated GHC reward history with account isolation, search and status filters.
- Separate quarterly Pi cashback statement and Testnet-only payout lane.
- Mission achievement issuance is non-financial; generic activity GHC issuance remains policy-locked.

This increment does not recreate those systems.

## Delivered in 0.330.24

### Rewards experience

- Add a clear split between locally tracked claim-ready records (`eligible` / `approved`) and records still under validation (`pending_validation`).
- Include `approved` records in the attention summary so approved-but-unclaimed items are not silently omitted.
- Avoid describing all attention items as pending claims; use reward-status language that does not imply a server credit.
- Explain the mission policy in the mission experience: verified missions unlock durable achievements but do not issue GHC or Pi under current policy.
- Preserve separate GHC daily claims, GHC ledger history and Pi cashback journeys.
- Remove a duplicate recommendation filter that performed the same predicate twice.

### Wallet trust UX

- Add a dedicated Wallet `Security & PIN` destination and a withdrawal PIN manager.
- Read PIN status only from the existing authenticated, no-store endpoint.
- Show first-time setup only when the server explicitly returns `ok: true` and `configured: false`.
- Require two matching six-digit values; submit through the existing server `set` action.
- Reuse the existing insert-only setup, weak-PIN rejection, server-side scrypt hashing, durable rate limiting and existing recovery panel.
- Never store the PIN in local/session storage or log it.
- Clarify that this is currently a Pi withdrawal PIN, not a universal PIN for every transaction type.
- Clarify the distinction between available Pi, the amount eligible to withdraw under current server policy, and funds reserved against payout requests.
- Explain that the self-service release action can only release requests that have not started provider execution. Provider-started requests require provider/ledger reconciliation.

## Financial and database boundaries

- No migration added, applied or marked as remotely applied.
- No Pi or GHC ledger entry created or modified.
- No available/reserved balance reclassification.
- No payout, transfer, settlement, refund or provider operation executed.
- No client-side reward issuance or balance authority introduced.
- Existing mission achievement policy, daily-claim idempotency, cashback separation, RLS and service-role boundaries remain unchanged.

## Source verification

- Priority 3 Rewards + Wallet trust UX: 15/15.
- Rewards entry: 18/18.
- Rewards history: 20/20.
- Rewards source release gate: 15/15.
- Verified missions: 31/31.
- Wallet Rewards transparency: 9/9.
- Wallet product transformation: 14/14.
- Wallet completion: 12/12.
- Wallet withdrawal journey: 11/11.
- Wallet release gate: 19/19.
- Wallet security hardening: 11/11.
- Project truth: 10/10.
- Release hygiene: 11/11.
- Migration source manifest: 191/191.

These are source/static contracts, not a supported-runtime build or live acceptance.

## Open issues and acceptance gates

1. **Pi available-to-reserved complaints:** inspect each affected user's authenticated `gh_earnings_ledger_entries`, payout request state, idempotency/reference keys, reservation/settlement/release rows and provider execution result. Identify duplicate reservations, valid in-flight holds, stale snapshots or failed reconciliation. Do not infer cause from aggregate balances.
2. **Withdrawal PIN migration:** reconcile and validate `20261105200001_withdrawal_pin_security.sql`, `20261107120001_withdrawal_pin_recovery_questions.sql` and `20261107130001_wallet_security_hardening.sql` against Testnet remote history and schema before any approved apply. Source presence is not remote application evidence.
3. Test first-time PIN setup, duplicate setup conflict, weak PIN rejection, recovery setup/reset, wrong attempts, lockout and request-bound withdrawal proof with authenticated Testnet accounts.
4. Add pagination/cursor support for reward history beyond the current bounded 200-row view.
5. Run Node 24.15.x `npm ci --legacy-peer-deps`, typecheck, lint, safety scan and production build.
6. Run Android, embedded WebView and Pi Browser responsive/accessibility acceptance.
7. Validate daily claim maturity, GHC ledger credit, mission evidence and Pi cashback statement against Testnet data. Mainnet remains disabled pending separate approval.

## Release decision

`0.330.24` is a source/UX increment only. Production status remains **NOT APPROVED** until the runtime, browser/device, remote migration, Testnet and operator acceptance gates pass.

# GreenHaven Pi Earnings, A2U Payouts and Four-Month Cashback Roadmap

Status: **Testnet cashback A2U payout path implemented in source; migration application, funded-wallet execution tests, remaining revenue-source wiring and Mainnet approval remain outstanding**  
Baseline: `0.157.25`  
Last updated: 2026-10-29

## Product decision

Keep this capability inside existing navigation. Do not create a new top-level section.

- **Rewards Center = earn and understand.** Continue to show GHC daily rewards separately. Add Pi promotional bonuses, four-month Pi cashback statements, eligible creator/community revenue share, and pending/approved reward explanations when each source is actually implemented and funded.
- **Wallet = manage and receive.** Add a Pi Earnings summary, available-to-claim amount, payout action, payout history/receipts, and accurate processing/failure states within the existing wallet. GHC remains a separate asset and ledger.
- **One server-authoritative Pi earnings ledger and one payout engine** must serve both screens. UI cards are projections, never balance authorities.

## Four-month Pi cashback policy

The product requirement is 3% of the *net eligible company revenue attributable to an individual user's eligible Pi spending*, calculated and awarded at the end of each four-month period. It is not 3% of gross spend unless the business owner explicitly changes the policy; those formulas have materially different funding costs.

Use fixed UTC accounting windows (proposed: Jan 1–Apr 30, May 1–Aug 31, Sep 1–Dec 31 UTC) rather than rolling per-user windows. Publish the schedule before launch. Each period must be uniquely identified and finalized idempotently.

For user `u` and period `p`:

`eligible_net_revenue(u,p) = eligible attributable company revenue − attributable refunds/chargebacks − provider fees − taxes − approved compensating adjustments`

`cashback_pi(u,p) = floor_to_1e-7_pi(max(0, eligible_net_revenue(u,p)) × 0.03)`

The exact attribution and fee/tax policy must be approved by finance/product before implementation. Do not subtract the entire gross purchase when only a platform commission is company revenue; do not include seller proceeds, unsettled receipts, unrelated revenue, GHC transfers, test transactions, or unverified/manual entries without an explicit reviewed policy. For Pi amounts, store integer atomic units at 10^-7 PI (or an equally exact decimal design); do not use floating-point money arithmetic.

### Cashback controls

- Count only completed, verified Pi transactions and verified revenue events tied to their source transaction.
- Refunds, chargebacks and corrections must be compensating append-only events; never edit financial history in place.
- Each revenue source event and each `(user, period, policy_version)` calculation needs a unique idempotency constraint.
- Close a period using a durable, retryable job. Persist the inputs, policy version, calculation output, run status, and audit metadata; a retry must not issue a second entitlement.
- Separate `pending`, `approved/available`, `reserved for payout`, `paid`, `failed/released`, and `needs_review` states. An entitlement is not a blockchain payment.
- Do not silently claw back Pi already transferred. Post-period adjustments require an explicit, reviewed carry-forward/negative-balance policy and user-visible statement.
- Show the user eligible spend, attributable net company revenue, 3% rate, period dates, adjustments, rounded cashback, and the date the result was finalized.
- Do not promise an amount before the period closes and the eligible source data is reconciled. Clearly disclose minimum withdrawal, any limits, and carry-forward rules before launch.

## Existing-source audit findings (0.157.23)

1. Existing A2U routes are `app/api/payments/a2u/create/route.ts` and `app/api/payments/a2u/complete/route.ts`. They currently implement a privileged, serialized, durable **seller payout** workflow, not a general-purpose end-user reward withdrawal API. Do not repurpose a seller's payout request as a user's cashback claim.
2. The A2U create route explicitly fails closed unless Testnet configuration is enabled. Preserve that gate until the official Pi Developer Portal confirms GreenHaven's eligibility for Mainnet A2U and outgoing-wallet authorization. Do not flip environment flags to simulate eligibility.
3. Existing migration `20261022010091_company_revenue_event_journal.sql` provides an append-only company-revenue event journal with source-event idempotency and net company revenue fields. The v0.157.23 migration `20261029010001_pi_cashback_attribution_and_period_ledger.sql` adds nullable canonical payer attribution, an explicit opt-in cashback eligibility flag, a service-role-only attributed append RPC, four-month UTC period records, unique per-user entitlements, and an idempotent period-close RPC. Existing un-attributed events remain ineligible by default. Before this increment, no application called `appendVerifiedCompanyRevenueEvent`; this release wires the marketplace PI commission path only. v0.157.23 now wires the marketplace PI commission producer to pass the authenticated order buyer and stable completed-intent timestamp, and retries that idempotent journal append on verified-order recovery without submitting a new payment. Other payment sources (membership, promotions, digital services, creator tips and refunds/chargebacks) remain unwired or require separate eligibility review, so the journal is not yet a complete live per-user cashback base.
4. Existing migration `20261022010113_pi_a2u_sdk_execution_orchestration.sql` binds seller payout execution to `gh_seller_payout_requests`. New migration `20261029010004_pi_cashback_testnet_a2u_payouts.sql` adds the distinct `gh_pi_cashback_a2u_payouts` entitlement-linked cashback payout ledger and service-role RPCs while sharing the same global A2U sequence lease. The new `/api/economy/rewards/pi-cashback/claim` endpoint is authenticated, derives the recipient from the canonical linked Pi identity, selects finalized entitlements server-side, verifies Pi Testnet provider payment/recipient/amount/txid and only marks a payout paid after verified developer completion. This is source implementation only until migration, funding, credentials and Testnet end-to-end checks pass.
5. Migration `20261029010001_pi_cashback_attribution_and_period_ledger.sql` is classified REVIEW_REQUIRED and remains unapplied. This increment wires only the marketplace PI commission source; v0.157.27 adds the Testnet-only cashback payout endpoint and payout ledger, but not Mainnet authorization. Other sources must be traced and wired individually; do not apply migrations to Testnet/Mainnet merely because they exist in the ZIP.

## Staged implementation plan

### A. Source mapping and product policy

- Inventory every Pi spend/settlement path: marketplace commissions, membership, promotion/digital services, creator tips and any other eligible transaction classes.
- For each source, document the canonical payment ID, paying GreenHaven user ID, company-earned amount, currency precision, provider fees/taxes, settlement proof, refund/chargeback linkage, and whether it qualifies.
- Exclude seller payable amounts and gross marketplace amounts from company revenue.
- Approve the precise 3% base, UTC period calendar, late-refund treatment, minimum payout, carry-forward and dispute rules.

### B. Ledger and calculation migration (source foundation added in v0.157.23; operational gates remain)

- v0.157.23 adds privacy-minimal `paying_user_id` attribution to verified revenue records and a separate `cashback_eligible` opt-in flag; legacy journal writes default to ineligible. The attributed append RPC is service-role-only and rejects idempotency retries that change the payer or eligibility.
- v0.157.23 adds four-month period records and per-user entitlements with unique `(user_id, period_id, policy_version)` keys, exact PI atomic-unit arithmetic and a service-role-only idempotent close RPC. It does not yet implement user-readable statements, payout reservations, operator review workflow or a complete append-only entitlement state-transition audit. Previously recorded unattributed revenue rows are not silently backfilled and will conflict rather than being reassigned to a user.
- Add reconciliation queries proving that source revenue totals, per-user attribution, period totals and entitlement totals agree.
- Validate SQL on disposable PostgreSQL, then Testnet, and compare remote migration history before any real deployment.

### C. Payout integration (Testnet source path added in v0.157.27; operational verification remains)

- The separate cashback payout domain now shares the global app-wallet sequence lease and uses idempotent entitlement reservation, durable provider payment/txid bindings, incomplete-payment recovery, and a separate paid status. Validate that the new RPCs share the same lock ordering and sequence lane on disposable PostgreSQL and Pi Testnet.
- Enforce one global A2U submission lane, durable idempotency, recipient UID binding, amount/network checks, verified transaction evidence, timeout recovery and operator attention states.
- A successful HTTP response or SDK callback alone must not mark the ledger paid. The new settle RPC requires a completed durable execution and exact provider payment/txid binding; validate provider evidence and SQL transaction semantics before deployment.
- Keep all API keys and wallet seed material server-side. Never accept recipient UID, amount, entitlement owner, or payable balance as trusted client authority.

### D. UI integration

- Rewards Center: Pi Cashback tile, current period progress, historical statements, transparent formula and eligibility status.
- Wallet: Pi Earnings total, available-to-claim amount, claim confirmation, destination identity summary, payout state, receipt and retry/recovery guidance.
- Preserve existing GHC daily claim and GHC balance behavior. Clearly label GHC versus PI in every amount and action.

### E. Required acceptance tests

- Same source event replayed; same idempotency key with different amounts; duplicated transaction mapping; two user IDs competing for one source event.
- Revenue period boundary at UTC midnight, leap year, late event, refund before close, refund after close, chargeback, zero/negative net revenue and exact rounding to 10^-7 PI.
- Concurrent period close workers and retries after crash; no duplicate entitlement or payout.
- Insufficient funded balance, A2U sequence lease busy, unrelated incomplete A2U payment, API timeout after provider creation, verified transaction mismatch, recipient identity change and operator-review state. For the cashback path, verify one entitlement cannot be reserved twice, retries reuse the same provider payment, the global seller/cashback sequence lease excludes concurrent sends, and paid status appears only after a verified Testnet wallet transfer.
- RLS/ACL: no direct client writes to finance tables or privileged RPCs; one user cannot read another user's earnings statement.
- Reconciliation of every entitlement and paid amount against source revenue and provider transaction evidence.

## Release gates

1. **Source foundation (v0.157.23):** attributed journal adapter, opt-in eligibility, period and entitlement schema, idempotent period-close RPC, and marketplace PI commission attribution. Other payment/revenue sources remain unwired.
2. **Ledger gate:** wire each source only after payment ownership, company revenue, fees, refunds and settlement evidence are proven; approve attribution and late-refund policy.
3. **Testnet gate:** migration history reconciled; disposable DB tests, multi-account security tests, A2U duplicate/recovery tests, and end-to-end wallet receipt verification pass.
4. **Mainnet gate:** explicitly confirm GreenHaven's A2U eligibility and outgoing-wallet approval with Pi; configure independent Mainnet credentials/funding; perform a controlled authorized payment and reconciliation; then review listing evidence. Listing approval remains Pi Network's decision.

## Official Pi references

- Pi Platform API: https://developers.minepi.com/docs/api-reference/PlatformAPI
- Pi Client SDK reference: https://developers.minepi.com/docs/api-reference/SdkReference
- Pi Advanced Payments: https://developers.minepi.com/docs/accept-payment/PaymentsAdvanced
- Mainnet listing: https://developers.minepi.com/docs/build-first-app/MainnetListing
- Mainnet launch: https://developers.minepi.com/docs/build-first-app/Launch

Pi A2U Mainnet availability is permission-gated and must be verified for GreenHaven; repository code cannot grant that permission. No production payment, remote database mutation, migration application, or Mainnet activation is performed by this roadmap.


## v0.157.24 statement UI increment

The authenticated, read-only cashback statement RPC and API are implemented in source and embedded in the existing Rewards Center and Wallet. The response is scoped to the canonical authenticated account and uses PI atomic-unit strings. v0.157.27 adds a Testnet-only payout claim route and a separate payout ledger, but the new migration remains REVIEW_REQUIRED and unapplied. Funded-wallet transfer, retry/recovery and browser acceptance remain unverified; Mainnet authorization is not enabled.


## v0.157.25 period-close reconciliation gate

The four-month cashback window remains fixed in UTC, but period finalization is delayed until seven days after the window end. This grace period gives late verified payment/revenue journal events and recovery retries time to settle before the immutable cashback statement is calculated. It is not an extra earning window and does not enable A2U withdrawals. Migration `20261029010003_pi_cashback_period_reconciliation_grace.sql` requires disposable PostgreSQL ACL/concurrency validation and target migration-history reconciliation before application.

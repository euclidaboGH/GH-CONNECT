# Phase 5 — GHC, Pi and Financial Integrity

**Status:** local source review and static regression only. No Supabase, Vercel, Pi network, Paystack, or production service was contacted.

## Objective

Protect the boundaries between GHC utility balances, Pi provider payments, company revenue, seller proceeds, creator payables, and bank payout execution. A successful browser callback is not settlement evidence.

## Source contracts reviewed

- **Durable Pi intents:** provider payment IDs are unique; server-side intent state is durable; incomplete-payment recovery checks the provider and amount; approval/completion/fulfillment routes load durable intent state.
- **Membership:** entitlement activation is separated from client claims; purchase recovery handles orphaned debit/fulfillment paths; amount and ownership bindings are checked in source tests.
- **GHC ledger:** ledger mutations are mediated by server/database RPC paths; spending and transfers have separate references and idempotency constraints; payout settlement is expected to debit and credit atomically.
- **Creator/tip settlement:** settlement binds to a durable Pi intent, re-checks provider status and exact amount, and records creator payable separately from payout.
- **Seller payout:** only eligible completed/verified orders can back a payout; settlement is idempotent; the database transaction is the settlement authority; operator lifecycle endpoints cannot independently mark a payout paid.
- **Pi App-to-User payouts:** disabled by default, Testnet-only when enabled, private seed stays server-side, provider records must match recipient, amount, network, direction and transaction evidence, and recovery is bound to a durable execution.
- **GHC-to-Pi withdrawal:** explicitly disabled by default; cross-asset conversion is not implied by a GHC balance.
- **Paystack bank payouts:** provider secrets remain server-side; execution is gated; ambiguous or conflicting provider outcomes are quarantined for review rather than blindly retried.
- **Company revenue:** remains a separate authority from user GHC balances and provider payment status.

## Local checks executed

| Check | Result |
|---|---:|
| Economy v1.2 | 174 passed |
| Daily claim → wallet pipeline | 35 passed |
| Durable Pi payment and recovery | 49 passed |
| Phase 15 account/payout quality | 25/25 passed |
| Phase 17 media/financial foundation | 18/18 passed |
| Phase 19 financial/media readiness | 29/29 passed |
| Phase 20 payout adapters | 19/19 passed |
| Phase 22 Paystack bank payouts | 42/42 passed |
| GHC→Pi withdrawal default-off | 7/7 passed |
| Stage 2 source gates | exit 0; 16/17 logical groups reported, with one non-critical group not satisfied |
| Membership orphan recovery | passed |
| Transfer-pair orphan recovery | passed |
| GHPV settlement | 23 passed |
| GHPV calibration | 18 passed |

These are repository source/static tests. They do not execute PostgreSQL transactions or verify provider behavior in a live environment.

## Unresolved gates

1. Clean dependency install, TypeScript, lint, and full Next.js production build.
2. Execute migrations on disposable PostgreSQL and test RLS/grants using anon, authenticated, and service-role contexts.
3. Test concurrency and crash recovery for duplicate payment callbacks, membership fulfillment, GHC transfers, creator settlement, seller payouts, and Paystack payout reconciliation.
4. Verify provider sandbox flows with authorized test credentials and separate test accounts.
5. Confirm settlement and reconciliation records agree before any feature is enabled.
6. Obtain product/finance/legal approval for prices, taxes, refunds, chargebacks, limits, and payout policies where applicable.

## Safety decision

Do not enable paid activation, GHC→Pi conversion/withdrawal, Pi A2U, seller GHC payouts, or bank payout execution based solely on this report. Existing feature gates and operator approvals must remain in place until the applicable runtime and operational evidence exists.


## Superseding Phase 5–6 hardening

The source-only follow-up is documented in [`PHASE_5_6_MASSIVE_HARDENING.md`](./PHASE_5_6_MASSIVE_HARDENING.md). It adds durable idempotency lookup, removes production memory fallbacks from payment authority reads, requires durable provider binding/status writes before Pi approve/complete operations, and makes withdrawal eligibility fail closed on unavailable balance/lock/history reads. The follow-up also corrects the media object path to match the existing owner-prefix SQL constraint and verifies direct-upload completion before a media asset is marked ready. The new idempotency lookup and row-locked bind/transition RPC migrations are classified `REVIEW_REQUIRED`; do not deploy their callers until the migrations are reviewed and reconciled against the empty Testnet project.

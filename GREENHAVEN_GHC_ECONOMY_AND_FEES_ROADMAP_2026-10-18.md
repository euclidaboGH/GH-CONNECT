# GreenHaven GHC Economy, Curation, Referral and Utility Fees

**Date:** 2026-10-18  
**Applies to:** GH-CONNECT 0.61.1 remaining upgrade phases (Phase 7 priority)  
**Status:** product/engineering plan with atomic inventory reservation source candidate added in Phase 9; referral rewards, funded curation, listing/community fees and live Testnet/Mainnet reconciliation remain incomplete. Nothing in this document authorizes live rollout.

## 1. Approved economy principles

1. GHC is an internal GreenHaven utility/reward unit, not a public cryptocurrency or cash-redeemable asset.
2. The only approved sources of newly issued user-available GHC are Daily Claim and qualifying referral rewards.
3. Daily Claim rewards remain pending for 48 hours and are redeemed once through the authoritative ledger.
4. Referral rewards are 5% of the canonical, approved VIP upgrade price denominated in GHC. They must be issued by a dedicated server/database path, never a client API or generic credit function.
5. Curation rewards to creators are funded by existing GHC from upvoters; they redistribute rather than issue GHC.
6. VIP upgrades, creator contributions/tips, marketplace listing fees, community creation fees and future in-app utilities are GHC sinks. Selected functions may also accept Pi through verified Pi payment intents.
7. Transfers, curation and reversals must preserve an auditable ledger. No balance is held authoritatively in client state.

## 2. Referral programme

### Eligibility and flow

- Generate a stable, unique referral code and shareable link for every registered account. Do not expose internal database IDs, session tokens or private profile data in the link.
- Capture referral attribution once at signup and persist it server-side. Define and enforce the attribution window before launch; recommended default: 30 days from first valid referral-link visit to completed registration.
- Prohibit self-referrals, circular/referral-chain abuse, duplicate accounts, recycled identities and rewards to restricted/suspended accounts. Use available Pi identity/account verification signals where permitted, without relying on IP address alone.
- Trigger a reward only after the referred user completes their first qualifying VIP upgrade, payment settlement is verified, and any configured refund/chargeback hold window passes. A referral earns once per referred account, not on renewals or repeated upgrade retries.
- Recommended launch rule: qualify only upgrades paid in GHC, because the reward is GHC issuance tied to a GHC utility sink. If Pi-paid VIP upgrades are intended to qualify too, this must be explicitly budgeted and approved as an issuance policy; do not silently issue GHC after a Pi payment.
- Calculate `referral_reward_ghc = canonical_vip_upgrade_price_ghc * 0.05` using a server-side price snapshot. Store the exact price/version, currency, payment/upgrade reference, referral attribution and calculation in an immutable audit record. Round to the ledger's supported precision (recommended 4 decimal places) and make the reward RPC idempotent.
- Pending, paid, rejected and reversed referral states must be visible to the referrer. Never reward signup alone. If a qualifying upgrade is refunded/reversed, use an auditable compensating entry and prevent duplicate recovery.

### Existing price discrepancy — blocking decision

## Approved membership pricing rule (2026-10-18)

Canonical monthly list prices are **VIP 150 GHC** and **VVIP 300 GHC**. Annual list prices are strictly monthly × 12: **VIP 1,800 GHC** and **VVIP 3,600 GHC**. The 12-month GHC subscription receives a 20% discount, so the actual GHC charge is **VIP 1,440 GHC** and **VVIP 2,880 GHC**. The application price catalogue and UI must show the list price, discount and final charge distinctly; the annual price must never be calculated as monthly × 10.

The four requested GHC subscription options all include **one bonus month of membership**. Discounts apply to the paid months' list price, not the bonus month:

| Paid duration | VIP list price | VIP discount | VIP GHC charge | VIP access | VVIP list price | VVIP discount | VVIP GHC charge | VVIP access |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 month | 150 | 0% | **150** | 2 months | 300 | 0% | **300** | 2 months |
| 4 months | 600 | 5% | **570** | 5 months | 1,200 | 5% | **1,140** | 5 months |
| 8 months | 1,200 | 10% | **1,080** | 9 months | 2,400 | 10% | **2,160** | 9 months |
| 12 months (1 year) | 1,800 | 20% | **1,440** | 13 months | 3,600 | 20% | **2,880** | 13 months |

**Implementation note:** the existing code currently supports only monthly/yearly membership periods. The current annual GHC price has been reconciled to the 20%-discounted 12-month charge, but the 1/4/8/12-month selector, bonus-month expiry calculation, durable payment product IDs, and end-to-end fulfillment must be completed together in Phase 7 before advertising all four options. Until then, do not represent all four plans as live. Pi pricing is a separate price rail; these GHC discounts do not imply a Pi exchange rate. Product/operator approval is required before changing Pi duration products.

Referral reward rule: calculate 5% from the **actual qualifying GHC amount charged** for the VIP plan, after the plan discount and excluding the bonus month value. Use exact ledger-supported precision and a stored pricing version. Example: a 12-month VIP purchase charged at 1,440 GHC produces a 72 GHC referral reward (5% of 1,440), not 90 GHC (5% of the undiscounted 1,800 list price).

## 3. Curation and creator rewards

- Keep upvote/downvote as content-quality signals separate from Likes and profile reactions.
- Derive the upvoter's available/spendable GHC from the authoritative ledger inside the settlement transaction. Snapshot the balance/weight; never accept client-calculated weight or reward.
- Recommended pilot contribution formula: `base_contribution = 0.1% * eligible_spendable_balance`; apply the existing 0/25/50/75/100% selector. Suggested caps: 1 GHC per upvote and 5 GHC per voter per Africa/Lagos day. These are proposed starting limits and must be configurable.
- Atomically debit/allocate the exact contribution from the voter and credit the content creator. The total user-available GHC must be conserved; the creator credit must be classified as redistribution/transfer, not newly earned issuance.
- A zero-percent selector may produce a free upvote with no GHC transfer. Downvote/neutral never pays a creator. No self-vote rewards. One vote/toggle/retry cannot create duplicate transfers. Any extra tip must be an explicit separate debit.
- Use per-vote/per-post weight ceilings and abuse checks to reduce whale dominance and balance-shuffling attacks. Vote weight, contribution and ledger movement should be derived in one authoritative transaction or via a reservation that prevents spend/transfer races.

## 4. Proposed pilot fees (configurable; not parity/exchange-rate promises)

| Function | Proposed GHC fee | Proposed Pi fee | Notes |
|---|---:|---:|---|
| Marketplace listing creation | 5 GHC per listing | 0.05 Pi per listing | Charge once per listing creation; edits should not charge again unless an explicitly priced promotion is selected. |
| Community creation | 50 GHC per community | 0.5 Pi per community | Charge once on successful creation; prevent duplicate charges on retries. |
| VIP upgrade | 150 GHC/month list; 1/4/8/12-month plans use approved discount schedule | Existing approved Pi price, if enabled | Current annual GHC charge is 1,440 after 20% discount; implement all four duration products before launch. |
| Curation creator contribution | 0–1 GHC per upvote under proposed cap | Not applicable | GHC is debited from the upvoter and credited to creator; this is redistribution, not issuance. |

These Pi and GHC values are independent prices for the same feature, not an implied exchange rate. Product/operator approval and Testnet usage data are required before launch. Store fees in server-side configuration/versioned catalogues; never trust client amounts. Display currency, fee, and refund policy before confirmation. A single action pays in one chosen currency only, not both.

### Marketplace inventory reservation (Phase 9 source candidate)

- New migration `202610180011_atomic_marketplace_inventory_reservation.sql` adds a buyer-scoped idempotency key and reservation state to durable orders.
- Order creation now uses a row-locking database RPC that validates current stock and inserts the order while decrementing inventory in one transaction.
- Unclaimed pending inventory holds expire after 15 minutes; expired reservations are released when durable orders are read or a new reservation is attempted. Payment is claimed atomically before GHC spend or recording a completed Pi intent; claimed reservations are excluded from automatic expiry and duplicate payment attempts are rejected. Definite GHC payment failures release the claim; ambiguous outcomes keep stock reserved pending reconciliation. Cancelling an unpaid reserved order restores inventory once. Verified payment commits the reserved stock.
- This source candidate has not been run against PostgreSQL or Testnet. Finite-stock production sales remain release-blocked until migration history is reconciled, the migration is applied to a disposable Testnet, and concurrency, expiry, payment, cancellation and idempotency tests pass.

### Payment invariants

- GHC fees use one authoritative atomic debit/spend RPC with idempotency key and durable reference. Insufficient funds fail without creating the listing/community.
- Pi fees use the established Pi payment intent and server-verified completion/callback path. Do not mark a fee paid from client success alone.
- A timeout/retry must not double-charge or create duplicate communities/listings. Failed creation after successful payment must resume safely or compensate/refund according to an explicit policy.
- Community creation fee must not imply moderation, hosting or premium entitlements that are not delivered. Define creator ownership, transfer/deletion, refunds and abuse-removal policy.
- Marketplace listing fee policy must specify whether fees are refundable for moderation rejection, seller cancellation, expiry and platform error.

## 5. Database and API implementation plan

1. Reconcile live Testnet migration history and schema before writing an additive migration. Do not apply the current Phase 6 trigger blindly.
2. Add a dedicated referral attribution table and immutable referral reward/settlement record with unique constraints for referred account and qualifying upgrade. Protect them with RLS and service-role-only settlement RPCs.
3. Amend the ledger issuance guard to allow exactly Daily Claim redemption and the dedicated referral issuance RPC. Keep all generic credit/staging routes denied. Add database metadata and reference checks so a caller cannot label arbitrary credits as referral rewards.
4. Replace the old curation minting RPC with atomic balance-funded redistribution; use a unique settlement reference and balance locks/reservations to prevent overspend.
5. Add versioned server-side fee configuration for marketplace/community creation and durable payment/fee intents. Reuse the existing Pi payment-intent model; verify the live schema before relying on it.
6. Ensure all ledger entries are append-only/auditable. Corrections are compensating entries; never silently rewrite balances or transaction history.
7. Keep referral issuance budget and Daily Claim issuance visible in internal supply reports; curation transfers and fees must not be counted as issuance.

## 6. Required tests and rollout gates

- Referral link/code generated for every registered user; attribution survives session/device changes; self-referral, attribution overwrite, duplicate accounts and repeat upgrades are rejected.
- Referral reward is exactly 5% of the canonical VIP GHC price, once, after verified settlement; test monthly/yearly plans, rounding, retries, concurrent callbacks, refunds and reversals.
- Test whether Pi-paid VIP upgrades qualify as a separately approved policy; default recommendation is no.
- Curation test 0/25/50/75/100%, low/zero/large balance, caps, self-vote, downvote, toggles, replay, concurrent votes, balance spend/transfer race, and creator payout. Prove total user GHC is conserved.
- Listing/community fees test both currencies, insufficient GHC, invalid/unverified Pi payment, duplicate callback, timeout after commit, creation failure, refund and replay.
- Prove the only positive issuance categories are Daily Claim and referral. Generic activity, admin, curation mint, purchase conversion and arbitrary ledger credits remain blocked.
- Run PostgreSQL runtime tests in a disposable Testnet project, migration reconciliation, full `ci:verify`, clean install, typecheck, lint and production build before rollout. Mainnet requires separate explicit approval.

## 7. Remaining phases

- **Phase 7:** implement this policy, referral links/rewards, balance-funded curation, canonical VIP price reconciliation and marketplace/community fees.
- **Phase 8:** security and UX integration, abuse controls, fee confirmations, referral status and creator reward history.
- **Phase 9:** reconciliation reports, observability, concurrency/performance and recovery tests.
- **Phase 10:** controlled Testnet/global beta, evidence pack, operator approval and release governance.


## Phase 7 implementation status — membership durations

Implemented in the source candidate: 1/4/8/12 paid-month VIP and VVIP options, 0/5/10/20 percent discounts for both payment rails, one bonus calendar month for every option, server-derived GHC and Pi prices, and calendar-month entitlement expiry. Pi monthly base prices are VIP 1.5 π and VVIP 3 π; the four-month, eight-month and annual products use the same discount schedule as GHC, without implying a redeemable GHC/Pi exchange rate.

Before release: resolve spend/entitlement atomicity and renewal idempotency in the database path; run typecheck, lint and production build; validate real payment completion and entitlement expiry in Testnet. Referral attribution/5% reward issuance, balance-funded curation redistribution, marketplace fees, and community creation fees remain planned and are not claimed implemented by this phase.

### Phase 7 follow-up — subscription lifecycle candidate

Implemented the four GHC subscription durations (1/4/8/12 paid months), discounts (0/5/10/20%), one bonus calendar month, server-derived pricing, and calendar-month entitlement expiry. Added an atomic membership purchase RPC migration so a GHC debit and membership entitlement write share one PostgreSQL transaction. The migration is not applied to any live environment. Pi pricing parity is now represented in the Phase 7 follow-up candidate for all four durations: VIP 1.5/5.7/10.8/14.4 Pi and VVIP 3/11.4/21.6/28.8 Pi for 1/4/8/12 paid months. The active product catalogue and Testnet fulfillment still require runtime verification.

The full production build and database-backed Testnet checks remain release gates. Referral programme, curation redistribution, marketplace listing fees, and community creation fees are still planned work and are not included in this subscription implementation.


## Phase 8 source-hardening update — 2026-10-18

The realtime transport trust-boundary pass now validates remote event names against the canonical event type allowlist, bounds the event envelope, rejects remote assertions of server-authoritative wallet/payment/reward/membership outcomes, and suppresses duplicate WebSocket connection attempts. See `PHASE_8_REALTIME_TRANSPORT_HARDENING_2026-10-18.md`. This does not replace authenticated API reads or live provider verification.

# Phase 9 — Membership foundation (0.324.0)

## Scope of this increment

Phase 9 begins with membership authority, entitlement correctness and resilient status hydration before broadening purchase UX, renewal journeys or tier merchandising.

### Implemented

- Added a strict parser for privileged membership rows. The parser binds each row to the requested authenticated user, validates tier/source/period/active fields and rejects malformed timestamps.
- Paid VIP/VVIP records must have a valid expiry unless they are explicitly complimentary (`source=comp` or `billing_period=comp`). Invalid or missing expiry can no longer silently become a perpetual paid entitlement.
- Expired or inactive paid records normalize to Free for entitlement presentation; audit history is sanitized and bounded.
- Membership database reads are bounded by an eight-second abort timeout. A timeout, malformed row, missing table or database error remains `MEMBERSHIP_STORE_UNAVAILABLE`, never a fabricated Free or paid entitlement.
- Membership status remains private and non-cacheable. Client status hydration is also abort-bounded.
- Purchase requests reject conflicting `period`/`billingPeriod` aliases and conflicting `paidMonths`/period combinations before any payment path is entered.
- Pi purchase activation still requires the authenticated owner, a durable COMPLETED/FULFILLED Pi intent, exact catalog product identity and server-calculated price. GHC price is likewise server-catalog-derived.

## Financial and entitlement boundaries

- GHC and Pi remain separate payment rails, ledgers and units; no conversion or cross-asset aggregation is introduced.
- No client-supplied amount, tier entitlement, expiry timestamp or payment status becomes authoritative.
- No payment provider, Pi SDK, ledger debit, entitlement grant RPC or migration was added or modified in this increment.
- Existing GHC purchase and Pi completed-intent flows remain the only grant paths.
- A timeout after a payment request is an uncertain transport outcome, not proof that a payment failed; users must refresh/reconcile rather than initiate a second purchase blindly.

## Verification

- Membership row parser: 14/14 runtime assertions.
- Phase 9 source contract: 18/18 checks.
- Existing consolidated static suite is run separately; the current environment still requires Node 24.15.x and installed dependencies for the full TypeScript, ESLint and Next.js build gates.
- No live Supabase, Pi Testnet/Mainnet, GHC purchase, migration application or production deployment was performed.

## Next Phase 9 increments

1. Premium membership home and tier comparison UX, with truthful benefit/eligibility states.
2. Entitlement-driven feature gating and account-switch/cross-device refresh.
3. Purchase confirmation, payment-intent lifecycle visibility and duplicate-charge-safe recovery.
4. Renewal, expiry, grace-period and cancellation lifecycle with server/database authority.
5. Membership operations, reconciliation, abuse protection and release gate.

Phase 9 remains active. This foundation increment is not production acceptance.

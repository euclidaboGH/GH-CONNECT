# Upgrade worklog — 0.330.26

## Scope

Priority 4 — Membership: coordinated plan discovery, comparison, purchase review, entitlement summary and prepaid-term management UX.

## Changes

- Comparison values and prices are derived from the canonical membership domain and shared pricing functions.
- Purchase review now shows separate, exact GHC and Pi prices for the chosen tier/duration and accurately describes one-time prepaid terms.
- Removed misleading paid-plan benefit copy and universal Free-account recovery prompts.
- Replaced the broken active same-tier “Renew” shortcut with meaningful next-step navigation while preserving the server's active-same-tier no-charge behavior.
- Current plan benefit summary is generated from the canonical plan catalog.
- Membership activity can expand to all entries in the existing bounded response; current plan management shows the server-confirmed start date and the comparison table has an accessible caption.
- Fixed refresh feedback to use the completed request result.

## Safety boundary

No membership API, SQL, migration, server catalog price, Pi payment intent contract, GHC debit RPC, entitlement gate, wallet balance, ledger, provider execution, refund or renewal authority was changed. No automatic renewal or same-tier early extension was introduced.

## Verification

The new Priority 4 transformation contract passed 20/20. The consolidated `npm run verify:static` suite passed 57/57. Existing membership gates passed: release 16/16; Pi intent security 19/19; consumer audit 8/8; experience 23/23; strict intent contract 12/12; renewal policy 15/15; session safety 15/15; foundation 20/20; row parser 14/14.

Source-level verification only; Node.js 24.15.0 dependency-backed build/type/lint, browser/device, database and Testnet/operator acceptance remain required. Production is NOT APPROVED.

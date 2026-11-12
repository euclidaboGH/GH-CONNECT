# Priority 4 — Membership completion increment (0.330.27)

Date: 2026-11-07

## Coordinated product upgrades

- Membership comparison now has accessible category filters (Plan & value, Discovery & matching, Growth & earnings, Profile, Wallet & commerce, Communities, Creator & business, Support) while retaining the canonical tier catalog and selected-term pricing source.
- The active membership card now shows a server-derived remaining-days estimate and reiterates the non-recurring prepaid policy. It does not create a countdown timer or imply grace access.
- Purchase review now discloses each rail's catalog list price, duration discount and exact charge, plus the paid term and bonus month. Pi and GHC remain independent prices.
- Purchase actions are disabled until authenticated server membership status is authoritative and while offline.
- The source label now distinguishes verified Pi, GHC, external payment, admin grant and trial instead of incorrectly describing every external/verified-payment source as Pi.
- VVIP members cannot select a VIP downgrade; VIP members can still explore the VVIP upgrade. Free remains available as the baseline plan.

## Membership downgrade protection

- The membership activation API rejects an active VVIP-to-VIP purchase before GHC debit/activation.
- Pi intent creation rejects non-canonical membership product IDs and active VVIP-to-VIP requests before a provider payment is started.
- The verified Pi payment-completion grant path independently rejects an active VVIP-to-VIP grant.
- A new additive database trigger migration, `20261107160001_membership_active_tier_downgrade_guard.sql`, rejects the same downgrade at the entitlement-row boundary, including direct RPC and concurrent update paths. It allows VVIP upgrades, expiry, revocation and expired-entitlement replacement.
- The migration is explicitly `REVIEW_REQUIRED`; it has not been applied. Reconcile Testnet and Mainnet migration histories and validate on disposable PostgreSQL before any deployment.

## Authority and safety

- No price catalog, Pi provider flow, GHC ledger, payment completion, refund, entitlement grant, renewal schedule or recurring billing policy was changed.
- No migrations were applied and no financial transactions were executed.
- Existing active same-tier no-charge behavior and 72-hour continuity-only renewal policy remain intact.

## Verification boundary

The dedicated Priority 4 source contract passes **31/31** checks and covers plan comparison filters, term pricing, remaining-term display, payment-source attribution, fail-closed purchase availability, downgrade rejection in UI/API/Pi completion and the review-gated database trigger. Static/source tests are not a substitute for Node 24.15.x dependency-backed typecheck, lint, production build, disposable PostgreSQL migration testing, Pi Browser/Android acceptance, Testnet payment journeys or operator verification. Production remains NOT APPROVED until those gates pass.

Priority 5 Profile remains untouched.

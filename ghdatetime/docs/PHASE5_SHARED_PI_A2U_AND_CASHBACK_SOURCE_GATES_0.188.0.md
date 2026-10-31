# Phase 5 — Shared Pi A2U lane and cashback source gates (0.188.0)

## Scope

Phase 5 closes a cross-domain execution gap discovered during the Phase 1–4 audit: general PI earnings withdrawals had a dedicated `gh_pi_a2u_execution_lane`, while seller marketplace and cashback payments used `gh_pi_a2u_sequence_lease`. Pi app-wallet sequence coordination must be global across all A2U domains.

## Changes

- General earnings begin, heartbeat, provider-payment binding and end RPCs now lock and validate `gh_pi_a2u_sequence_lease` as the shared global mutex.
- Earnings lease owners use `earnings:<request UUID>` to avoid collisions with seller payout IDs and cashback payout IDs.
- RPCs use a consistent shared-lane-first lock order and service-role-only grants.
- Cashback source eligibility is now explicit and fail-closed. Only `marketplace_fee` is enabled because it is the only source with an audited authenticated payer and verified PI company-revenue producer in this source tree.
- Membership, promotion, digital service, creator tip, refund and chargeback event types remain valid journal types but are marked pending for cashback until source settlement, payer attribution, net revenue and compensation flows are wired and verified.

## Safety boundaries

- No client-side balance, recipient, amount or provider receipt authority.
- Existing independent Pi receipt verification and database settlement checks remain mandatory.
- Uncertain provider outcomes retain reservations.
- Testnet only; Mainnet remains disabled.
- The old earnings-only lane table remains present for compatibility/inventory but is no longer the serialization authority.

## Required operator validation

1. Apply all dependent migrations only to a disposable PostgreSQL database after reviewing target migration history.
2. Run concurrent seller, cashback and general-earnings begin calls; exactly one must acquire the shared lease.
3. Verify an expired lease can be reclaimed, a replaced token cannot heartbeat/bind/end, and an old worker cannot clear a newer owner's lease.
4. Verify paid duplicate requests do not reserve the global lane.
5. Verify provider payment creation/submission remains Testnet-only and independent receipt verification is required before settlement.
6. Run Node.js 24.15.0 typecheck, lint, production build and browser E2E.

This migration is `REVIEW_REQUIRED`. Static source checks are not proof of PostgreSQL mutual exclusion or a live Pi Testnet transfer.

# GreenHaven GHC Economy and Fees Roadmap

## Policy

GHC is an internal GreenHaven utility balance. It is not a promised cash value, market price, investment, or automatic claim on Pi. Pi payments and GHC ledger movements are separate and must be reconciled independently.

## Membership pricing invariant

The current source catalog defines VIP at 150 GHC per month and VVIP at 300 GHC per month. Longer plans apply the catalog discounts. The yearly plan includes **one bonus month of membership** in access duration; this is a duration benefit, not additional wallet credit. The 12-month VIP discount yields **1,440 GHC** and VVIP yields **2,880 GHC** at the current catalog values.

The existing test suite references 72 GHC as a historical/illustrative fee value. Do not treat that number as a new fee, a live price, or a replacement for the canonical pricing catalog without explicit product approval. Server pricing is authoritative; UI values must be derived from the same reviewed catalog.

## Monetization order

1. Validate paid business profiles/promotions with a small pilot.
2. Enable only existing membership and marketplace products that have durable orders and server-verified payment completion.
3. Measure provider fees, refunds, seller obligations and net contribution.
4. Add further GHC spending utilities only with clear user value and capped economic exposure.
5. Keep Pi-funded GHC acquisition and any GHC-to-Pi redemption disabled pending separate product, platform, legal and funding approval.

## Controls

- Never credit GHC from client-submitted amounts or a browser success redirect.
- Keep payment callbacks and ledger operations idempotent.
- Do not treat GHC spent in-app as company cash revenue.
- Do not alter reward issuance merely to create scarcity or promise appreciation.
- Do not enable withdrawals without a verified funded settlement path and independent release approval.

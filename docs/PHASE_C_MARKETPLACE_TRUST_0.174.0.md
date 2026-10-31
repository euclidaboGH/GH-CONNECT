> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase C — Marketplace trust (0.174.0)

## Goal
Professional trust signals: delivery clarity, seller reputation, reports, completed-order reviews.

## Delivered
- `lib/marketplace/trust.ts` — delivery modes, rating format, local report queue
- Listing cards show delivery/location line
- Detail: Delivery section + seller rating/reviews + Report listing
- Sell form: delivery mode (meetup / shipping / digital / service) + notes → `shippingInfo`
- Orders: **Leave review** after `completed` (domain enforces buyer + completed only)
- Saved listings tab retained

## Honesty
Listing reports are **queued locally** for operator review until a durable report API is wired. Reviews use existing domain rules (no self-review, completed only).

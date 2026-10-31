# Phase B — Marketplace core commerce depth (0.172.0)

## Goal
Buyer/seller order hub with visible lifecycle, durable actions, and better browse sort — not a brochure grid.

## Delivered
- `lib/marketplace/order-lifecycle.ts` — step index + sort helpers
- Orders tab: **All / Buying / Selling** filters
- Per-order **progress stepper** (Created → Paid → Fulfilling → Delivered → Complete)
- Payment + delivery status line
- Message → order conversation deep link (existing API)
- Existing commerce actions retained (pay, fulfill, mark delivered, confirm, dispute)
- Browse: **Newest / Price low–high / Price high–low**

## Server authority
Transitions still go through `/api/marketplace/orders/.../commerce` — UI does not invent paid/complete states.

# Phase 30 — Wallet, GH Spend, and Payment UX Reliability

## Scope

Audit wallet shortcuts and utility spend UX against the v0.91.1 source baseline, with changes shipped as v0.91.2.

## Findings and changes

- The wallet's `Boost 25 GHC` quick chip attempted to call `purchaseBoost` through a dynamic domain cast, but no implementation exists in the inspected source. It silently returned when missing. The chip now opens the real Spend GHC panel.
- Spend GHC had no explicit review step and generated a new timestamp-based idempotency key on every attempt. A retry after a timeout could therefore become a distinct spend request. A confirmation step is added and a per-purpose/target key is retained until a confirmed success.
- The utility endpoint previously fell back to a minute-bucket reference when no idempotency key was supplied. This could merge separate legitimate actions or fail to correlate a retry. The endpoint now requires a valid client request key and namespaces its hash by authenticated user and purpose.
- Target-bound boosts validate target presence before review. Catalog loading has an explicit error state and retry control.
- All utility activation effects remain fail-closed while durable entitlement/boost activation and ranking consumption are not configured. Catalog entries must remain unavailable until the server-side activation transaction and downstream effect are implemented together. This intentionally avoids charging GHC for an effect the system cannot guarantee.

## Security and economy posture

- Price and amount continue to be resolved from the server catalog. Client-provided amount/balance/user fields are ignored.
- Server authentication, rate limiting, durable ledger spend, and no-memory-fallback deployment posture remain unchanged.
- This pass does not enable new economy effects, mint GHC, change Pi authentication, or alter transfer settlement.
- Existing wallet state continues to distinguish available, pending, and locked/escrow amounts.

## Research applied

OWASP Payment Functionality Testing and Business Logic Security guidance informed idempotency, server-authoritative pricing, atomic ledger operations, explicit workflow states, and fail-closed handling. Stripe's idempotency guidance supports reusing the same key for retries of the same action. See:

- https://wstg.org/latest/4-Web_Application_Security_Testing/10-Business_Logic/10-Payment_Functionality/
- https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- https://docs.stripe.com/api/idempotent_requests

## Validation boundary

The added regression contract checks source-level wiring, retry keys, required target, server-side catalog price, and unavailable-effect guards. Static checks are not a substitute for the Node 24 TypeScript/Next.js production build, database migration verification, or live multi-account testnet transfer/payment tests.

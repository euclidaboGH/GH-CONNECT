# GreenHaven API Route Security Inventory — v0.150.1

Date: 2026-10-27  
Scope: static source inventory of `app/api/**/route.ts`; this is triage evidence, not a certification of endpoint security.

## Inventory snapshot

The current tree contains 193 API route handlers. Static searches found:

- 151 route files reference `resolveAuthenticatedUser`.
- 83 route files use `request.json()`.
- 5 route files use `request.text()`.
- 82 route files reference the shared in-process `checkRateLimit` helper.

These counts overlap and are not pass/fail totals. Some routes are intentionally public, some use dedicated operator keys, signed webhooks, or other authentication helpers, and route-local authorization can be implemented through imported functions or database RPCs. A full review must trace each route's identity, ownership checks, downstream database permissions, and failure behavior.

## Priority review queues

### P0 — privileged financial operations

- `app/api/payments/intents/route.ts`
- `app/api/economy/transfers/route.ts`
- `app/api/marketplace/payouts/[requestId]/reconcile/route.ts`
- `app/api/marketplace/payouts/[requestId]/transition/route.ts`
- `app/api/marketplace/payouts/[requestId]/transition-bank/route.ts`
- `app/api/marketplace/payouts/[requestId]/resolve-bank-exception/route.ts`
- `app/api/admin/creator-rewards/fund/route.ts`
- `app/api/admin/creator-rewards/settle/route.ts`

Review criteria: server-owned amounts and recipients, strong operator authentication, idempotency, bounded request parsing, rate limiting, durable audit trails, concurrency safety, and explicit separation of PI, GHC, and bank rails. No financial logic should be changed without tests and an approved compatibility plan.

### P1 — identity and access boundaries

- `app/api/auth/pi/route.ts`
- `app/api/verification/review/route.ts`
- `app/api/governance/reports/route.ts`
- `app/api/governance/moderation-log/route.ts`
- `app/api/media/route.ts`
- `app/api/media/health/route.ts`
- `app/api/system/status/route.ts`

Review criteria: session and identity binding, resource ownership, least privilege, data minimization, safe errors, cache controls, rate limits, and no leakage of service credentials or internal diagnostics.

### P1 — media and messaging

Audit all upload/signing routes, storage bucket policies, signed URL lifetimes, attachment download authorization, message recipient checks, notification fan-out, and delete/update paths. The route handler alone is insufficient evidence; inspect the corresponding Supabase RLS policies, storage policies, and SQL RPCs.

## Changes in this batch

The GHC transfer route now checks declared and actual request-body length before JSON decoding (16 KiB cap), rejects arrays and non-object JSON bodies, bounds reference/request identifiers, and strips control characters from transfer notes. Existing authentication, recent step-up requirement, per-user rate limiting, public-directory recipient resolution, server-side amount validation, and authoritative RPC path are preserved.

A regression contract in `scripts/check-transfer-request-hardening.mjs` verifies those safeguards. It is intentionally a source contract and does not replace integration tests or SQL concurrency tests.

## Required evidence before launch

- Per-route authorization matrix with expected anonymous/user/operator behavior.
- Tests for horizontal privilege escalation and cross-user object access.
- RLS and storage policy review against the actual applied database state.
- Webhook signature and replay tests.
- Concurrent duplicate payment/transfer tests against staging database constraints and RPCs.
- Request size, rate-limit and abuse tests across multiple application instances.
- Staging verification under supported Node.js `^24.15.0`, including build, browser journeys and rollback rehearsal.

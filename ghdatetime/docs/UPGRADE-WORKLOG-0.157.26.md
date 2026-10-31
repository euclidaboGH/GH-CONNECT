# GreenHaven v0.157.26 upgrade worklog

## Scope

Harden the boundary between a completed marketplace Pi payment and the separate company revenue/cashback journal append. The two operations can fail independently; a journal outage must not make the buyer repeat an already-completed payment or make the API imply reconciliation completed.

## Changes

- `app/api/marketplace/orders/[orderId]/pay/route.ts` now marks commission/revenue reconciliation failures explicitly. The response says payment is verified, no new payment action is required, and retry is safe.
- Added `Cache-Control: no-store` and `Retry-After: 5` on retryable reconciliation responses.
- Added a five-second timeout per upstream revenue-journal attempt so a stalled Supabase RPC cannot leave reconciliation hanging indefinitely.
- Recovery revalidates the original completed Pi intent against authenticated user, provider, purpose, order reference and amount, then reuses the idempotent revenue event key.
- Recovery repairs interrupted order-state transitions only through the existing transition function; disallowed terminal-state changes are surfaced for operator reconciliation rather than silently overwritten.
- Added `scripts/check-marketplace-revenue-reconciliation.mjs` and registered it in prebuild/static verification.

## Safety and limits

This is a source-level recovery improvement, not a provider payment, payout, refund, or live database change. The revenue append remains idempotency-keyed; no new Pi payment is submitted by recovery. A journal append that failed because of a permanent validation or schema error remains pending and needs diagnosis; retryability does not guarantee the underlying fault will resolve.

## Verification status

Focused contract and project static checks are run against this archive. The environment is Node.js 22.16.0 while the project requires Node.js 24.15.0+; dependencies are not installed. Full TypeScript, lint, Next.js build, real PostgreSQL migration tests, Supabase migration-history reconciliation, Pi Testnet flows, and browser journeys remain unverified release gates. No migrations were applied and no Vercel/Supabase settings were changed.

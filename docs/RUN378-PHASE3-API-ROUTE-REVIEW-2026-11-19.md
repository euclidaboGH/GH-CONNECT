# RUN378 — Phase 3 API route and service-boundary audit

**Source:** GreenHaven 0.338.103 RUN376–RUN377 derivative. **Outcome:** source-level route inventory and ownership coverage completed; live operator and provider verification remains separate.

## Inventory

- 280 `app/api/**/route.ts` files and 368 exported HTTP method declarations.
- 186 mutating route files; all 186 have exactly one declared domain owner in `lib/architecture/domain-mutation-route-owners.json`.
- 55 route files contain direct `fetch` calls (90 direct call sites). Each direct fetch call was scanned for a request `AbortSignal`; 90/90 were bounded. The new route deadlines use 10 seconds; existing provider/storage operations retain their reviewed shorter/longer bounds.
- 176/186 mutating routes have durable rate limiting. Two public analytics/vitals ingestion endpoints retain process-local per-IP throttles because they are telemetry-only and privacy-minimized. Eight exceptions are documented: disabled legacy ledger credit; the opt-in earnings process wrapper whose worker independently enforces session/ownership/lease/idempotency; the CRON-secret stale-hold reaper; two Field routes blocked by RUN372 middleware; HMAC-authenticated scanner callback; retired calling endpoint; and signature/idempotency-protected Paystack webhook retries.
- 45 routes do not match the ordinary session-auth source marker. Every one has an explicit access classification and rationale in `RUN378-API-ACCESS-CLASSIFICATION-2026-11-19.json`. These include Pi auth bootstrap, cookie session control, public read/quote/health endpoints, operator-key routes, signed scanner/webhook callbacks, middleware-blocked Field/Research routes and the retired calling endpoint. This classification is an auditable source contract, not a claim that every route has user-session auth.

## Cross-service boundaries

- The shared Supabase REST/RPC client remains the canonical helper under `lib/server/supabase/rest-client.ts`; the Phase 4 Supabase-client contract reports zero raw `/rest/v1/` URL references under `lib/`.
- Route-level Supabase/storage/provider calls retain explicit abort deadlines and bounded request/response contracts where implemented.
- Optional provider isolation remains fail-contained: unreleased providers are not loaded and provider failure does not block core flows.
- The ecosystem directory remains 42 services / 10 categories: 11 Active, 30 Coming Soon and 1 Unavailable (Field Research). Coming Soon destinations remain non-interactive; Field/Research APIs are intercepted before their handlers.

## Limits

Static route ownership, timeout markers and access classifications do not prove deployed database ACLs, provider uptime, rate-limit table availability, multi-instance behavior or browser session correctness. The 45-route matrix must be revisited when route access semantics change. The eight explicit no-rate exceptions must remain disabled, worker-protected, signed/idempotent or middleware-blocked as documented.

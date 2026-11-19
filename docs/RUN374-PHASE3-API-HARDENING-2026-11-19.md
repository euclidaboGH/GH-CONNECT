# RUN374 — Phase 3 API hardening

**Date:** 2026-11-19  
**Baseline:** `GREENHAVEN-0_338_101-RUN372-FIELD-RESEARCH-DISCONNECTED-2026-11-19.zip` plus RUN373 source changes  
**Package:** `gh-connect@0.338.102`  
**Scope:** Targeted hardening of authenticated post editing, operator announcement publishing, and internal GHPV settlement authorization.

## Findings and fixes

1. `POST/PATCH /api/social/posts/[id]/edit` authenticated the user and enforced ownership, but did not apply a durable per-user write limit and its two direct Supabase requests had no explicit deadline. Added a fail-closed durable limit of 20 edits per user per minute, a 10-second deadline on lookup and update, and stable no-store 503 responses for upstream/network failures. Existing ownership filters, bounded request body, media validation, and server-side write path remain intact.
2. `POST /api/system/announcements` compared the announcement admin header and environment secret with direct string equality. Replaced this with the shared `operatorKeyAuthorized` verifier, a dedicated header/env pair, the shared 32-byte minimum, and constant-time digest comparison. Added durable operator-wide publishing throttling (10/minute) and per-user read-state throttling (60/minute). The shared Supabase helper now applies a 10-second deadline to all announcement reads/writes.
3. `POST /api/social/posts/[id]/ghpv/settle` used a bespoke 16-character secret check. Replaced it with the shared operator-key verifier and 32-byte minimum. It remains a system-only operation, not a user vote action, and does not mint GHC.
4. Updated stale source checks to assert the central shared operator-key helper and the central Supabase RPC timeout contract actually used by the implementation. No runtime behavior was weakened to satisfy old source-pattern assertions.
5. Added and registered `scripts/check-run374-api-hardening.mjs` in prebuild, static verification, pretypecheck and prelint.

## Remaining routes without an explicit rate-limit reference

The inventory now reports 18 mutating route files without a direct rate-limit reference. These are not a uniform set of user-facing writes: the remaining list includes operator-key protected treasury/A2U operations, disabled Field Research routes blocked by middleware, a retired call-intent endpoint returning 410, internal evidence callback authorization, internal GHPV settlement protected by the shared operator key, verification review protected by a dedicated secret, and the signed Paystack webhook with provider event binding/idempotency. These must continue to be reviewed by trust boundary and retry semantics; a blanket limiter would risk breaking provider retries or scheduled operator workflows. User-facing social post editing and announcement writes were removed from this gap list by RUN374.

## Verification

- RUN374 API hardening: 14/14 PASS.
- Admin secret/body hardening: 8/8 PASS after aligning the test with the shared helper.
- Economy RPC deadlines: 12/12 PASS after aligning the test with the centralized `supabaseRpc` timeout contract.
- Core Web Vitals/performance source checks: 17/17 PASS.
- Phase 4 identity/authentication source checks: 16/16 PASS.
- Mutating-route rate-limit inventory: 167 references, 18 remaining restricted/disabled/provider routes without a direct rate-limit reference; informational inventory only.

## Limits and release status

The 280 API handlers have not all been exercised end-to-end. These are source-level changes and regression checks, not proof of live runtime behavior. Node 24 dependency-backed typecheck/lint/build, authenticated two-account testing, Pi Browser authentication, and live provider/database verification remain outstanding. No live Supabase schema/data changes, migration-history repair, GitHub push, Vercel deployment, or Mainnet action was performed.

**Release decision remains: NOT APPROVED.**

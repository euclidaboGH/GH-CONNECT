# GH-CONNECT 0.326.0 — Phase 9 Membership worklog

## Source baseline

- Exact starting archive: `GH-CONNECT-0.325.0-PHASE9-MEMBERSHIP-SESSION-INTEGRITY-UPGRADE.zip`.
- Product milestone: Phase 9 Membership. The user's requested workstreams were interpreted as Phase 9 because they explicitly concern Membership Home, entitlements, purchase recovery, renewal and membership lifecycle; Phase 8 Rewards remains source-closed in 0.323.0.

## Implemented

1. Premium Membership Home status presentation now uses only authoritative server status, not the browser cache. Added account-scoped read-only lifecycle activity and clear prepaid/no-auto-renew messaging.
2. Added server-authoritative membership tier access helper and enforced `requiresTier` on the premium messaging purchase route before any GHC debit.
3. Hardened the operator renewal workflow: load the durable intent, bind its owner, require completed/fulfilled Pi intent, exact canonical product ID and expected catalog amount. Request-body duration and billing period are no longer accepted as authority.
4. Added SQL renewal hardening: provider/currency/purpose/product/amount checks, catalog-derived calendar duration including one bonus month, idempotency, serialized renewal, and a 72-hour continuity-only boundary that never grants access during a gap.
5. Added authenticated read-only lifecycle history API and operator-key-protected bounded expiry sweep endpoint.
6. Added regression checks and runtime policy tests; registered them in `prebuild` and `verify:static`.
7. Updated release metadata, roadmap, project truth, source-of-truth, docs and migration inventory.

## Verification

This is a source-only engineering increment; verification does not imply live production acceptance.

- Phase 9 membership release gate: 14/14.
- Phase 9 membership experience static contract: 23/23.
- Renewal policy runtime assertions: 15/15.
- Existing membership session safety, membership foundation and parser tests are still part of the consolidated gates.
- Consolidated `npm run verify:static`: **57/57 passed**.
- Repository consistency: 6/6; project truth: 10/10; documentation hygiene: passed.
- Migration inventory: 188/188 synchronized — 117 REQUIRED, 68 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL. The new migration is `REVIEW_REQUIRED`.
- `npm run typecheck`, `npm run lint` and `npm run prebuild` were blocked by the Node runtime preflight: available Node `22.16.0`, required `24.15.0`. No dependency-backed typecheck/lint/production build was certified.

## Not run / not approved

- Environment Node runtime remains `22.16.0`; project requires Node `24.15.0` or compatible Node 24. Node 24.15.0 dependency-backed typecheck/lint/build gates remain pending.
- Dependencies are not installed in this workspace; full typecheck, ESLint and Next.js production build were not certified.
- No PostgreSQL client/disposable database or connected Supabase Testnet was available for SQL execution, locking, ACL or trigger tests.
- No browser/device, accessibility, performance, real Pi payment, GHC debit, refund, expiry operator call or Mainnet operation was performed.
- Migration `20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql` remains unapplied and requires operator review.

## Financial invariants

- GHC and Pi remain separate rails and ledgers.
- GHC purchase remains an atomic server-side debit-plus-entitlement path.
- Pi entitlement requires a durable completed/fulfilled, owner-bound, catalog-matched intent.
- Browser caches and payment success screens never grant access.
- The 72-hour renewal continuity rule preserves term alignment only; premium access pauses at expiry.
- No recurring billing, automatic renewal, refund or Mainnet authority was introduced.

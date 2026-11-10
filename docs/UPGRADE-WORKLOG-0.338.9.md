# Upgrade worklog — 0.338.9 (2026-11-09)

## Scope

- Refined shared expanded/compact headers to a slimmer 36px control rhythm and made hidden duplicate header actions inert.
- Improved Marketplace browse/detail header consistency, responsive content gutters and bottom safe-area clearance.
- Improved Community directory spacing while preserving its bounded reading column and touch-scroll behavior.
- Replaced brittle inline-style matching for active-tab scroll reset with stable tab-panel IDs and computed scroll-owner detection.
- Hardened `/` and `c` shortcuts against editable controls, modals, IME composition, modifier/repeat/default-prevented events.
- Added 31-check independent UI/navigation/responsive audit and registered it in prebuild and static verification.
- Reconciled executable release checks with the actual 0.338.8 durable rate-limit changes and the shared follow-ID sanitizer; the sanitizer now rejects non-string IDs rather than coercing arbitrary JSON values.
- Corrected security-header checks to accept HSTS max-age values of at least one year; the deployed source configuration uses two years with `includeSubDomains`. Updated `.env.example` placeholder validation to permit explicit boolean/numeric non-secret flags.

## Verification

This worklog records source-only verification, not live production acceptance.

- UI/navigation/responsive audit: 31/31; strict social target-ID sanitizer runtime tests: 10/10.
- Marketplace/community API audit: 42/42 (22 Marketplace, 20 Community).
- Phase 2 design-system/adaptive-shell: 15/15.
- Pass 48 accessible navigation: PASS.
- Security audit: 34/34.
- Project truth: 10/10.
- Repository consistency: 6/6, 1,445 files scanned, zero unresolved imports.
- Migration manifest: 198/198; SQL lexical integrity: 198 migrations.
- Financial regressions: Phase 10 marketplace integrity 30/30; Phase B commerce 9/9; Phase C trust 13/13; Phase D communities 9/9; wallet security 11/11; unified earnings ledger 20/20; wallet authorization 27/27; Pi cashback ledger 23/23; payout durable-limits gate covers 21 route modules; marketplace revenue reconciliation 10/10; marketplace resilience 12/12; marketplace domain boundary 14/14.
- `npm run verify:static` was attempted. Its first run found stale source-contract assertions/documentation; those were updated in this increment and the complete suite must be rerun for a final result.
- `npm run typecheck` was attempted and is BLOCKED by the environment: Node `v22.16.0` is available but the project requires Node 24.15.0 (`^24.15.0`). No Node 24 binary or complete `node_modules` tree is present.

## Safety boundary

No SQL migration was added or applied. No live Supabase, Pi/GHC provider, balance, order, inventory, refund, payout or production state was changed. Browser/device visual acceptance, Node 24.15.0 typecheck/lint/build, PostgreSQL/RLS and Testnet concurrency/idempotency remain outstanding. Production remains NOT APPROVED.

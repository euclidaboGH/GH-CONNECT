# Release gate — GH-CONNECT 0.62.2 / Phase 22

**Status: NOT CLEARED FOR PRODUCTION DEPLOYMENT.** This release contains additional bank-payout adapter source but has not passed the full environment-dependent release gate.

## Completed locally

- Paystack adapter source and 38 static source assertions.
- Additive migration source, read-only preflight, post-migration privilege assertions and concurrency test plan.
- GHC/PI-to-NGN conversion explicitly excluded; NGN payout requests require a separately funded, verified NGN obligation.
- Bank transfers remain disabled by default and live transfers require explicit approval.

## Blocking gates

1. **Dependency lock:** `package.json` declares `pi-backend@0.1.3`, but `package-lock.json` has no resolved `node_modules/pi-backend` package graph. Registry access failed with DNS `EAI_AGAIN`; do not bypass or delete the lockfile.
2. **Supported runtime:** this workspace has Node 22.16.0 and npm 10.9.2; the repository requires Node `^22.22.2 || ^24.15.0`.
3. **Build gate:** run on a registry-connected supported runtime:
   ```bash
   npm install --package-lock-only --legacy-peer-deps
   npm ci --legacy-peer-deps
   npm run typecheck
   npm run lint
   npm run ci:verify
   npm run build
   ```
4. **Database:** run `supabase/phase22_readonly_preflight.sql` and `supabase/phase20_ghc_treasury_readonly_preflight.sql`; inspect actual migration history and target schema; apply migration 008 only in a disposable project first; run `supabase/tests/PHASE22_POST_MIGRATION_ASSERTIONS.sql` and the Phase 22 test plan. Do not apply to production directly.
5. **Provider:** configure Paystack Test Mode credentials and webhook URL; validate beneficiary registration, signature rejection, duplicate events, ambiguous timeouts, success/failure/reversal, and reconciliation. No transfer has been tested in this workspace.
6. **Funding:** integrate and audit the upstream NGN revenue/settlement source before any NGN obligation can be created. Existing GHC/PI orders are not valid NGN funding evidence.
7. **Pi A2U and GHC:** independently complete Pi Testnet end-to-end tests and GHC treasury/concurrency tests from the Phase 20 plan. Bank adapter checks do not certify those rails.

Do not push a release candidate as production-cleared until every blocking gate has recorded evidence. Do not set `PAYSTACK_TRANSFERS_ENABLED=true`, `PAYSTACK_LIVE_TRANSFERS_APPROVED=true`, `PI_A2U_ENABLED=true`, or GHC payout flags just to test UI behavior.

# GREENHAVEN financial integrity and security audit — 2026-11-09

**Baseline:** `0.338.7`  
**Scope:** wallet, Pi/GHC asset separation, earnings ledger, payout reservations, PIN/recovery, payment intents, marketplace settlement boundaries, financial API authorization/rate limits, migration integrity and project-wide wiring.  
**Decision:** source-level improvements completed; **NOT APPROVED for production** pending Node 24.15.0 dependency-backed typecheck/build, PostgreSQL validation, remote migration-history reconciliation, provider/Testnet and browser/device acceptance.

## Defect fixed in this audit

- Corrected an unterminated SQL string in the final `COMMENT ON FUNCTION` statement of `20261108150001_repair_pin_storage_and_payout_release.sql`. The previous text left the SQL statement open, so applying the migration would fail at parse time. The comment is now correctly terminated. The migration remains `REVIEW_REQUIRED`; this repair does not authorize applying it.
- Regenerated `VERIFIED_MANIFEST.txt` and `MIGRATION-SOURCE-MANIFEST.csv` from the canonical migration directory so the changed SQL byte count is reflected accurately. The canonical inventory remains 198 migrations.
- Added `scripts/check-sql-lexical-integrity.mjs` to scan every canonical migration for unterminated strings/comments/dollar-quoted bodies and unbalanced parentheses. Registered it in both `prebuild` and `verify:static`.
- Clarified in `.env.example` that `PI_NETWORK` must be explicitly set in deployment. It remains blank in the template so an omitted network does not silently select Mainnet or another payment environment.
- Reconciled current release and migration-count documentation with executable package/lockfile metadata and the canonical 198-migration inventory.

## Financial invariants reviewed

- Pi and GHC are independent assets, payment rails and ledgers; they are never summed or silently converted.
- Balances are derived from server-authoritative ledger records; browser/local state is not financial authority.
- Monetary values use bounded atomic/integer representations; client-supplied balances are not accepted as write authority.
- Reserve, settle and release operations are serialized, idempotent and payload-bound; settlement requires a matching reservation.
- Unstarted Pi Testnet payout reservations may be released only when no provider payment/txid exists, execution has not started, no lease exists and attempts are zero. Processing/uncertain payouts remain held pending authoritative provider reconciliation.
- Withdrawal PIN verification is server-issued, bound to the user and idempotency key, expires, rate-limits attempts atomically and fails closed without required secrets.
- Privileged payout/A2U routes use shared operator-key verification; financial mutations use durable fail-closed throttling and bounded request parsing.
- Marketplace order payment and payout flows retain server/database settlement authority; UI/cart/listing cache cannot establish payment or inventory authority.

## Source-level verification evidence

- Wallet security hardening: **11/11**.
- Unified earnings ledger: **20/20**.
- Wallet release gate: **17/17**.
- Wallet ledger resilience: **17/17**.
- 2026-11-09 security audit: **34/34**.
- Repository consistency: **6/6**.
- Project truth: **10/10**.
- Phase 23 migration integrity: **198 migrations; 418 SECURITY DEFINER definitions checked for fixed `search_path`**.
- Phase 24 release review: **PASS**.
- Migration source manifest: **198/198 synchronized**.
- SQL lexical integrity: **198 migrations scanned; no unterminated strings/comments/dollar quotes or unbalanced parentheses**.
- Financial source regression checks for transfers, payment intents, payout durable limits, wallet A2U readiness, and payment recovery passed in the local Node 22 environment where supported.

These are source/static contracts, not PostgreSQL parser or execution evidence. SQL lexical scanning is intentionally not represented as full SQL validation.

## Outstanding blockers and operational safeguards

1. The available runtime was Node `22.16.0`; the project requires `24.15.0`. `npm run typecheck` correctly stopped at its runtime precheck. A direct global `tsc --noEmit` attempt could not resolve installed type definitions because dependency installation did not complete.
2. `npm ci --legacy-peer-deps` did not complete within the available execution window. No dependency-backed typecheck, lint or production build is claimed.
3. All 198 migrations are repository source, not proof of applied database state. The generated inventory classifies **77** as `REVIEW_REQUIRED`; never bulk-apply or run `supabase db push` until target history and every pending migration have been reconciled and approved.
4. Run the repaired PIN/payout migration on a disposable PostgreSQL database first, then Testnet. Verify table/FK compatibility, grants, function signatures, concurrent PIN attempts, reservation/request reconciliation and rollback behavior.
5. Reconcile each affected user's Pi payout request rows, earnings ledger entries and provider payment state before any manual release. Never manually credit or release a reservation based only on a UI balance or a timeout.
6. Complete concurrent/idempotency tests for GHC spend, Pi payment completion/recovery, marketplace payment, cashback, membership purchase and payout worker fencing against PostgreSQL and Pi Testnet.
7. Verify environment secrets and flags in Vercel; keep payout execution/A2U disabled until provider and operator gates pass. Rotate operator credentials as specified in `docs/SECURITY-AUDIT-0.338.6.md`.
8. Complete authenticated two-account browser/mobile tests, especially PIN setup/recovery, wallet refresh/account switching, claim retry, payout cancellation and marketplace checkout recovery.

**No live user balances, ledger entries, payout requests, provider transactions or remote database schemas were changed by this audit. No migration was applied and no payout/payment was executed.**

# GH-CONNECT five-phase recovery — Phase 1
**Audit date:** 2026-11-01.

**Baseline:** GH-CONNECT `0.274.3` from the Phase 3 release-readiness archive.  
**Phase:** 1 of 5 — source truth, consolidated migrations, and earned-Pi withdrawal path.  
**Status:** Source-level work and static contracts passed; deployment/database/provider proof remains outstanding.

## 1. One canonical migration source document

The authoritative migration count is **175 individual canonical migration files** in `supabase/migrations/`.

- `REQUIRED`: 115
- `REQUIRES_APPROVAL`: 1
- `PROPOSAL`: 2
- `REVIEW_REQUIRED`: 57

A new file, `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql`, consolidates the complete contents of all 175 sources in one searchable/reviewable document. Every source section contains its original filename, classification, byte count, and SHA-256. `scripts/check-migration-master-bundle.mjs` reconstructs the expected bundle from the canonical sources and verifies byte-for-byte equality. The check is registered in `verify:static` and `prebuild`.

The migration counts are now explicitly distinguished:

- **175** = canonical, individually versioned migration sources.
- **1** = consolidated review-only bundle containing those same 175 sources; it is not another migration.
- **12** = pre-existing operator, validation, install, reset, or backfill SQL assets, not canonical migrations.
- **188** = total `.sql` files in the repository after adding the bundle (175 + 12 + 1); this is not the migration count.

Historical software version labels such as `0.184.0` and `0.187.0` are version labels, not migration counts.

**Safety:** The bundle is explicitly not an executable monolithic installer. Do not run it as one script and do not use it to bypass Supabase history reconciliation. Review and apply the original migration files individually, after independently reconciling Testnet and Mainnet histories. The existing `supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` remains stale and must not be used; `supabase/RESET-GREENHAVEN-DATABASE.sql` remains destructive.

## 2. Earned-Pi withdrawal defect and changes

### Confirmed source defects

1. The withdrawal request endpoint created a durable reservation but never dispatched the existing execution worker. Its response also hard-coded a message saying execution was disabled even when deployment gates might have been configured.
2. The execution route required both a user session and an operator secret, making it unsuitable for a trusted server-to-server dispatch after the user's request.
3. The dashboard's first withdrawal click attempted a quote and then continued to create a payout request in the same click. The fee quote was not a required review step.
4. The dashboard generated a fresh idempotency key for each attempt, so a retry after an ambiguous network failure did not reuse the original request key.

### Changes made

- The withdrawal endpoint now schedules a server-side dispatch of the existing execution worker after the response **only when every explicit Testnet execution gate is aligned**: payout execution enabled, A2U enabled, Testnet-only enabled, `PI_NETWORK=testnet`, `PI_ENV=production`, sandbox mode resolved true, and a server-side executor secret configured.
- The executor secret remains server-only. The worker endpoint still requires the secret and can derive the payout owner only from the durable request row. If a user session is present, the request must belong to that user. Wallet authorization, linked Pi identity, reservation, shared A2U sequence lease, provider metadata, read-after-write receipt verification, and atomic settlement checks remain mandatory.
- If the flags are not aligned, the request remains reserved and the API clearly reports that no Pi transfer was started. It never marks a payout as paid from request creation.
- The dashboard now presents **Preview 3% fee** as a separate first step, displays an accessible **Withdrawal quote** card, and changes the follow-up action to **Withdraw to Pi wallet**.
- The client reuses the same idempotency key for the same amount after an ambiguous network failure.
- Added `PI_EARNINGS_EXECUTOR_KEY=` as an empty server-only placeholder in `.env.example`; no secret value is committed.
- Added 14 source regression checks in `scripts/check-phase1-pi-earnings-dispatch.mjs`, registered in static verification and `prebuild`.

### Pi platform constraint — do not misrepresent it

The official Pi developer documentation says A2U payments are currently available on **Testnet only**. This code cannot legitimately enable Mainnet withdrawals while that platform gate remains. Live payout success also requires a reconciled database, all reviewed payout migrations applied, a funded Testnet app wallet, valid server credentials, a linked and authorized recipient, and live end-to-end verification.

References:
- https://developers.minepi.com/docs/accept-payment/PaymentsAdvanced
- https://developers.minepi.com/docs/api-reference/PlatformAPI

## 3. Verification evidence

Passed in the available environment:

- `npm run verify:static` — complete suite passed after the Phase 1 source changes.
- Migration master bundle — **175/175** source files byte-for-byte synchronized.
- Migration source manifest — **175/175** synchronized.
- Pi payout dispatch and quote UX — **14/14**.
- Pi earnings payout request lifecycle — **21/21**.
- Pi earnings execution worker contracts — **21/21**.
- Receipt/lease fencing — **13/13**.
- Shared A2U lane — **12/12**.
- Withdrawal request/quote boundary — **12/12**.
- Legacy withdrawal UX contract — **14/14**.
- A2U roadmap contract — **14/14**.
- Project truth — **10/10**.
- Release hygiene — **11/11**.
- Dependency lock integrity — passed.
- Clean canonical migration names — **175 unique**.
- Migration release-readiness static checks — passed, with remote applied state still unverified.
- Marketplace cart contract — **9/9**.
- Post/curation production contract — **12/12**.
- Accessible navigation checks — passed.

## 4. Not verified / release blockers

The environment provides Node `22.16.0`, while this project requires Node `24.15.0`. `npm ci --legacy-peer-deps --no-audit --ignore-scripts --prefer-offline` did not finish before the environment timeout and no complete TypeScript/ESLint toolchain became available. Therefore no supported-runtime typecheck, lint, or production build is claimed. No live Supabase, Pi Testnet, wallet funding, payout receipt, or concurrency test was performed.

No database migration was applied, no balance was edited, no financial flow was enabled in deployment, and no Mainnet A2U behavior was added. The source dispatch change is not proof that a deployment has the required environment flags or provider readiness.

## 5. Remaining phases

- **Phase 2:** Post cards, all action keys, curation writes/readback, story/feed interaction state, and reward consistency.
- **Phase 3:** Modern story UI, navigation, transitions, responsive design, accessibility, loading/error/empty states, and real persistence.
- **Phase 4:** Marketplace discovery, product cards, cart editing/persistence, shipping/tax/discount totals, checkout recovery, and order state integrity.
- **Phase 5:** Node 24 install, typecheck/lint/build, disposable database and migration-history reconciliation, live Testnet withdrawal tests, social/media/marketplace integration, and final release gate.

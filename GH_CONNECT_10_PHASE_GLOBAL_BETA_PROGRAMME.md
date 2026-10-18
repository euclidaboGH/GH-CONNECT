# GH-CONNECT 0.61.1 — 10-Phase Global Beta Programme

**Status:** implementation programme and working candidate; not a production approval.
**Latest candidate:** Phase 8 realtime transport hardening plus Phase 9 atomic marketplace inventory reservation source candidate, 2026-10-18. The product policy is now being revised to allow Daily Claim and qualifying referrals as the only issuance sources, while curation rewards redistribute existing GHC. See `GREENHAVEN_GHC_ECONOMY_AND_FEES_ROADMAP_2026-10-18.md`.
**Deployment rule:** no remote migration, Git push, Vercel deployment, or Mainnet action is performed by this plan. Verify each gate and obtain operator approval before any remote mutation.

## Product invariants

1. GHC is an internal GreenHaven reward/transfer unit, not a public cryptocurrency or independently redeemable cash balance.
2. The only approved sources of new user-available GHC are (a) the authoritative Daily Claim process and (b) a qualifying, successfully settled referral reward. Referral issuance must be idempotent, fraud-resistant, auditable and calculated as 5% of the canonical approved VIP GHC upgrade price. Transfers and curation rewards redistribute existing units and do not mint.
3. A Daily Claim creates a durable pending entitlement with server-recorded `claimed_at` and `redeemable_at = claimed_at + interval '48 hours'`.
4. Redemption before `redeemable_at` is rejected by the database, regardless of client clock or UI state.
5. Successful redemption converts a claim once into spendable ledger value. Retries are idempotent; claim, ledger credit and claim status change are atomic.
6. Spendable balances come from the authoritative ledger/snapshot derived from it. UI caches are display-only and must rehydrate after redemption or transfer.
7. Transfers resolve a recipient's GreenHaven ID to one verified internal user ID. The server derives the sender from the authenticated session and atomically debits/credits both accounts.
8. No client API or feature-specific balance store can mint GHC. Activity/achievement, promotional/admin, purchase, and generic credit paths remain disabled unless explicitly authorized as the referral issuance path. Curation creator rewards must be funded by debiting/allocating existing GHC from participating upvoters or a funded pool, not by minting. Marketplace listing fees, community creation fees, VIP upgrades and other utility sinks must debit the authoritative ledger or use a verified Pi payment intent.
9. Existing ledger history must not be silently rewritten or deleted. Corrections use auditable compensating entries.
10. Testnet and Mainnet are separate environments. No migration is applied until live migration history and schema are reconciled.

## Ten phases

### Phase 1 — Repository baseline, build and dependency health
- Repair the reported React event-handler TypeScript mismatch and hook dependency warning.
- Run a clean install on a supported Node runtime; run typecheck, lint, JSX safety, focused tests and a fresh Next.js production build.
- Audit npm advisories individually; do not use `npm audit fix --force` as a blanket fix.
- Exit gate: repeatable CI build and no unexplained build/type/lint failures.

### Phase 2 — Read-only architecture and live-schema reconciliation
- Source-level review completed for the Daily Claim route, atomic claim RPC, pending-redemption RPC, wallet snapshot, local development path and GHC emission registry.
- Source-level finding: the prior daily-claim RPC posted the user reward immediately; other issuance channels (including curation/activity/admin/purchase-related paths) remain in the source and require Phase 6 policy work.
- Repository migration inventory shows 87 SQL files and 10 files dated after the 2026-10-18 audit date. Live Testnet migration history and schema are NOT VERIFIED because no database connection/credentials were available.
- Exit gate: still pending live schema delta, migration history reconciliation and operator-approved migration ordering.

### Phase 3 — Daily Claim and 48-hour pending entitlement
- Implementation candidate added: the atomic daily-claim transaction creates a pending user entitlement; database redemption enforces the 48-hour lock and idempotent redemption; UI/API expose pending state and redeemable time.
- Added fail-closed behavior if the deployed RPC does not return the new pending lifecycle contract.
- Static regression checks pass, but PostgreSQL execution, exact boundary and concurrent redemption tests remain pending on Testnet.
- Exit gate: reviewed/applied Testnet migration plus database tests for the exact 48-hour boundary, timezone independence, duplicate claims, retry and concurrency.

### Phase 4 — Exactly-once redemption and wallet synchronization
- Source-level reconciliation completed for the redemption RPC, wallet snapshot, shared spendable-balance function, API response and client rehydration path.
- Added `scripts/test-daily-claim-redemption-wallet.mjs` and wired it into `ci:verify`; the 22 source-contract assertions pass.
- Source confirms the redemption RPC locks the pending row, enforces the database 48-hour boundary, expires the entitlement and inserts the posted credit transactionally, and resolves Daily Claim retries by hold ID/reference.
- Source confirms pending claims are reported separately and excluded from spendable wallet balances; spend authorization uses the shared reservation-aware balance function.
- **Exit gate still pending:** live Testnet migration/schema reconciliation, exact boundary and concurrent/replay tests, multi-instance wallet refresh, and clean typecheck/lint/production build. See `PHASE_4_REDEMPTION_WALLET_INTEGRITY_2026-10-18.md`.

### Phase 5 — GreenHaven ID transfers and shared economy contract
- **Source candidate implemented:** direct transfer API now requires a valid public GreenHaven ID, resolves it through the canonical directory, and derives the internal recipient account key server-side. Client-provided internal destination IDs and display names are not authoritative.
- Send GHC and wallet quick-transfer UI validate/resolve manually entered GreenHaven IDs and send the public ID in their intents. Configured database identity operations fail closed instead of minting process-local fallback identities when their RPCs fail.
- The existing atomic `ghc_execute_transfer` remains the sole ledger money-move operation; transfer requests keep their existing atomic acceptance path.
- Static GreenHaven ID transfer checks pass 11/11. Existing wallet, daily-claim, economy, baseline, reliability, and release-hygiene checks also pass.
- **Exit gate pending:** live Testnet migration/schema/ACL reconciliation; two-account, concurrency, replay, timeout-after-commit, and failure-injection tests; clean dependency install, typecheck, lint, and production build. See `PHASE_5_GREENHAVEN_ID_TRANSFER_CANDIDATE_2026-10-18.md`.

### Phase 6 — Initial issuance guard (candidate; must be amended before Testnet rollout)
- **Initial source candidate implemented:** generic activity/achievement/referral reward evaluation and manual/admin credits are disabled at the API/domain boundary; curation voting remains available while its reward side effect returns a non-credit result; Pi purchase credit remains unwired. This is a temporary restrictive implementation and does not yet meet the product requirements now confirmed by the owner.
- Added `202610180009_ghc_daily_claim_only_issuance.sql`: database trigger allowlists Daily Claim's pending 48-hour entitlement and posted redemption, the internal protocol reserve leg, and positive transfer-in entries only when a matching posted transfer-out exists with equal amount and counterparties. Other positive credit/staging writes are rejected. Generic `ghc_stage_pending` execution is revoked from application roles when the expected signature exists.
- Added `scripts/test-daily-claim-only-issuance.mjs` and wired it into `ci:verify`. Source-level test checks policy allowlists, API gates, transfer exception, curation no-op, and preservation of ledger history.
- Existing ledger history is not deleted or rewritten. Historical non-Daily-Claim pending entitlements require a documented operator/support disposition because the new guard will prevent their positive redemption.
- **Exit gate still pending:** amend the issuance guard to authorize only qualifying referral credits in addition to Daily Claim, and replace the curation no-credit stub with a balance-funded redistribution design. Then complete SQL/runtime validation, live Testnet migration reconciliation, historical pending inventory, transfer concurrency, curation/referral abuse tests, and full typecheck/lint/production build. No live migration has been applied. See `PHASE_6_DAILY_CLAIM_ONLY_ISSUANCE_2026-10-18.md` and `GREENHAVEN_GHC_ECONOMY_AND_FEES_ROADMAP_2026-10-18.md`.

### Phase 7 — GHC economy policy, curation, referrals and utility fees (priority)
- Amend the Phase 6 database issuance guard so only Daily Claim and a dedicated, auditable qualifying-referral RPC can create new user-available GHC. All other generic issuance remains blocked.
- Restore curation rewards as **redistribution**, not issuance: snapshot the upvoter's server-derived spendable balance; calculate the selected contribution; atomically debit/allocate the upvoter's GHC and credit the content creator; prevent self-votes, repeat/toggle farming, concurrent double settlement and overspending. Likes remain separate from upvotes.
- Implement a referral code/link for every registered user, durable attribution at signup, fraud/self-referral protections, and a one-time 5% reward tied to a completed qualifying VIP upgrade. Use the server's canonical approved VIP price, not a client-supplied amount. Prefer GHC-paid VIP upgrades as the qualifying trigger for launch unless the product owner explicitly approves referral issuance after Pi-paid upgrades too.
- Canonical GHC membership pricing: VIP 150 GHC monthly / 1,800 GHC annual list price; VVIP 300 monthly / 3,600 annual list price. With 20% annual discount, the 12-month GHC charge is VIP 1,440 / VVIP 2,880. Implement the four paid durations (1/4/8/12 months), each with one bonus month and 0/5/10/20% discount, end-to-end before launch. Referral reward is 5% of actual qualifying GHC charged after discount.
- Add fee configuration and idempotent payment/ledger paths for marketplace listing and community creation. Proposed conservative pilot defaults (configurable, not an exchange-rate promise): marketplace listing **5 GHC or 0.05 Pi**; community creation **50 GHC or 0.5 Pi**. Show the chosen currency and exact fee before confirmation. Avoid charging both currencies for one creation/listing.
- Treat VIP upgrades, marketplace listing fees, community creation, boosts and creator tips as utility sinks. Pi charges must use verified, idempotent Pi payment intents; GHC charges must debit the authoritative ledger. Do not wire Pi purchase-to-GHC conversion.
- Add economic limits, per-user/day caps, abuse detection, immutable audit references, reversal/refund handling and migration tests. Preserve all historical ledger rows; explicitly disposition old pending rewards before rollout.
- Exit gate: one canonical VIP price catalog; tests prove only Daily Claim/referral issue new GHC; curation transfers GHC without changing total supply; referral reward is exactly 5% once per eligible upgrade; GHC/Pi fees settle exactly once; no self-referral or double-claim; SQL validated on disposable Testnet.

### Phase 8 — Security, identity, UX and accessibility
- Test RLS, IDOR/cross-account access, session revocation, step-up verification, WebAuthn/recovery, upload authorization, rate limiting, referral attribution tampering and secret handling.
- Add/verify report, block, moderation, appeals and audit-trail workflows.
- Build clear referral-link copy/share/status UI, referral qualification/pending/paid states, curation contribution preview, creator-reward history, and explicit GHC/Pi fee selection/confirmation for marketplace and community creation.
- Clearly distinguish pending Daily Claim GHC from spendable GHC; show the server-provided redeemable time and authoritative balance refresh after every settlement.
- Add accessible labels/focus/contrast, responsive mobile layouts, localization-ready strings, locale-aware dates/numbers and reduced-motion support.
- Exit gate: two-user authorization matrix, security regression suite, mobile/keyboard/accessibility and visual regression checks pass.

### Phase 9 — Reliability, performance and observability
- **Source candidate added:** `202610180011_atomic_marketplace_inventory_reservation.sql` introduces a database row-lock reservation RPC, buyer-scoped idempotency keys, 15-minute pending holds, expiry release on durable order reads/creation, and stock restoration when an unpaid reserved order is cancelled. The order API now requires a stable idempotency key and uses the RPC rather than read-then-write stock checks. A durable payment claim now prevents the expiry worker from releasing stock while payment is in progress and rejects concurrent payment attempts. Ambiguous payment outcomes retain stock for reconciliation. Finite stock remains NOT release-approved until this migration is reconciled and executed on disposable Testnet with concurrent buyers and payment/expiry race tests.
- Add/verify structured logs, request IDs, error reporting, latency metrics, DB monitoring and alerts while redacting tokens and personal data.
- Test real-time messaging, notifications, media upload retries, offline/reconnect, feed pagination, referral event retries, curation settlement concurrency, Pi payment callbacks and marketplace/community fee concurrency.
- Keep the following economy work explicitly open until implementation and Testnet evidence exist: (1) complete referral links and the 5% qualifying VIP referral reward; (2) implement curation rewards as redistribution of upvoters’ existing GHC; (3) implement and test marketplace listing and community creation fees in both GHC and Pi; (4) execute and validate atomic inventory reservation under concurrent order attempts; (5) reconcile Supabase migration history and schema independently for Testnet and Mainnet.
- Establish performance budgets, economic reconciliation reports (GHC issued, redistributed, spent, reversed), and low-bandwidth device/network testing.
- Exit gate: actionable alerts, documented SLOs, daily ledger-supply reconciliation and critical user journeys pass under simulated failures.

### Phase 10 — Controlled global beta and release governance
- Build and deploy only to Preview/Testnet after all local gates pass; reconcile/apply migrations through the approved operator workflow.
- Run multi-user end-to-end journeys for onboarding, referral link attribution, eligible VIP upgrade and 5% referral reward, Daily Claim/48-hour wait/redemption, curation-funded creator reward, GreenHaven ID transfers, GHC/Pi marketplace listing fee and community creation fee, replay protection, account isolation and payment isolation.
- Invite a small cohort, monitor referral/curation abuse and economy inflation, review telemetry/support feedback, resolve blockers and publish known limitations.
- Mainnet requires separate explicit approval, clean migration reconciliation, backup/recovery evidence, a rollback/forward-fix plan and operator sign-off on final fee configuration.
- Exit gate: signed release evidence bundle; no unresolved critical/high security issues; all issuance, redistribution, fee and payment invariants verified against live Testnet.

## Source changes in this candidate

- `components/ghc/enhanced-post-card.tsx`: mouse/touch callbacks now pass an explicit long-press reaction kind instead of allowing React's event object to be interpreted as the reaction argument.
- `components/ghc/enhanced-feed-screen.tsx`: effect dependencies now track the status object used by the reward-ready notice.
- `scripts/test-10-phase-baseline.mjs`: source regression checks for these fixes and critical GHC policy requirements.

## Verification limits

This archive is a source candidate. It does not contain connected production credentials. No live Supabase schema, Pi Testnet payment, Vercel deployment, Git push or Mainnet migration is certified by this document. The 48-hour migration is authored but not applied; the sole-issuance policy remains a Phase 6 task. Both requirements must be proven with live Testnet transaction/concurrency tests before launch.

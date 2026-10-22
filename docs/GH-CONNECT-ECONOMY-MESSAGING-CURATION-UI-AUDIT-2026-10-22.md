# GH-CONNECT — Economy, Messaging, Curation, Media & UI Audit Addendum

**Audit date:** 2026-10-22  
**Source:** GH-CONNECT 0.70.3 audit candidate available in this conversation. This is a source-code audit, not a live Testnet/Mainnet database inspection. Do not treat this addendum as approval to deploy migrations or to delete production records.

## Executive conclusion

The project has a number of good fail-closed controls, including server-owned daily-claim amounts, a database-clock 48-hour pending entitlement, authenticated wallet routes, server-side curation writes, conversation membership checks, and private-media authorization. The remaining work is not just UI polish: the migration history is blocked, live ledger/provider behavior is unverified, and the attachment contract needs tightening before messaging media can be called durable and private.

## Highest-priority findings

### P0 — Migration history must be reconciled before database changes

Two duplicate migration version prefixes exist: `202610210001` and `202610210002`; the migration history reconciler fails. Several migration filenames are dated after the audit date. Do not rename/apply migrations by guesswork. Export the applied migration ledger and schema/RPC signatures from Testnet and Mainnet, compare each environment independently, and produce a reviewed reconciliation plan before applying anything.

### P1 — Messaging attachments are URL-based rather than strictly media-reference-based

`app/api/messaging/conversations/[conversationId]/messages/route.ts` accepts up to four HTTPS attachment URLs from the request and validates protocol/shape, but the handler does not itself prove that each URL resolves to a media record owned/uploaded by the sender and authorized for the conversation. The durable store repeats HTTPS URL validation rather than enforcing a canonical `mediaId` relationship. HTTPS-only is not an ownership or privacy check.

**Fix:** accept canonical media IDs only; resolve them server-side; verify uploader ownership, upload-complete status, allowed MIME/size, conversation membership, and allowed attachment role; store media IDs and metadata, not short-lived signed URLs. Generate a fresh viewer-authorized signed URL when a conversation is read. Test a forged third-party URL, another user's media ID, an expired signed URL, removed conversation membership, and deleted media.

### P1 — Media URLs can expire while messages persist

The signed-media endpoint issues signed URLs with a 300-second lifetime. If a message persists that URL as its canonical attachment, the attachment may stop rendering after five minutes or after the URL expires. The intended stable representation should be `mediaId`; the signed URL should be transient and viewer-specific.

### P1 — 48-hour maturity needs live ledger proof, not just UI proof

The daily claim endpoint correctly requires the atomic database response to confirm `pending: true` and `redeemableAt`, and the SQL migration uses database time for the 48-hour lock. The claim RPC is intended to reject redemption before maturity. Static tests pass, but live proof is still required that pending daily rewards are excluded from spendable balance, cannot be transferred/spent early, become claimable exactly at maturity, and can be claimed only once under concurrency. Also test legacy pending rows and records without `redeemableAt`; the code must fail closed instead of silently treating them as mature.

**Fix/test:** for each claim reference, reconcile user pending entitlement, reserve entry, transaction, and wallet snapshot; test at T+47:59:59, T+48:00:00, two concurrent claim requests, and transfer/spend attempts before and after maturity. Use database time, not client time.

### P1 — GHC/Pi is not a general instant swap in this archive

The code has a gated Pi-to-GHC pack-purchase flow (`/api/economy/purchase-ghc`) and a separately gated GHC-to-Pi withdrawal-request flow (`/api/economy/withdrawals`). The withdrawal route explicitly says it does not send Pi instantly; it creates a settlement request. GHC-to-Pi withdrawal is disabled unless the server feature gate is enabled. This is not a bidirectional atomic swap service and must not be represented in the UI as a live swap unless pricing, liquidity, settlement, refund/reversal, provider confirmation, and reconciliation are actually operational.

**Fix:** label Pi-to-GHC as a pack purchase and GHC-to-Pi as a withdrawal/settlement request; show server-quoted rate, fees, minimum, limits, pending/approved/settled/rejected states, and a transaction reference. Keep both paths disabled until Testnet end-to-end tests, operational reconciliation, and risk approval are complete. Never trust client-supplied rate or Pi amount.

### P1 — “Claimable” and “transferable” must be distinct states

The daily reward endpoint returns a pending entitlement with a `redeemableAt`; the separate reward-claim endpoint redeems a specific `holdId`. UI must distinguish: `Pending (48-hour lock)`, `Ready to claim`, `Claiming`, `Available GHC`, and `Transferable GHC`. A matured reward is not spendable/transferable until the server confirms the atomic claim and the wallet snapshot reflects the credited amount. Do not calculate transferability from local reward totals or optimistic UI state.

### P1 — Curation side effects and reward economics need one clear product contract

The curation API writes through an atomic RPC and computes reviewer weight server-side. Redistribution is behind a feature flag and is balance-funded, while other curation reward issuance paths are guarded by issuance policy. This can be safe, but it is easy for the UI to imply that every upvote earns GHC when the result may be disabled, capped, ineligible, or non-crediting.

**Fix:** render the authoritative RPC outcome (`credited`, `amount`, `reason`, `status`) and clearly distinguish reputation/curation weight from GHC. Add replay tests for changing a vote, neutralizing, retrying the same vote, self-voting, two-account voting, failed reward side effect, and feature flag off/on. Curation is not a substitute for a paid-like system; self-curation must never mint GHC or count as independent validation.

## Section-by-section notes

### Wallet balance and ledger

**Strengths:** authenticated user identity is session-derived; wallet/reward regression suites check durable ledger behavior and pending-vs-spendable separation; wallet snapshot is server-owned.

**Remaining weaknesses:** no live Testnet concurrent-spend, cross-device refresh, RLS/grant, or multi-instance test was performed. A broad static test suite cannot prove deployed RPC signatures and grants match the source. Different spending domains need shared concurrency evidence.

**Required fixes/tests:** reconcile ledger transactions against the wallet snapshot; verify debit/credit pairs for transfers; replay duplicate references; race transfer vs purchase vs membership spend; verify locked/pending funds are excluded; ensure all clients refresh from the authoritative wallet endpoint after success. No localStorage balance may be treated as authority.

### Rewards and 48-hour maturity

**Strengths:** server ignores client amount fields; database clock controls maturity; claim route requires a hold ID; daily-claim path is idempotent and fail-closed if the migration contract is missing.

**Remaining weaknesses:** reward preview and claim status can still look different while the server status is loading/unavailable. Static checks do not prove the target database has the correct RPC deployed. A reward being shown in a feed is not proof that it is claimable.

**Fixes:** one canonical reward-status source; visible loading/unknown state; one claim modal/controller; no speculative claimable amount; disable claim/transfer while status is unknown; reconcile stale/legacy pending rows with an audited, idempotent operator job.

### GHC/Pi purchase, swap, and withdrawal

**Strengths:** pack purchase requires a user-bound completed payment intent, catalog match, amount match, and server-side credit RPC; withdrawals are feature-gated and server-rate-derived.

**Remaining weaknesses:** payment completed but GHC credit failed needs an operator-visible reconciliation queue. GHC-to-Pi settlement is not instant and is disabled by default. No live Pi Browser/provider flow was tested.

**Fixes:** implement paid-but-unfulfilled intent dashboard, retry with idempotency, immutable audit trail, operator separation of duties, and explicit UI state. Do not enable Mainnet swap/withdrawal by flipping a feature flag alone.

### Messages and media uploads

**Strengths:** authenticated conversation APIs, member checks, rate limits, idempotent client message IDs, attachment count limits, and a private-media authorization endpoint exist. Delivery/read receipt migration is present in source but still requires migration reconciliation.

**Remaining weaknesses:** URL validation is not media ownership validation; short-lived signed URLs should not be persisted as durable message references. The messaging attachment migration file `202610200001_gh_messaging_media_attachments_meta.md` is documentation, not SQL, so do not assume it applies schema. Validate that all required schema changes already exist in the actual DB. Upload completion and Pi Browser session recovery were not tested live.

**Fixes:** store `mediaId`, verify ownership/completion server-side, sign per viewer on read, and use retryable upload states (`selected`, `uploading`, `uploaded`, `failed`, `attached`). Add malware/type validation and safe download headers for files; test expired sessions, retry, duplicate send, and revocation.

### Feed, profile, timeline, posts, comments

The earlier full report remains applicable: feed visibility is inconsistent for mutuals/community membership; comment reads need viewer-aware authorization; profile timeline is currently derived from loaded feed state and is incomplete; reaction counts and high-engagement counts need durable aggregation. These remain release blockers until verified.

### Curation

**Strengths:** authenticated actor, rate limiting, client authority stripped, weighted vote computed server-side, durable atomic RPC, self-curation restrictions in relevant migrations, redistribution feature flag.

**Remaining weaknesses:** user-facing copy can overstate whether a curation action produces GHC. The database migration collision means the exact deployed curation contract is unverified. Async notifications and optional redistribution need observability without changing the success status of the vote.

**Fixes:** show only the persisted RPC result; separate `vote saved`, `GHC credited`, and `redistribution attempted`; add structured telemetry and idempotency/concurrency tests; never silently retry a financial side effect outside the atomic contract.

### UI/layout and hidden features

**Risk:** a feature can be implemented in source but remain undiscoverable because it is only in overflow menus, behind feature flags, absent from the navigation registry, or shown as disabled without a reason. Conversely, a UI affordance can look active when its API/migration is unavailable.

**Fixes:** produce a route/action inventory and compare every visible control against a working handler; add explicit states (`Available`, `Needs setup`, `Temporarily unavailable`, `Coming soon`) rather than silently hiding important functions. On mobile/Pi Browser, check safe areas, bottom-nav overlap, scroll containment, focus states, keyboard navigation, empty/error/loading states, and 320–430 px widths. Keep the core navigation stable and expose secondary features through clearly labeled, searchable profile/ecosystem menus. Avoid duplicate entry points that open different state owners.

## Old records, stale pipelines, and cleanup policy

**Do not bulk-delete ledger, reward, payment, message, media, membership, or curation rows.** These are audit evidence and may be required to recover orphaned payments or explain balance differences. Cleanup must be classified:

1. **Safe operational cleanup:** expired rate-limit buckets, expired temporary uploads not referenced by a message/post/profile, stale idempotency caches only after their retention contract is confirmed, and expired signed URLs (URLs expire naturally; do not delete the media record).
2. **Reconciliation first:** paid-but-unfulfilled payment intents, pending rewards, orphan transfer pairs, unsettled withdrawal requests, membership debits without entitlements, media rows with missing objects, and notifications/receipts with missing parents. Generate a dry-run report and counts first.
3. **Never auto-delete:** ledger rows, payment provider references, reward issuance evidence, moderation/security events, or curation history. Correct them with auditable compensating entries or reviewed retention jobs.
4. **Before any cleanup:** backup, row counts, date ranges, referential-integrity report, dry-run IDs, operator approval, idempotent batch size, rollback/restore plan, and post-run ledger reconciliation.

## Roadmap in release order

### Gate 0 — Source and migration truth
- Confirm this archive against the latest `testnet` branch; do not overwrite newer work.
- Compare Testnet and Mainnet migration ledgers and RPC definitions.
- Resolve duplicate prefixes `202610210001` and `202610210002`; review future-dated migrations.
- Install with Node 24.15.0 and run clean dependency install, CI verification, TypeScript, ESLint, and production build.

### Gate 1 — Security and durable data contracts
- Fix comment visibility and feed mutuals/community visibility.
- Convert message attachments to canonical `mediaId` references with per-viewer signing.
- Verify all messaging/media schema exists in Testnet.
- Add complete profile timeline API and stable cursor.

### Gate 2 — Economy invariants
- Test reward pending/mature/claim/transfer at the 48-hour boundary using DB time.
- Test balance snapshot and cross-domain concurrent spends/transfers.
- Add paid-but-unfulfilled Pi purchase recovery and operator evidence.
- Keep GHC→Pi settlement disabled until a full provider and operations runbook passes.

### Gate 3 — UX and discoverability
- Build a feature-to-route/control matrix and fix dead buttons/events/deep links.
- Consolidate reward modal/status ownership.
- Show explicit feature gates, loading/error/retry, claim maturity countdown, and wallet refresh states.
- Run mobile/Pi Browser responsive and accessibility E2E tests.

### Gate 4 — Controlled cleanup and release
- Dry-run orphan/stale-record reports; reconcile before mutation.
- Never delete financial evidence as generic “cleanup.”
- Run Testnet two-account tests, restore rehearsal, rollback review, and sign off each release gate before Mainnet.

## Verification boundary

This addendum is based on source inspection and previously run static regression checks. It does not claim live Supabase verification, live Pi Browser/provider E2E, a complete production build, or successful database cleanup. Those require the project’s Node 24.15.0 environment and explicit Testnet evidence.

## Follow-up implementation work

The source archive now includes `docs/GH-CONNECT-IMPLEMENTATION-UPDATE-2026-10-22.md`, which records additional code-level repairs made after the original audit: canonical batched visibility filtering for feed/profile payloads, fail-closed comment read/write authorization, comment-to-post reaction binding, owner-verified first-party media attachment references for messages/comments, current-audience authorization for comment media delivery, raw-page cursor advancement after visibility filtering, and explicit Ecosystem/Marketplace shortcuts in profile navigation. The new `test:private-social-media-contracts` regression suite is wired into `ci:verify`.

The follow-up does not clear the existing release blockers. Duplicate migration version prefixes remain unresolved, future-dated migrations require review, and a supported Node runtime plus clean dependency installation are still required for typecheck/lint/build and live Testnet verification.

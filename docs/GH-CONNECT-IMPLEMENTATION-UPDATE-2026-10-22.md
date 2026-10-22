# GH-CONNECT implementation update — 2026-10-22

Source baseline: GH-CONNECT 0.70.3 audit candidate. This update contains additional source-level repairs on top of the existing full product audit candidate. It does not claim that Testnet/Mainnet migrations have been applied or that a live end-to-end build has passed.

## Implemented in this candidate

### Social visibility and comment integrity

- Added `lib/server/social/post-visibility.ts`, a server-only, fail-closed visibility check based on the authenticated session user. It checks post existence/deletion, blocks in either direction, active community membership, public visibility, follower visibility and mutual-follow visibility.
- Added a bounded batch visibility filter for feed/profile responses. It re-reads canonical post metadata, checks blocks, active community membership, follower/mutual visibility, and archived/deleted state before any post payload reaches the browser. It avoids N+1 policy reads and fails closed when policy data cannot be verified.
- Feed pagination now advances from the last raw server row, not the last visible/mute-filtered row, avoiding repeat-page loops when hidden posts are filtered out.
- Comment list and comment creation routes now check post visibility before reading or writing comments. They return a non-cacheable 503 when authorization cannot be determined, rather than silently returning empty data or proceeding on a DB failure.
- Comment reaction read/write routes now verify the parent post is visible and verify that the comment belongs to the supplied post. This closes the cross-post comment-ID lookup gap in the reaction-count endpoint.
- The service-role visibility helper never returns comment content; the comment association helper only confirms whether the pair exists.

### Message/comment media integrity

- Added `lib/server/media/owned-attachment-validation.ts`.
- Message and comment creation now accept only ready, first-party `/api/media/{mediaId}/content` references; arbitrary third-party HTTPS URLs, blob/data URLs, query/hash variants, oversized attachment arrays and unowned media are rejected.
- Attachment ownership is verified against `gh_media_assets` through the existing service-role `gh_media_authorize_viewer` RPC. A DB authorization outage fails closed with 503.
- Persisted attachment references are normalized to relative first-party paths, not expiring storage signed URLs or arbitrary absolute hosts.
- Private media delivery now has a fallback for comment attachments. It checks the ready media asset, confirms the comment author owns that asset, finds the durable comment reference, and re-evaluates current parent-post visibility for the actual session viewer before issuing a signed URL.

### UI discoverability

- Added an **Explore GreenHaven** group in the profile's account/more navigation with explicit Ecosystem and Marketplace shortcuts. It points users to existing canonical destinations and keeps upcoming ecosystem services labelled as upcoming rather than making them appear functional prematurely.

### Regression protection

- Added `scripts/test-private-social-media-contracts.mjs` with 14 source-contract checks.
- Registered it as `npm run test:private-social-media-contracts` and in `ci:verify`.
- Existing targeted checks passed for comment server-first behavior, reaction count contracts, social visibility, media route hardening, signed media URLs, messaging reliability, daily reward 48-hour maturity, daily claim issuance, wallet redemption integrity, reward reliability, membership pricing/orphan recovery, curation reward separation, responsive UI and release policy.

## Verification performed

Passed in this source environment:

- JSX safety scan: 729 files
- Project integrity: 36 checks, 0 errors, 0 warnings
- Dependency lock coverage/root version consistency
- New private social/media contracts: 17/17
- Comment server-first contract and comment reaction count contract
- Social visibility: 14/14
- Media route hardening: 13/13
- Signed media authorization: 15 checks across the two suites
- Messaging reliability: 32 checks
- Daily Claim 48-hour maturity: 14 checks
- Daily-claim-only issuance: 31/31
- Daily claim → wallet integrity: 26 checks
- Reward reliability: 24 checks
- Membership pricing and orphan recovery
- Curation reward and like/curation separation
- Premium UI and responsive visual source contracts
- Release-gate policy and release hygiene

## Release blockers that remain

1. **Migration history is blocked.** Duplicate Supabase migration version prefixes remain: `202610210001` and `202610210002`. `test:migration-history-reconciler` and migration inventory generation correctly fail. Do not rename, reorder or apply migrations until Testnet and Mainnet histories have been captured and reconciled.
2. **Fourteen migrations are future-dated relative to 2026-10-22.** They require dependency and target-history review before application.
3. **Build/typecheck not verified.** The environment has Node 22.16.0, but this project requires Node `^22.22.2` or `^24.15.0` (the repository pins 24.15.0). A dependency installation attempt did not complete in the available execution window. ESLint, TypeScript and Next production build must be rerun under a supported runtime with a clean dependency install.
4. **No live database or Pi Browser E2E was performed.** Static checks do not prove concurrency, current Supabase schema compatibility, Pi payment settlement, or payout completion.
5. **Wallet/Pi exchange remains intentionally gated.** Do not enable GHC-to-Pi payouts or label a request/intent as an instant swap until the actual Pi payout adapter, settlement reconciliation, idempotency, and failure recovery have passed Testnet end-to-end tests.
6. **No records were deleted or changed in a live database.** Stale media, pending reward holds, paid-but-unfulfilled memberships, orphaned transfers and ledger anomalies must be identified through a dry-run report first. Preserve immutable ledger/payment evidence; cleanup should soft-delete eligible media and repair orphan state through approved idempotent RPCs only.

## Required next release sequence

1. Capture Testnet and Mainnet migration histories separately; reconcile duplicate version prefixes without blindly renaming applied migrations.
2. Run a clean Node 24.15.0 install, typecheck, lint, production build and complete `ci:verify`.
3. Apply reviewed migrations to a disposable PostgreSQL/Testnet environment; test private/public/follower/mutual/community visibility with two or more independent users.
4. Test owned/unowned media, cross-post comment IDs, deleted comments, blocked users, expired signed URLs and private-community attachments.
5. Test reward maturity just before/at/after 48 hours, duplicate/concurrent claims, wallet balance reconciliation, GHC transfers, Pi payment fulfillment and orphan recovery.
6. Produce dry-run cleanup reports and obtain explicit operator approval before any destructive action.
7. Run Pi Browser mobile and desktop E2E, including wallet, rewards, membership, feed, profile timeline, messaging, curation and upload recovery.

The ZIP is an implementation candidate for review and verification, not a production-ready release assertion.

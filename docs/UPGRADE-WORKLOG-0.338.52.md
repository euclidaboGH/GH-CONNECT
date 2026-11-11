# GreenHaven 0.338.52 — Run #289 Notification Deep-Linking and Delivery Upgrade

Date: 2026-11-11

## Scope and research

Reviewed the Run #288 archive, notification center and its three durable feeds, social comment writers, marketplace order/payment routes, Pi payment completion, daily reward claims, GHC transfer notifications, navigation listeners, Wallet history, Rewards history, Marketplace order views, Supabase Testnet schema/functions/triggers and connected Vercel deployment/build events.

The live Testnet notification architecture has a unified `gh_notification_inbox` projection for social and economy rows. The social and economy tables are mirrored into it by database triggers, while the client previously merged all three feeds without matching the projection IDs. That could show the same event multiple times and inflate unread counts. The live schema has `gh_posts.listing_id`, `gh_notification_inbox_create`, and `gh_notification_event_append`; the inbox creation RPC enforces non-empty dedupe keys and applies self/block suppression. No user notification payloads or personal records were read for this review.

## Implemented changes

1. Added `lib/notification-targets.ts`, a pure typed resolver/sanitizer for post, comment, reply, conversation, Marketplace listing/order/response, Pi payment, GHC transaction, payout request, reward claim, and transfer-request targets. URL-like and control-character identifiers are rejected; social/financial events cannot be redirected into Settings.
2. Made the primary notification row action navigate directly to the target; notification details/history remain available through a separate secondary action.
3. Changed the unified inbox to be the canonical feed for projected social/economy events, with unmatched legacy rows retained only as recovery fallback. Fixed read-state synchronization to strip `social_` / `economy_` projection prefixes before calling legacy read endpoints.
4. Added thread-aware comment recipients: the post owner plus recent post participants or exact reply-thread participants, with a bounded/cycle-safe parent walk, actor exclusion, block-aware notification RPC, and exact post/comment/parent/thread IDs. Listing-linked comments retain their listing ID for context but still open the originating Feed post and exact comment thread.
5. Added durable, deduplicated inbox notices for verified Pi payment completion, Marketplace order payments (buyer and seller where applicable), and Marketplace order responses. These are emitted only after authoritative server-side state transitions; notification failure never changes a completed payment/order result.
6. Added target metadata to daily claim and GHC transfer notifications.
7. Added lazy-mount-safe target hand-off and focus for Wallet transaction/PI history, Rewards claim history and Marketplace order timelines; Marketplace order-response notices retain the action/timestamp and scroll to the matching timeline event. Comment replies carry root/parent IDs and the comment sheet pages older responses until the exact reply is found.
8. Added 37 source-contract checks and 20 behavior tests, registered in prebuild, pretypecheck and static verification.
9. Corrected the stale Wallet prebuild assertion to match the actual reserved-withdrawal copy. Regenerated the versioned migration source inventory/verified manifest (without changing or applying SQL) to repair the latest Vercel project-truth gate. Added `.vercelignore` and a 17-point upload-hygiene gate to exclude local dependencies, `.next`/Webpack caches, temp artifacts and local environment files from Vercel source uploads.
10. Bumped package, lockfile and app release identity to 0.338.52.

## Validation

- Run #289 source gates: 37/37.
- Run #289 notification target behavior tests: 20/20.
- Wallet upgrade source gate: 13/13.
- Live Supabase read-only schema check: `gh_posts.listing_id` exists; `gh_notification_inbox_create` and `gh_notification_event_append` exist; notification type constraints do not block the new Marketplace/payment event names.
- Live Testnet has social and economy projection triggers; existing social rows are projected into the unified inbox. The inbox-create RPC is service-role backed, deduplicates, and suppresses self/blocked recipients. No migration was needed or applied.
- `scripts/check-project-truth.mjs`: 11/11; `scripts/check-vercel-build-hygiene.mjs`: 17/17; `scripts/check-wallet-upgrades-source.mjs`: 13/13.
- Full Node 24.15.0 dependency-backed typecheck/lint/production build and browser/device acceptance are not certified in this environment.

## Environment and release boundaries

The connected GitHub `testnet` branch is behind this local archive at package version 0.338.51; Vercel is connected to that branch, not this candidate. The newest inspected Vercel deployment failed at `check-project-truth` because the migration inventory/verified manifest was stale; an earlier deployment failed at the Wallet source-copy assertion. Both source gates now pass in this archive. Vercel logs also reported a 4.87 GB build input and multi-gigabyte Webpack cache packs; `.vercelignore` now excludes local `.next`, dependencies and caches, while the existing prebuild cache-cleanup script remains in place. This is a source-level mitigation only; no new Vercel build was run. This archive has not been pushed to GitHub or deployed to Vercel. No SQL migration, Testnet financial mutation, Pi payment, payout, Mainnet operation or production release was performed. Production remains NOT APPROVED.

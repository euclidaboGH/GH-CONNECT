# GH-CONNECT 0.61.7 — Phase 17 source upgrade (repository-only)

## Private media work included

- New durable `gh_post_media` relation with foreign keys, deny-all client RLS, and service-role-only attach RPC.
- Viewer-aware media authorization checks the session-derived viewer against current post visibility, follow/mutual state, blocks, community membership, story audience/expiry, public profile visibility, active conversation membership, and active marketplace listings.
- New uploads no longer persist a public storage URL and no longer return the raw storage path. They return an opaque media ID and a stable application delivery URL.
- Signed URLs are issued only after viewer authorization and remain five-minute, no-store delivery tokens. Consumers persist stable application references, not expiring signed URLs.
- Migration backfills post-to-media references from known legacy public URLs and rewrites known references across posts, stories, profiles, messaging metadata, public identities and marketplace listing metadata.
- Post creation persists durable media IDs and fails closed if attachment authorization cannot be persisted.

## Verified tip settlement work included

- Tip API now creates and durably binds a Pi payment intent to the tip intent.
- GHC tips are explicitly rejected until an atomic, balance-funded GHC transfer path exists; no GHC ledger side effects were added.
- Payment completion re-queries the Pi provider and requires completed status, verified transaction, exact amount and matching transaction ID before invoking idempotent tip settlement.
- Tip settlement creates a durable creator payable (`payable`) and marks the tip as settled only after provider verification. It does **not** claim that the creator has been paid and does not mutate GHC balances.

## Payout reconciliation work included

- Added provider-evidence records for PI payout reconciliation.
- The PI reconciliation endpoint requires privileged `GHC_PAYOUT_RECONCILIATION_KEY`, queries the Pi API, and verifies request ID metadata, exact amount, seller's mapped Pi UID, completed status and verified transaction.
- `gh_seller_payout_transition(..., 'paid', ...)` now requires a matching confirmed reconciliation row. A free-form reference alone cannot mark a payout paid.
- The adapter intentionally does not reconcile GHC or bank payout rails. Those remain pending until dedicated verified adapters exist.

## Critical cutover and verification limits

- **Do not flip `gh-media` to private yet.** This source upgrade adds broad viewer authorization and migrates known URLs, but the migration must first be reviewed against actual deployed schemas and data. Unregistered legacy URLs, any additional asset-bearing tables, and client components must be audited in the target project. Run the release gate on Testnet, including two-user tests for every audience type, blocked users, expired stories, group conversations, and active/removed listings.
- Existing legacy URLs whose assets are not represented in `gh_media_assets` cannot be converted by URL matching alone. Inventory and import those objects before private-bucket cutover.
- The two new migrations are source-only. No Supabase migration, bucket setting, Pi payout, live settlement, Git push, or deployment was performed.
- Creator reward pool funding and distribution are deliberately not enabled in this phase. Do not activate creator reward credits until a separately reviewed, atomic reserve-funded GHC settlement RPC and concurrent Testnet evidence exist.
- Full `npm ci`, typecheck, lint and production build could not be completed in this environment because dependencies were not available in the local npm cache and registry access timed out. Source regression tests and migration inventory checks were run.

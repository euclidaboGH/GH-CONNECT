# GreenHaven Phase 1 — Core Architecture & State Authority

Date: 2026-10-15

## Implemented
- Added canonical `PostEditMedia` contract to `lib/ghc-types.ts`.
- Updated `EnhancedPostCard` to consume the shared edit-media contract instead of declaring a private duplicate type.
- Updated `OwnPostCard` so Profile and Feed expose the same post-edit contract, including image/video edits.
- Updated Profile timeline edit forwarding to pass media changes through to the existing authoritative `feed.editPost` mutation.
- Preserved the existing server/domain mutation path; no wallet, rewards, membership, Pi payment, Supabase schema, or economy behavior changed.

## Why this was required
Profile previously narrowed `onEdit` to `(postId, content)` while the canonical post editor supports `(postId, content, media)`. That made the same post entity have different edit capabilities depending on whether it was rendered in Feed or Profile and was the direct source of the Vercel callback-signature regression. Phase 1 removes that contract split instead of masking it with a cast.

## Verification
- `scripts/check-jsx-safety.mjs`: PASS — 613 files scanned.
- Full local `next build`: environment-blocked because this runner has Node 22.16.0 while the lockfile now contains packages requiring newer Node versions, and dependency installation did not complete within the runner window. Vercel is configured separately and should remain the authoritative production build check.

## Phase 1 boundary
This pass intentionally does not change feed ranking, wallet balances, reward settlement, or membership entitlement behavior. Those are handled in later dedicated phases to avoid cross-domain regression.

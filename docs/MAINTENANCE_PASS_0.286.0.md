# Maintenance pass — 0.286.0 (2026-11-03)

## Goals
Stabilize UX clarity, soft-refresh coverage, and production noise without changing financial authority.

## Changes
1. **Post engagement toolbar** — Quality votes (left group) and Respond actions (comment/save/share, right group). Fixes comment control appearing visually glued to downvote.
2. **Rewards centre** — `useSectionRefresh("rewards")` so focus/visibility/wallet events rehydrate claims without manual refresh loops.
3. **Feed components** — `console.log` gated behind non-production.
4. **Stories** — inherits 0.285.0 circular world-class rail.
5. **Messaging** — inherits 0.284.0 inbox name/photo enrichment + PTR.

## Verification
- `node scripts/check-stories-rail-v2.mjs`
- `node scripts/check-phase6-messaging-inbox.mjs`
- `node scripts/check-phase5-shell-release-gate.mjs`
- `node scripts/check-phase5b-video-gapfill.mjs`

## Operator
No new migrations. No Mainnet flag changes.

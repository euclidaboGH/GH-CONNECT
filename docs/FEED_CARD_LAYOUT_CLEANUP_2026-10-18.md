# Feed card and Stories layout cleanup — 2026-10-18

## Changes

- Removed inline comment-body previews from feed cards. Public comments remain available in the dedicated comment sheet after the user selects the comment count/action, reducing visual clutter and keeping the feed scannable.
- Kept a single post-options trigger in the post header. Removed the duplicate options button from the action toolbar; the same action sheet and permissions remain in place.
- Unified the comment count across the compact engagement row and action toolbar using the hydrated engagement count instead of a potentially partial comments array.
- Reduced engagement-summary framing and vertical padding while retaining like/comment/share totals and a compact reaction-count row.
- Capped post-media height at 24rem on mobile and 26rem on larger screens; the existing full-post view remains available for complete media.
- Made Story rail cards responsive (7rem x 10rem on mobile, 8rem x 11rem on larger screens) with tighter spacing and readable story text previews.
- Added `test:feed-card-layout` and included it in `ci:verify`.

## Safety / scope

No database schema, payment, membership, reward, notification, or API behavior was changed. This is a presentation-only cleanup; comments continue to load through the existing comment sheet flow.

## Verification

- `node scripts/test-feed-card-layout.mjs`: 7 checks passed.
- `node scripts/check-jsx-safety.mjs`: passed (640 files scanned).
- `node scripts/test-social-visibility.mjs`: 12 checks passed.
- `node scripts/test-notifications-social.mjs`: 24 checks passed.
- Full Next.js build/typecheck was not run in this environment because `node_modules` is not installed.

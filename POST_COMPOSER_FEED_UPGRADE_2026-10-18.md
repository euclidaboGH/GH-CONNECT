# GreenHaven post composer and feed upgrade — 2026-10-18

## Scope

This is a code-only upgrade on top of the supplied Stories-upgrade project. It does not add or require a Supabase migration.

## Changes

- Made post creation a focused, post-only flow; Story creation remains routed to the dedicated Story creator.
- Removed the device-only “scheduled posts” UI because it did not publish at the scheduled time and was not a real server scheduler.
- Removed cosmetic post-type chips that were not persisted as post metadata. Kept the contextual writing prompt, and made tapping it actually start the draft text.
- Connected the existing Poll composer to the post tool row.
- Fixed saved-draft reopening: the selected draft ID is passed through, content/media are restored from the saved draft, and saving repeatedly updates the same draft instead of creating duplicates. A successfully published saved draft is removed.
- Reset attachment/community state when closing the composer so an attachment cannot accidentally carry into the next post.
- Prevent publishing while media upload is still running. Reject device-only data/blob media from being sent as if it were durable and visible to other people.
- Validate video MIME/size before upload and clearly state the current 4 MB upload-path limitation instead of implying larger uploads work.
- Fixed malformed paragraph nesting around the character count and suggestions; improved accessibility labels and image-preview loading hints.
- Removed an unused community-review status request that was being fired once for every feed card.
- Changed post reward details to fetch only when the user opens the reward sheet, rather than sending a request for every post rendered in the feed.
- Clarified in the reward sheet that votes do not mint GHC by themselves; any rewards shown must come from server-confirmed values.
- Added a static regression script for composer, drafts, media safety, poll integration and feed request behavior; added it to `ci:verify`.

## Verification completed

- TypeScript/TSX syntax parsing: 640 files parsed, zero syntax diagnostics.
- JSX safety: passed.
- Story creator static checks: 12/12 passed.
- Engagement roster security checks: 10/10 passed.
- New post composer/feed checks: 16/16 passed.
- Production safety scan: 21/21 passed.
- Social authorization static scan: 37/37 passed.
- IDOR static scan: 132/132 passed.
- Economy v1.2 checks: 173/173 passed.
- Daily claim/wallet pipeline checks: 35/35 passed.
- Content reward boundaries: 20/20 passed.
- Full static verification (`verify-phase14-static.mjs`): 11/11 suites passed.

## Not verified in this environment

The complete Next.js production build, TypeScript typecheck and ESLint were not run to completion. `npm ci --legacy-peer-deps` stalled in this environment, and dependencies were not available locally. Run these in a networked environment before merging:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:post-composer
npm run test:stories
npm run test:engagement-rosters
npm run verify:static
npm run build
```

## Remaining product limitation

Videos above 4 MB are still blocked by the existing upload path. This change does not pretend to solve that by raising the UI limit. Supporting larger clips properly requires a tested direct-to-storage or resumable-upload flow with authenticated upload authorization, size/type validation, cleanup of abandoned uploads and server-side ownership checks.

## Deployment

No database migration is needed for this change. Deploy to the Vercel Testnet Preview first and test with two accounts, including post creation, audience visibility, draft restore/delete, poll opening, reactions/comments and the reward sheet. Promote only after the full build and live Preview checks pass.

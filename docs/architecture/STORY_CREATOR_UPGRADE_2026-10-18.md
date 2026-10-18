# GreenHaven Stories Creator Upgrade — 2026-10-18

## Product changes

- Replaced the inline, minimal moment composer with a full-screen mobile-first creator.
- Added live rear-camera photo capture where browser permissions/capabilities allow, gallery photo selection, video clip selection, and text-only stories with six branded gradient themes.
- Added caption editing, audience controls, media upload/publish states, clear failure messages, and a global create-hub entry point.
- Changed the feed and create-hub Story actions to open the dedicated creator instead of the legacy unified compose form.
- Upgraded story viewing with immersive media/text layouts, timed progress for non-video stories, swipe and keyboard navigation, private replies, and private-message reactions.
- Loaded the owner-gated story viewer roster from the server and preserved existing local highlights while clearly labelling them as device-local.
- Fixed own-story detection for both the local `current-user` placeholder and the authenticated profile ID.

## Data and privacy changes

- Added `background` to `StoryItem`, local sanitization, hydration, and the story create request.
- API accepts only the six known story background presets; arbitrary client CSS is discarded.
- Added `202610240004_gh_story_creator_upgrade.sql` to persist themes and filter story visibility on the server.
- `everyone`: visible to all authenticated viewers except blocked relationships.
- `followers`: requires the viewer to follow the story owner.
- `friends`: requires reciprocal follow edges in the current durable social graph.
- `private`: owner only.
- `matches-only`: deliberately remains owner-only until the canonical server-side match relation can be safely queried. The new creator does not offer an option it cannot currently enforce.
- Story-list RPC execute permission remains restricted to `service_role`.
- Reactions are sent as private messages; the interface does not pretend a local-only emoji state is a durable reaction record.

## Known infrastructure limits

- The current `/api/media` proxy accepts blobs up to 4 MB. Images are optimized before upload; video clips above 4 MB are rejected clearly. Larger video support requires a separately designed direct-to-storage/resumable upload flow.
- Highlights remain device-local, as in the prior implementation. Durable cross-device highlights need their own owner-authorized API and database lifecycle.
- The story view count is not guessed from local state. Owners can open the server-backed viewer roster.

## Required rollout

1. Review and apply `202610240004_gh_story_creator_upgrade.sql` to Testnet Supabase.
2. Deploy the updated project to the Testnet Preview.
3. Verify create/read behavior with two test accounts: everyone, followers, reciprocal-follow friends, private stories, block behavior, camera denial fallback, image/video upload, text-theme persistence, replies/reactions, and owner-only viewer roster.
4. Only after successful Testnet verification, apply the same reviewed migration to Mainnet Supabase and promote the tested commit.

## Verification status

- Story creator static regression checks: passed.
- Existing social experience and social OS static checks: passed.
- Engagement roster security, social authorization, IDOR static, production safety, and JSX safety checks: passed.
- Modified TypeScript/TSX files passed TypeScript transpilation syntax checks.
- Full Next.js build, complete TypeScript typecheck, ESLint, live browser testing, and live database verification are not yet confirmed. Dependency installation stalled on network access in the current environment; do not treat static checks as a production build pass.

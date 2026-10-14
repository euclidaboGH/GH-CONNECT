# GH-CONNECT Stories, Feed Order & Idle Setup Reminder

Date: 2026-10-14

## Implemented

1. Replaced the small circular story avatars in the Home feed with GreenHaven-branded horizontal oval/rounded landscape Moment cards.
2. The account owner's story/action is always first. Followed accounts and friends follow it, newest first.
3. Removed the old fallback that treated an empty Following list as permission to display all stories. The feed strip now only includes stories from followed accounts/friends and excludes private stories; friend-only stories require a friendship relationship.
4. Moved Moments to the top of feed content. The timeline's post list starts immediately below the stories; Home Command Centre and Trust/Durability information were moved below the post list to reduce visual fragmentation.
5. Replaced the permanently visible Home setup checklist with an idle-only reminder: first appears after 45 seconds without activity, dismisses after 9 seconds, and resets its idle interval. Pointer/touch interaction, keyboard input, scrolling, or visibility changes dismiss/reset it. Tapping the reminder itself does not cause premature dismissal; users can dismiss it explicitly or open setup steps.

## Checks performed

- `node scripts/check-jsx-safety.mjs`: passed, 613 files scanned.
- TypeScript `transpileModule` syntax checks passed for `profile-story-section.tsx`, `enhanced-feed-screen.tsx`, and `home-activation-checklist.tsx`.
- ZIP integrity checked after packaging.

## Not claimed / follow-up

- Full `npm ci`, TypeScript typecheck, ESLint, Next.js production build, live relationship-privacy verification, and real-account end-to-end checks were not run in this workspace because project dependencies are not installed here.
- Relationship lists in this client context are used for display filtering; authoritative story audience permissions must still be enforced by the server/API, not only by client-side filtering.
- Stories are ordered with the owner first, followed by the newest stories from eligible friends/followed accounts. The existing profile-only story presentation remains separate from the Home feed's Moments strip.

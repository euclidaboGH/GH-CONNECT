# GreenHaven upgrade worklog — v0.157.21

Date: 2026-10-28

## Trigger

User-reported runtime symptoms showed four related reliability failures: the notification bell retained unread counts after inbox cleanup; the feed could present an empty state until manual reload; daily GHC claim interactions sometimes needed repeated taps; and upvote/downvote taps opened a shadowed reaction-picker surface instead of recording a vote.

## Findings and changes

1. **Notification count drift:** the bell summed unread counters from overlapping unified, social, economy and announcement stores. The badge now derives from the same unique visible durable notification rows rendered in the inbox, with local-only notifications counted separately. Three redundant count-only requests were removed.
2. **Notification refresh race:** refresh requests were silently discarded when another refresh was in flight. They are now queued and replayed after the active read completes.
3. **Single-read race:** the notification refresh event could fire after the social write but before the unified write settled. Both writes now settle before announcing completion.
4. **Read-all observability:** mark-all now awaits all four stores, refreshes afterward, and reports partial failures instead of unconditionally claiming success.
5. **Feed first-entry hydration:** no mount-time server fetch was guaranteed; the focus listener could miss the initial focus event. The feed now requests the canonical server page on mount.
6. **False empty state:** initial empty state rendering is gated until the first feed request settles, distinguishing a truly empty feed from a not-yet-hydrated feed.
7. **Feed request supersession:** if the mount request is superseded by focus/visibility revalidation, it retries once. Hydration is also rerun when profile identity changes.
8. **Daily claim tap race:** React state alone is not a synchronous duplicate-submit lock. The floating claim prompt, feed claim card and reward sheet now use a ref-based in-flight guard, while the server remains the only authority for reward issuance.
9. **Vote interaction mismatch:** ordinary taps previously toggled the reaction picker; a vote required a 1.2-second hold, causing the apparent shadow-screen behavior. Taps now call the existing authenticated server curation endpoint directly and stop propagation into post navigation.
10. **Voter roster accessibility:** long press now opens the relevant voter roster (650 ms) without submitting a vote; context-menu access remains available.
11. **Stale vote state across cards:** counts and selected vote now reset from canonical post props, including neutral/missing choices, instead of leaking the prior card's state.
12. **Static verification blind spot:** the Phase 1–12 static verifier had a malformed three-item array entry that prevented the build type-regression guard from being registered as its own check. This was corrected and the new 16-check reliability contract was registered in both `prebuild` and the static suite.

## Verification

- Notification center contract: 10/10 passed.
- Daily reward UX contract: 21/21 passed.
- New cross-surface engagement reliability contract: 16/16 passed.
- Deliberate voting contract updated to the tap-to-vote behavior.
- Phase 1–12 consolidation: 24/24 passed.
- Release hygiene: 11/11 passed.
- Project truth: 10/10 passed.
- Migration inventory check: passed; 140 migration files remain classified as 98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL and 39 REVIEW_REQUIRED.

## Operational boundary

These are source-level and static regression checks. They do not prove the deployed Vercel bundle, remote Supabase state, Pi Browser session behavior, or live RPC permissions. The full dependency install, TypeScript check, lint and Next.js production build still need to run under the supported Node.js 24.15.0+ runtime and the live project needs authenticated multi-account smoke tests. No Supabase migrations were added or applied in this increment.

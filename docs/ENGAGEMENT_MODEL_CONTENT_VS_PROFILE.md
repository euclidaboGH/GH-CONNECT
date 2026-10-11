# Engagement model — content vs profile

## Product rule

| Signal | Target | Effect |
|--------|--------|--------|
| **Upvote / Downvote** | **Content (posts)** | Quality ranking; may raise or lower **content reward eligibility** and related reputation signals **on the server**. Never client-mint GHC. |
| **Like / Pass** | **Profiles (people)** | Matching interest. Mutual like can create a match opportunity — not automatic friendship. |

## Implementation (2026-10-11)

- Post cards: primary ThumbsUp / ThumbsDown only for content.
- Post-level Heart "like" removed from feed cards.
- Double-tap media opens **author profile** (where Like/Pass live).
- Quick-reaction heart maps to **content upvote**.
- Discover / profile preview / relationship actions: Like & Pass for people.

## Safety

- Votes do not insert ledger rows from the client.
- Content reward amounts only when server `enabled` + accrual state.
- Profile swipe/like uses existing connection graph APIs.

# Social comments & reactions — server-first (2026-10-18)

## Problem
Comments and emoji reactions were applied **locally first**, then dual-written. If the durable write failed, the author still saw success while **other accounts never saw** the comment or reaction.

## Fix
1. **`addComment`** — call `socialAddComment` first; update UI only on `ok` + `durable`; honest errors otherwise.
2. **`addCommentReaction`** — POST reactions API first; same durable gate.
3. **`loadPostComments`** — when durable, server list is authoritative (no phantom local-only rows).
4. **Comment sheet** — reload after post; listen for `ghc:social-mutation`.
5. **GET** comment reactions for cross-account counts.

## Not claimed
Live two-account verification still requires Testnet + migrations (`gh_comment_*`, engagement rosters).

## Test
`npm run test:comment-server-first`

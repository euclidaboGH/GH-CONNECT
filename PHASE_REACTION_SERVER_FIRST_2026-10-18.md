# Post likes, reactions & curation — server-first (2026-10-18)

## Problem
`reactToPost` applied optimistic local like state first, then dual-wrote. Network failures kept local-only likes that other accounts never saw.

## Fix
- **reactToPost / likePost**: `socialToggleReaction` first; UI only on `ok` + `durable`
- Counts prefer server `likeCount` / `reactionCounts`
- **Curation votes**: reject `durable === false` before updating UI
- Story reactions already required durable (unchanged)

## Tests
`npm run test:reaction-server-first`
`npm run test:comment-server-first`
`npm run test:connection-server-first`

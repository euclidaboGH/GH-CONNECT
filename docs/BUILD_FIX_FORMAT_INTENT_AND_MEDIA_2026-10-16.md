# Build fix — formatIntentChip + realImages type narrowing

## Errors
1. `connection-card.tsx`: `Cannot find name 'formatIntentChip'` — usage without import of `@/lib/discovery/match-clarity`.
2. `enhanced-post-card.tsx`: `Property 'startsWith' does not exist on type 'never'` — combining `isDurableMediaUrl` type predicate with `u.startsWith` after false branch narrowed `string` to `never`.

## Fixes
1. Import `{ MATCH_CLARITY, formatIntentChip }` from `@/lib/discovery/match-clarity`.
2. Rewrite `realImages` filter to check `typeof u === "string"` first, then data: / durable without conflicting predicate order.
3. Remove duplicate `case "like"` / `case "pass"` in `labelForAction`.

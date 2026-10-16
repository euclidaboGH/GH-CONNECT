# Build fix — isDurableMediaUrl type predicate

## Error
`profile-story-section.tsx`: `Property 'startsWith' does not exist on type 'never'`
when combining `isDurableMediaUrl(url) || url.startsWith(...)`.

## Root cause
`isDurableMediaUrl` was declared `url is string`. On a value already typed as `string`, a failed check narrowed the type to `never`.

## Fix
- Change `isDurableMediaUrl` to return `boolean` (not a type predicate).
- Update `filterDurableUrls` to use an explicit `u is string` filter.
- Keep explicit `typeof ... === "string"` checks at call sites that also allow `data:` URLs.

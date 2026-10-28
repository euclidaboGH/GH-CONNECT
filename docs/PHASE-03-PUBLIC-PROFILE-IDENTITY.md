# Phase 3 — Public Profile Identity Hydration

Release baseline: **v0.157.2**

## Implementation

- Shared server-side hydration is wired into feed posts, post detail, comments, profile timelines, stories, and social search.
- The helper selects only `gh_user_id`, `display_name`, `username`, and `photos` from the server-only profile store.
- Nested `comments`, `replies`, and `children` arrays are hydrated using one bounded identity lookup per invocation, with maximum traversal depth 12, maximum 500 visited rows, at most 100 distinct IDs per lookup, a 1 MiB upstream response bound, and a 5-second timeout.
- Legacy avatar fallback values are validated against the public URL policy before they are copied into hydrated avatar aliases.
- Hydration remains best-effort; failed or malformed profile reads preserve the social response and never grant visibility or change ownership.

## Source verification

Run `npm run check:phase3-profile-identity`. The source contract now checks nested traversal bounds and avatar fallback sanitation in addition to the existing surface integration, public-field projection, timeout, response-size, and identity-scope checks.

## Acceptance still required

Run the application using supported Node.js `24.15.0`; execute install, typecheck, lint, production build, and browser journeys. Test missing/incomplete profiles, nested replies, malformed avatar schemes, profile read timeout/5xx, and identity records from multiple test accounts. Confirm live Testnet migration state before deploying. No live database or provider was contacted or changed during this source upgrade.

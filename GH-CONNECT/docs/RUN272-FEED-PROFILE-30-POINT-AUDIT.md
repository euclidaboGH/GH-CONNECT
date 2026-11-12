# Run #272 — Feed, Profile, post-card and comment-thread upgrade audit

**Release:** `0.338.33`  
**Date:** 2026-11-10  
**Working baseline:** Run #271 / `0.338.32`  
**Scope:** Feed, profile timelines and details, shared post cards, comments/replies, local preference isolation, Supabase Testnet and Vercel build reliability.

## 30 delivered product and engineering improvements

1. Replaced the global feed-filter storage key with a versioned, authenticated-account namespace.
2. Moved feed location-lane, intention-bias and focus-mode preferences into the same account-scoped record.
3. Removed reads of legacy unscoped feed-filter keys so another account on the same device cannot inherit them.
4. Moved hidden-post IDs to an account-specific key and capped the persisted list at 200 IDs.
5. Subscribed to the canonical identity signal and added a preference-hydration owner fence so a newly selected account cannot overwrite its stored preferences with the previous account's state.
6. Prevented feed ranking from publishing stale results while the current account's preferences are hydrating.
7. Kept “not interested” post IDs account-scoped and prevented anonymous-session persistence.
8. Added a separate hydration fence for muted-topic preferences to prevent cross-account writes during identity changes.
9. Reset saved-post state and the account-scoped draft list before loading a new account's saved posts/drafts; draft-change events are fenced to the current identity.
10. Verify the authenticated identity again before applying a saved-post response, discarding late responses from the previous account.
11. Keep speculative media prefetch disabled when either the in-app reduced-data setting or the device Data Saver preference is active.
12. Stop periodic feed refresh while the browser is offline or the document is hidden.
13. Added a synchronous per-post save lock to prevent rapid double taps from issuing overlapping save/unsave mutations.
14. Retained the existing synchronous feed-pagination lock across the asynchronous page request.
15. Preserved the feed's distinct loading, empty and error states with an actionable retry rather than conflating a failed load with an empty feed.
16. Preserved the unranked-post fallback when ranking fails, so a ranking dependency outage does not silently erase otherwise readable posts.
17. Bound profile timeline rendering to the reactive canonical identity owner ID; stale cached timeline rows are not rendered during account transitions.
18. Clear profile timeline rows, cursor, loading state and errors when the authenticated identity disappears; the shared GHC context also aborts old-owner feed requests and clears cached feed/like snapshots on identity changes.
19. Abort first-page profile requests on unmount or identity change.
20. Abort in-flight profile pagination when the account changes.
21. Added a synchronous profile-pagination lock so repeated taps cannot issue duplicate cursor requests before React state commits.
22. Retained stable-ID deduplication when appending profile timeline pages.
23. Replaced raw backend exception text in the profile timeline with bounded, user-safe retry messages while retaining diagnostic logging.
24. Require a real profile-update function before starting profile-photo or cover uploads; no upload can report success when the profile persistence seam is missing.
25. Await profile-photo and cover-photo updates before showing success feedback.
26. Await profile-photo and cover removal mutations and show an error when durable persistence fails.
27. Filter blocked comment authors before constructing the reply tree, rather than filtering only root comments.
28. Suppress the full descendant reply branch of a blocked comment so blocked content cannot leak through nested replies.
29. Make comment-tree construction resilient to missing parents and malformed parent cycles; visible comments are promoted to roots instead of disappearing or producing an unrenderable cycle.
30. Normalize missing/non-finite comment timestamps to a stable value instead of calling `Date.now()` during every tree build, preventing order jitter.

## Supabase Testnet change

Applied Testnet-only migration `20261110193134_social_feed_profile_rpc_search_path_hardening` using the connected Supabase migration operation. The generated history version is `20261110193134`; the canonical source file is `supabase/migrations/20261110193134_social_feed_profile_rpc_search_path_hardening.sql`.

- `gh_post_feed_engagement_batch(text[], text)` now pins `search_path=pg_catalog, public, pg_temp`.
- `gh_comment_reaction_list(text)` now pins `search_path=pg_catalog, public, pg_temp`.
- Existing `postgres` and `service_role` execution grants are unchanged; `anon` and `authenticated` remain denied.
- No table data, balances, ledger entries, post/comment rows, media objects or index definitions were changed.
- The active feed, profile-content and comment-list RPCs were reviewed. Their existing keyset indexes were already present, so no speculative index was added.
- Testnet migration history is now **19 generated records versus 216 canonical source migration files**. This remains a material source/remote history discrepancy. Do not run `supabase db push`, migration repair or bulk replay. Mainnet is inactive and untouched.

## Supabase postflight and runtime observations

- Public tables: 140/140 retain RLS.
- Client-role table write/DDL-adjacent grants: 0/140; client sequence privileges: 0/9.
- The two changed RPCs were read back with the pinned search path and the original service-role-only ACL.
- Health advisor: 0 lints. Security advisor: only 13 intentional RLS-enabled/no-policy INFO findings. Performance advisor: 113 unused-index candidates on low-traffic Testnet; none were removed.
- Last-24-hour edge-log query: no 4xx/5xx results for the checked feed, profile, post-comment or related RPC paths. Matching PostgreSQL/PostgREST error-level query: no rows.
- Observed p95 origin times: feed page ~384 ms (109 requests), feed engagement batch ~342 ms (109 requests), profile timeline ~347 ms (34 requests), comment-list sample ~339 ms (1 request). These are small-window observations, not a load-test result.

## Vercel build diagnosis and changes

The latest inspected Testnet preview deployment is `dpl_3iemE4b7Zd83RSqAe4roUuJ1gkLY`, commit `9a1e970a0e307430f24f6358c3b2229295ccb870` on `testnet`; it predates Run #272. Vercel build events report the Next.js build worker being killed with `SIGKILL` during production compilation. The build report showed approximately 6.1 GB of source/build input, 756 MB of installed dependencies, and oversized restored Webpack server-production cache packs (individual packs exceeding 1 GB). This is the underlying OOM condition behind `BUILD_UTILS_SPAWN_1`, not one of the passing S1 feed or provider-error helper checks.

Run #272 changes:

- Added `scripts/prepare-vercel-build.mjs`, which removes only the stale `.next/cache/webpack` directory before the build, refuses symlink traversal and leaves source/application output untouched.
- Added the cleanup step to the Vercel build command before `npm run build`.
- Disabled persistent production Webpack caching while retaining the one-CPU, `webpackMemoryOptimizations` and explicit build-worker settings. This trades some build-cache speed for predictable memory use and avoids regenerating the oversized persistent cache packs.
- Added exact-version npm install-script approvals for the reviewed `sodium-native@3.4.1` native binding build and `unrs-resolver@1.12.2` platform resolver setup. No wildcard approval was added.
- Verified that the Vercel project has no project-level `NPM_CONFIG_CACHE_DIR`/`npm_config_cache_dir` variable. The build command continues to unset both aliases. The visible install warning therefore was not caused by a project-scoped environment variable.

The OOM mitigation is implemented in source but is **not yet verified by a new Vercel build**, because Run #272 has not been pushed/deployed. A larger Vercel build machine could be evaluated if a clean-cache build still OOMs; changing to an enhanced/turbo machine can affect billing and was not done.

## Dependency-warning disposition

- `sodium-native@3.4.1` and `unrs-resolver@1.12.2`: exact versions reviewed and added to npm's script allowlist.
- `isomorphic-dompurify@3.20.0`: deprecation warning remains. The registry was unavailable from the working environment, so the package and lockfile were not manually edited or given a guessed integrity hash. A coordinated 4.x lockfile update and sanitizer regression run remain required.
- `js-xdr`, `stellar-base` and `stellar-sdk`: these are transitive through the pinned Pi backend SDK dependency. Replacing them with the renamed `@stellar/*` packages without an upstream-compatible Pi SDK release would risk breaking Pi payment/signing paths; no unsafe override was added.
- `eslint@9.39.5`: upstream marks this release unsupported. The current Next 15 lint configuration is paired with ESLint 9; a Next 16 + ESLint 10 migration is a separate major-framework upgrade and was not mixed into this social release without dependency-backed tests.
- The `cache-dir` npm warning is not explained by any project environment variable or repository `.npmrc`; both environment aliases remain explicitly unset in the Vercel install/build commands.

## Verification and limits

Run #272 includes a 48/48 static Feed/Profile contract, 8/8 executable comment-tree tests, 4/4 Vercel cache-cleanup tests, and syntax-only transpilation of all five changed TypeScript/TSX modules with zero duplicate/initialization diagnostics. The complete `npm run verify:static` suite passes **57/57**; the prebuild runner discovers **300 checks** (dry-run only in this Node 22 environment). Syntax-only TypeScript transpilation is not a semantic typecheck. The working container provides Node 22.16.0 while the project requires Node 24.15.0, `node_modules` is absent, and the npm registry is unavailable; therefore a dependency-backed `tsc`, ESLint run and Next.js production build are not claimed. The latest Vercel deployment is still on an older GitHub commit. Browser/device, screen-reader, two-account identity-switch and high-volume load acceptance remain open. Production remains **NOT APPROVED**.

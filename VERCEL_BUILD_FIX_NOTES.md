# Vercel build fix notes

Applied fixes for the supplied deployment log:

1. `components/ghc/profile-screen.tsx`: made the `media` callback parameter optional, matching `OwnPostCard`'s declared callback type while preserving media forwarding to `feed.editPost`.
2. Replaced the flat ESLint config with `.eslintrc.json` using the same Next.js Core Web Vitals preset and project rules. The deployment log's `nextVitals is not iterable` occurred during ESLint setup; the project now explicitly uses ESLint's legacy config mode for Next.js 15 / ESLint 9 compatibility.
3. Updated `build`, `vercel-build`, and `lint` scripts to set `ESLINT_USE_FLAT_CONFIG=false` so local linting and Vercel builds use the same configuration mode.

Validation note: these changes were applied to the uploaded source archive, but a full `npm ci` / `npm run build` was not executed in this environment. Re-run the build on Vercel to confirm. npm audit vulnerabilities and package deprecation warnings were not auto-fixed because doing so could introduce unrelated breaking changes.

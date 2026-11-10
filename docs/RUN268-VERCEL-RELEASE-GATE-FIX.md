# Run #268 — Vercel release-version gate repair

**Source release:** `0.338.29`  
**Scope:** source metadata and regression gate only

The Vercel Testnet build for `0.338.28` stopped during prebuild check 15/293. The underlying failing assertion was `Phase 1 P1-A`: package version, `APP_RELEASE_VERSION`, and the current package version recorded in the consolidated audit register must agree. The `BUILD_UTILS_SPAWN_1` line was only the build wrapper reporting the non-zero prebuild exit. Vercel's report explicitly found no memory or disk-space problem; the webpack cache sizes were not the cause of this build failure.

The current `0.338.29` source already has matching package, lockfile and app release values. Its consolidated audit register still incorrectly labelled `0.338.27` as the current package and current derivative. Updated those current pointers to `0.338.29` / Runs #250–267 and clarified that the older `0.338.18` baseline and `0.338.27` snapshot are historical references. No historical findings were deleted.

Validation:

- `scripts/check-phase1-10-upgrade-pack.mjs`: **20/20 passed** (including P1-A).
- `scripts/check-run267-header-wallet-auth.mjs`: **12/12 passed**.
- `scripts/check-doc-hygiene.mjs`: **passed** after registering the five existing Run #263/#265/#266/#267/RUN264 documents and the new Run #268 report.
- Package, lockfile root, app release and consolidated audit version agreement: **passed** at `0.338.29`.
- Release hygiene: **13/13 passed**; project truth: **11/11 passed**.
- Full prebuild / production build: **not verified in this environment**. The available Node runtime is `22.16.0` while the project requires `^24.15.0`; the extracted source has no installed `node_modules`. Do not treat the targeted checks as a substitute for the supported-runtime Vercel build.

No Supabase migration was applied, no financial or identity data was changed, no Pi payment or payout was initiated, no Vercel deployment was performed, and production remains **NOT APPROVED**.

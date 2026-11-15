# Current source authority — Run #310 / 0.338.73 (2026-11-15)

**Current working candidate:** `0.338.73`, derived from Run #309 / `0.338.72`.
**Current source version:** `0.338.73`
**Package identity:** `gh-connect@0.338.73` (the user-facing brand remains GREENHAVEN).
**Original uploaded authority:** `GREENHAVEN-0.338.72-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-14.zip`, SHA-256 `d8271fb74d1440e6397346e5b8e346de538923d3938470eac5f46feb2ec71f3c`. The 0.338.73 candidate is a derived upgrade; it supersedes the working candidate only after user acceptance.

Run #310 continues Phase 6 performance/accessibility hardening. The feed route executes independent visibility, preference and mute reads concurrently, retaining fail-closed privacy behavior. Post-author and comment-author profile hydration now run as concurrent bounded batches; the canonical public profile field allowlist, 500-row/12-depth/100-identity limits, 1 MiB response bound and 5-second upstream timeout remain. Raw-page cursor progression is unchanged. Added a 23/23 Phase 6 source gate and Playwright checks for reduced motion, narrow-to-desktop overflow, keyboard focus traversal and offline/reconnect announcements. RUM CLS tracking now uses a constant-memory session-window accumulator rather than retaining up to 500 layout-shift objects per surface. Bounded INP retention now replaces fast early samples with later slower interactions, improving the capped sample set. Regression tests cover both changes.

No new migration was added or applied. No Supabase schema/data, wallet, GHC or Pi financial state was changed. No GitHub push, pull request or Vercel deployment occurred.

**Verification:** Phase 6 focused source gate 23/23 PASS; Core Web Vitals budget tests 16/16 PASS; privacy-safe RUM contract 17/17 PASS. Targeted build-memory and Vercel build-hygiene checks also pass. Full supported-runtime verification is not available in this environment; details are recorded in `docs/UPGRADE-WORKLOG-0.338.73.md`. Supported Node 24.15.0 dependency-backed typecheck/lint/build and Playwright browser execution remain unverified in this Node 22.16.0 dependency-free workspace. Authenticated two-account, Android/Pi Browser, device/network performance, live database/RPC and Vercel Preview acceptance remain outstanding. Phase 6 is **NOT ACCEPTED** and production remains **NOT APPROVED**.

Historical and legacy documents remain preserved for audit context; they do not override this current source authority. See `docs/UPGRADE-WORKLOG-0.338.73.md` and `docs/GREENHAVEN-SOCIAL-EXPERIENCE-TRANSFORMATION-ROADMAP-2026-11-14.md`.

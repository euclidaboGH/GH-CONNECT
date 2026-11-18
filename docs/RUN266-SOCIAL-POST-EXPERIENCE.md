# Run #266 — Social post experience

**Release:** 0.338.28  
**Scope:** Feed, Profile and Community post presentation and engagement controls.

## Implementation

- Kept `EnhancedPostCard` as the canonical shared renderer and added a typed `surface` contract (`feed`, `profile`, `community`).
- Migrated the canonical wrapper call sites to explicit surface identity; existing legacy community-board entries remain read-only until republished, preserving their current policy.
- Replaced the post root's redundant `div role=article` with semantic `<article>` markup. Retained keyboard opening, nested-control click exclusion and visible focus treatment.
- Refined the author header for narrow layouts, text wrapping, action spacing and post metadata readability. The card only advertises a pointer cursor when a post-open handler exists.
- Reworked the engagement dock into a quality-vote row and a separate Comment / Save / Share action row. Small screens receive a stable three-column layout; larger screens receive a compact right-aligned group. Primary controls retain 44px minimum height.
- Changed share feedback to “Share options opened” rather than “Sent”, because opening a share sheet is not evidence that a share completed.
- Preserved durable-media URL checks, safe external-link rendering, server-backed engagement callbacks, moderation controls, visibility logic, rewards boundaries and the single `UnifiedCompose` entry.

## Verification

- `scripts/check-run266-social-post-experience.mjs`: 14/14 passed.
- TypeScript `transpileModule` syntax checks: 5/5 changed TSX files passed.
- No dependency changes or database migrations.
- Full typecheck, lint and production build were not run: this working environment has Node 22.16.0 while the project requires Node 24.15.0, and dependency installation is not available here.
- Visual acceptance at 320px / 360px / tablet / desktop, Pi Browser, reduced-motion, screen reader and two-account permission tests remain required.

## Release status

Source implementation only. Not deployed to Vercel. No Supabase changes. Production remains NOT APPROVED until all outstanding release gates pass.

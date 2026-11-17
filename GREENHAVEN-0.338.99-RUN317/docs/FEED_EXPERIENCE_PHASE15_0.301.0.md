# Phase 15 — Feed experience refinement (0.301.0)

## Product changes

- Simplified the shared feed/profile composer to one clear post-entry control and two media shortcuts.
- Removed the redundant feeling shortcut and decorative gradient treatment.
- Reduced between-post discovery prompts from every eight posts to every twelve posts.
- Limited prompts to the For You feed and suppressed them in focus mode.
- Reworked the people-discovery prompt as a compact inline row rather than a standalone promotional card.

## Preserved contracts

- The composer still opens the canonical Create Hub / UnifiedCompose flow. No second publisher or client-side post persistence was introduced.
- Feed ranking, pagination, server hydration, moderation, media authorization, and post engagement behavior are unchanged.
- No database migration, auth, wallet, GHC, Pi, payment, or financial behavior changed.

## Verification boundary

The Phase 15 regression script validates source-level composition, discovery cadence, focus-mode suppression, and release registration. It does not establish browser/device visual acceptance or a supported-runtime production build.

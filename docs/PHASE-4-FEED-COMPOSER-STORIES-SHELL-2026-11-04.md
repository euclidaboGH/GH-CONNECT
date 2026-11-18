# Phase 4 — Feed composer, stories rail, shell consistency

**Baseline:** Phase 3 communities membership  
**Date:** 4 November 2026  

## Critical fix

Soft-refresh listeners were registered **inside `FeedSkeleton`**, so they only ran while the loading skeleton was mounted. Auto-refresh on tab focus / visibility did not work after the first load.

## Changes

1. **Feed soft-refresh on the live screen**
   - `visibilitychange`, `window focus`, `ghc:prefetch-tab`
   - `useSectionRefresh` also listens for `ghc:feed-soft-revalidate`
   - 45s recovery poll when visible

2. **Composer prompt bar (premium)**
   - Card shadow, 11px avatar ring
   - Photo / Video / **Story** quick actions on feed
   - Placeholder: "What's happening in GreenHaven?"

3. **Stories rail**
   - Removed duplicate header **Create** button (single path via card)
   - Long-press / context menu on own story → add another
   - Unseen stories: emerald ring treatment
   - Header hint: "Tap your story · hold to add" / "Disappear in 24h"

4. **Shell**
   - Sticky filter toolbar with backdrop blur
   - Tighter stories → composer spacing

## Verify

```bash
node scripts/check-phase4-feed-composer-stories-shell-2026-11-04.mjs
```

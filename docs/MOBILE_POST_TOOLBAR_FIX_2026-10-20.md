# Mobile post toolbar overflow fix (2026-10-20)

## Problem
On ~360px phones, the post engagement row (Vote weight + up + down + comment + save + share) overflowed horizontally. Share and Save were clipped behind the screen edge on Feed and Profile.

## Fix
- Compact curation controls (smaller padding/icons; weight label screen-reader-only on the smallest widths).
- Split clusters: curation (flex-1 min-w-0) vs response actions (shrink-0 ml-auto) so Comment / Save / Share never get crushed off-screen.
- Card `overflow-x-hidden max-w-full`; feed/profile containers `min-w-0`.
- Global `.gh-post-card` / shell overflow-x guards in `app/globals.css`.
- Slightly reduced card horizontal padding on phones (`px-3` → `sm:px-4`).

## Scope
Shared `EnhancedPostCard` — Feed and Profile both benefit. No API or ranking changes.

# Phase 13 — Social Stories and Profile Media Experience

Release: `0.299.0` · 2026-11-03

## Objective

Replace the over-designed Stories presentation with a familiar, low-friction social story rail and make profile/cover/story media viewable at full size before users choose to replace it.

## Implemented

- Rebuilt the Stories rail as compact, vertical story cards with a single create-story entry, restrained borders, readable labels, clear unseen rings, and horizontal touch scrolling.
- Removed the previous oversized circular avatar-bubble presentation and redundant create controls from the rail.
- Kept the existing server-backed story publishing, audience selection, replies, reactions, viewer list, expiry, and navigation behavior intact.
- Fixed story viewing for private-media facade references by resolving them through the existing viewer-authorized media URL service before rendering image/video content.
- Preserved full-screen story media with `object-contain`, so portrait, landscape, and square originals are not cropped by the viewer.
- Separated profile/cover photo viewing from editing. Tapping an existing profile photo or cover opens the shared full-screen lightbox; dedicated camera controls open the upload/remove action sheet.
- Reused the existing media lightbox for full-size viewing, keyboard close/navigation, modal semantics, scroll locking, and media actions rather than introducing a second viewer implementation.
- Added a 13-assertion static UX contract check and registered it in `prebuild` and `verify:static`.

## Preserved boundaries

- No database schema, Supabase RLS, storage bucket, upload authorization, identity, Pi SDK, wallet, GHC ledger, or payment semantics were changed.
- Story audience enforcement and server authorization remain owned by the existing domain/API layer.
- Existing media upload compression and durable-media facade contracts remain unchanged.

## Verification boundary

The new source-level UX contract check passes 13/13. Full static verification, TypeScript, lint, production build, mobile browser testing, Pi Browser testing, screen-reader testing, and live private-media authorization checks must still be run in the supported Node.js `24.15.0` environment before production approval.

## Design references

- Meta's December 2025 Facebook experience update describes simplifying Story creation and feed interactions, making core actions prominent, and showing media in a more immersive full-screen view: https://about.fb.com/news/2025/12/making-it-easier-to-create-discover-and-share-content-on-facebook/
- Meta's accessibility design-system guidance highlights consistent, perceivable Story rings and scalable interaction standards: https://www.meta.com/design-at-meta/blog/accessibility-and-design-systems/
- Vercel's Web Interface Guidelines recommend keyboard-operable interactions, visible focus, managed overlays, and 44px mobile touch targets: https://vercel.com/design/guidelines

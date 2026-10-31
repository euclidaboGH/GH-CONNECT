# 0.147.0 — Media full-view + post-media honesty + curation contribution clarity

## Media (feed / post card)
1. MediaLightbox upgraded: portal, z-index 220, body scroll lock, Escape / backdrop close.
2. Gallery support (urls[] + index) with prev/next and keyboard arrows.
3. Video full-screen via DurableVideo (controls + autoplay) inside lightbox.
4. Signed-url resolution inside lightbox for private /api/media facade paths.
5. Post card media tap opens lightbox instead of the jammed post-detail sheet.
6. Video tap opens lightbox (not post sheet).
7. LazyImage `variant="post-media"`: neutral "Media unavailable" + Retry — never shows misleading "PI" initials on broken photos.
8. Extra signed-url retries (up to 2) before error state.
9. Keyboard Enter/Space on gallery opens lightbox.
10. Caption shows author context in the viewer chrome.

## Feed wiring
11. EnhancedFeedScreen lightbox state supports multi-item gallery + video kind.
12. onOpenMedia prop threaded from feed → EnhancedPostCard.
13. PostDetailSheet string onOpenMedia remains compatible with single-url mode.

## Curation
14. Non-owner weight label soft-copy ("Support") — voting remains available to everyone.
15. Long-press vote path unchanged (quality signal); funded contribution still server-authoritative.
16. Insights / reward panel remains readable; views stay lifetime once-per-user (attention-client).

## Safety
17. No ledger / auth / RLS changes.
18. Fail-soft media: missing signed URL falls back to facade path then honest unavailable tile.
19. Body overflow restored on lightbox close.
20. Transient UI close bus still dismisses lightbox on section change.

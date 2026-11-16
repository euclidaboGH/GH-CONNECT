# Upgrade worklog — 0.330.19

Date: 2026-11-07

## Phase 1 — Feed product transformation, completion increment

### Product work completed in source

- **Content presentation:** Retained the canonical rich post card and strengthened feed-side creator discovery using unique authors from the currently ranked, already-visible feed. Profile actions route through the existing profile event; no fake creator cards or fabricated identity metadata are introduced. Community discovery chips are derived only from community metadata on visible ranked posts and route into the existing Communities surface.
- **Composer:** Improved the entry-point hierarchy, touch target size, accessible action names and audience-selection explanation. The single `UnifiedCompose` remains authoritative for public/followers/mutuals/private audience selection, draft restoration, media upload, preview and publishing lifecycle; no duplicate composer or publisher was added.
- **Discovery:** Feed topics remain derived from currently ranked post hashtags. Creator and community suggestions are deterministic, deduplicated and bounded; all are based on content the viewer can already see.
- **Performance:** Infinite-scroll observation now uses the feed's actual scroll container, a bounded prefetch root margin and a manual fallback for WebViews without `IntersectionObserver`. Feed data-saver control uses the shared device-local reduced-data policy; browser/network save-data and slow-connection signals continue to take priority. Noncritical media prefetch is suppressed in reduced-data mode and remains bounded.
- **Quality:** Added accessible labels and focusable controls to creator/community exploration and composer quick actions. Existing semantic/keyboard-operable post cards, privacy filtering, moderation, signed media URLs and server cursor pagination remain authoritative.

### Boundaries preserved

No new API authority, database migration, financial/ledger mutation, authentication change, privacy relaxation, synthetic engagement, seeded discovery data or parallel composer was introduced. Existing post creation, audience enforcement, media upload, draft persistence, edit/delete, reactions, comments, sharing, saves, curation and reconciliation remain on their canonical paths.

### Verification

A new 26-point Phase 1 completion contract is registered in `prebuild` and `verify:static`. It covers presentation, discovery provenance, audience controls, drafts/publishing lifecycle, reduced-data behavior, observer fallback, cursor pagination, accessibility and release identity. Node 24.15.x typecheck, lint, production build, browser/device/Pi Browser/WebView and live Supabase acceptance remain external release gates. Production remains NOT APPROVED until those gates pass.

# Upgrade worklog — 0.330.18

Date: 2026-11-07

## Phase 1 — Feed product transformation, increment 1

### Audit baseline

The 0.330.17 source already contains a canonical Feed screen (`EnhancedFeedScreen`), one shared `UnifiedCompose` flow, a shared `EnhancedPostCard`, server-backed social APIs, feed ranking, privacy/visibility policy, mute/block filtering, saved-post support, feed reconciliation, drafts, media upload, pull-to-refresh, soft revalidation, offline/error/empty states and bounded media prefetch. Existing source regression gates passed before this increment: Phase 1 deep completion 19/19, Feed experience 12/12, feed reconciliation 12/12, post/curation production 12/12, and Feed/composer/stories shell 12/12.

### Implemented

1. Corrected Saved as a first-class persisted feed lane: it is now accepted during preference restoration and saved whenever the active feed filter changes.
2. Added a filter-change handler that resets the page window and returns the scroll container to the top, preventing a newly selected lane from opening at an unrelated scroll/pagination offset.
3. Added a compact “Explore conversations” rail sourced exclusively from hashtags in the currently ranked feed content. Labels are normalized, deduplicated, bounded and sorted deterministically; selection routes through existing feed search. No artificial trending counts, seeded topics, fake people or fabricated listings are introduced.
4. Registered a focused Phase 1 regression contract in both `prebuild` and `verify:static`.
5. Advanced synchronized source release metadata to 0.330.18 and updated current source-of-truth documentation.

### Preserved boundaries

- One canonical compose pipeline; no parallel composer or publisher.
- Existing post card, API routes, visibility and moderation policy remain authoritative.
- Existing account/session isolation, mute/block enforcement, durable write and reconciliation paths remain intact.
- Existing drafts, media upload, offline, loading, error, empty and refresh behavior remain in place.
- No database migration, schema change, financial/ledger authority or new persistence mechanism.

### Verification

This is source-only verification. Focused source regression contracts are run separately and reported in the release handoff. Node.js 22.16.0 is present in this environment while the repository requires Node.js 24.15.0; the supported-runtime typecheck, lint, production build, browser/device, Pi Browser/WebView and live infrastructure gates are not represented as passed. Production remains NOT APPROVED.

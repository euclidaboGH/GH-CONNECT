# Phase 16 — Post Interaction Experience (v0.302.0)

## Delivered

- Comment image attachments open in a full-size viewer that preserves the source image proportions.
- Comment video attachments open in a dedicated playback preview; downloading remains an explicit separate action.
- The nested media viewer closes before the comments sheet when Escape is pressed.
- The media viewer locks background scrolling and restores focus to the attachment that opened it.
- The comments sheet announces a loading skeleton rather than briefly presenting a false empty state while remote comments load.
- The comments sheet traps keyboard focus, locks background scrolling and restores focus when closed.
- Curation action copy is concise while preserving the distinct community-curation action and vote semantics.

## Preserved boundaries

- Comment creation, editing, deletion, reactions, moderation and reporting remain on existing server-backed actions.
- Media upload and durable media facade authorization are unchanged.
- No database migration, RLS policy, authentication, wallet, GHC ledger, Pi payment or financial contract changed.

## Verification boundary

`node scripts/check-post-interactions-phase16.mjs` is a source-level regression contract. It does not replace supported-runtime TypeScript/lint/build, browser keyboard testing, mobile/Pi Browser testing, or live media authorization verification.

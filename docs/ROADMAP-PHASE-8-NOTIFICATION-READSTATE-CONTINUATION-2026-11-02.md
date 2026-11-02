> Engineering note — 2026-11-02

# Phase 8 continuation: notification read-state resilience

## Changes

- Added a bounded, session-bound, non-cacheable mutation helper for notification read-state writes.
- Applied the bounded helper to individual social/unified notification reads, announcement reads, economy reads, and mark-all-read fan-out.
- Read-state failures are surfaced rather than silently treated as confirmed durable writes. The existing refresh/reconciliation path remains responsible for resolving the displayed snapshot.
- No database schema, authorization rule, financial settlement path, or dependency version was changed.

## Verification boundary

The Phase 8 static contract checker now asserts the bounded mutation path and truthful failure messaging. Static checks do not prove live endpoint semantics, TypeScript correctness, or production behavior; those still require supported Node 24.15.0 CI and authenticated integration testing.

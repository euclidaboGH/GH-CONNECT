> Engineering note — 2026-11-02

# Phase 8 — notification resilience

## Problem addressed

The notification center loads from multiple durable sources. If every source is unavailable or returns an invalid response, the prior implementation could continue through the mapping path with empty arrays and replace the visible durable snapshot, including the unread count. That makes an outage look like an empty inbox and can make the bell say “All caught up.”

## Change

- Validate the successful response shape independently for unified, social, economy, and announcement sources.
- When all sources fail or return malformed success payloads, retain the current rendered items and unread count; do not replace them with empty arrays.
- Show a refresh-failure status rather than claiming the inbox is empty.
- Include announcement-source health when calculating the durable notification center status.
- Add `scripts/check-roadmap-phase8-notification-resilience.mjs` to prebuild and `verify:static`.

## Limits and safety

This is a client-side outage-preservation improvement. It does not add push subscriptions, quiet hours, server deduplication, notification retention controls, or new database behavior. A partial-source failure still deserves a later source-by-source stale-row merge so records from the failed source can remain visible while other sources update. No database migration, auth requirement, notification authorization rule, or dependency was changed.

## Verification required before release

Run the supported Node 24.15.0 install, typecheck, lint, production build, and multi-source outage tests in a browser; verify that mark-read actions remain server-confirmed and that one source outage does not duplicate or suppress records after recovery.

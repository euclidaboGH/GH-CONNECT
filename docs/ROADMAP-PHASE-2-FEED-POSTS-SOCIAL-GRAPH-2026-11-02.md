# Roadmap Phase 2 — Feed, Posts and Social Graph

Date: 2026-11-02

## Implemented in this pass

1. Feed preference reset now restores the actual default feed tab (`for-you`) as well as location, intention and focus preferences.
2. The selected feed tab is persisted to device storage so reloads restore the user's choice.
3. Local post-draft hydration now rejects malformed shapes more defensively and bounds media URL length/count, hashtag/mention length/count, and draft IDs.
4. Added `scripts/check-roadmap-phase2-feed-social.mjs` and registered it in `prebuild` and `verify:static`.

## Existing capabilities retained

The existing feed reconciliation helper suppresses duplicate/empty IDs, ignores deleted records, and preserves stable newest-first ordering. Existing draft recovery, report, save, follow/block/mute, post hydration and comment routing are retained.

## Not claimed as completed

This pass does not claim to have implemented all ten roadmap candidates end-to-end. In particular, server-backed edit history, collection management, cursor pagination across every feed source, audience previews enforced against server policy, and cross-device engagement reconciliation require targeted API/schema audits and live integration tests. Local draft persistence is device-only and is not a substitute for server durability.

## Verification

Run `node scripts/check-roadmap-phase2-feed-social.mjs` and `npm run verify:static`. TypeScript, lint, production build, live Supabase and multi-device integration must be verified in the supported Node 24.15.0 environment before release.

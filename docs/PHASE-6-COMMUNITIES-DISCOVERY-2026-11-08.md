# Phase 6 — Communities & Discovery

**Date:** 2026-11-08  
**Baseline:** 0.332.0 (Phase 5 Messages & Notifications)  
**Release:** 0.333.0  

## Objective

Membership honesty, moderation authority, and discovery integration without inventing join success or leaking private profiles.

## Implemented in this increment

1. **Community integrity helpers** — sanitized community ids, production durable-store gate, honest `mapJoinStatus`.
2. **Join API enrichment** — returns `isMember`, `pendingApproval`, `joinLabel` with private no-store caching.
3. **Join CTA helper** — `resolveJoinCta` distinguishes Join / Request to join / Invite only / Request pending / Owner.
4. **Discovery candidate filter** — excludes self, blocked, muted (optional friends/matches).
5. **UI wiring** — communities directory uses `resolveJoinCta` for labels.
6. **Preserved contracts** — viewerIsMember enrichment, moderator-only governance, people discover auth + rate limits, privacy filter helpers.

## Completion register

| # | Workstream | State |
|---:|---|---|
| 1–5 | Feed → Messages | Implemented, awaiting verification |
| 6 | Communities & Discovery | Implemented, awaiting verification |
| 7 | Marketplace | Not started |
| 8 | Profile & Matching | Not started |
| 9 | Settings & Filters | Not started |
| 10 | Platform-wide acceptance | Not started |

Production remains **NOT APPROVED**.

# UPGRADE WORKLOG — 0.315.2

**Date:** 2026-11-05

## Source-only verification · Node.js 24.15.0 runtime limitation

## Fixes
- `withdrawal-pin` route: rate limit import → `@/lib/server/economy/rate-limit`
- `pi-withdraw-sheet`: `apiRequest` → `@/lib/client/api-request`
- Database source contract table count 137 → 138 (`gh_withdrawal_pins`)
- VERIFIED_MANIFEST migration inventory rebuilt from disk (181)
- Phase 1–12 / Phase 12 baseline docs → 0.315.2

Single Withdraw CTA UX from 0.315.1 retained. A2U execution still operator-flag gated.

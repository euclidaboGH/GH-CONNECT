# Final polish — 0.313.1

Product UX track Phases 1–5 closed with light shell polish only.

## Changes

1. Toast clearance above bottom nav (`--gh-toast-bottom-inset`)
2. Toast stack already capped at 2; host width polished
3. Nav attention dots suppressed on the active tab
4. Release metadata → 0.313.1

## Non-changes

- No new migrations
- Fail-closed payment flags unchanged
- Server authority unchanged

## Verify

```bash
node scripts/check-phase5-product-ux-release-gate-2026-11-04.mjs
```

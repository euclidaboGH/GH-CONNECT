# UPGRADE WORKLOG — 0.313.0

**Date:** 2026-11-04  
**Track:** Product UX (video audit trust breakers → release)

| Phase | Focus | Status |
|-------|--------|--------|
| 1 | Story `INVALID_MEDIA_URL` facade accept + human errors | SOURCE |
| 2 | Discover presence/CTA, Interest label, Priority notifs | SOURCE |
| 3 | Communities My memberships RPC + session markers | SOURCE (+ migration REVIEW) |
| 4 | Feed soft-refresh on live screen, composer Story, stories single-path | SOURCE |
| 5 | Aggregated release gate, operator checklist, version 0.313.0 | SOURCE |

## Migration operator-owned

- `supabase/migrations/20261104180001_gh_community_list_memberships_viewer.sql` — apply on Testnet after review.

## Explicit non-claims

- Not Mainnet ready  
- Not funded A2U verified  
- Not database-applied proof without operator SQL run  

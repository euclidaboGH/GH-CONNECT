# UPGRADE-WORKLOG 0.338.81

## Summary
Three-phase Facebook / X reference visual polish for feed and post cards so upgrades are visibly different after deploy. Source-only verification; production remains NOT APPROVED.

## Phase 1 — Card chrome (FB mobile density)
- Flatter card radius (0.75rem) and hairline borders.
- On mobile: edge-to-edge cards (no side border/radius), soft canvas background between cards.
- Reduced card shadow for a modern social-app surface.

## Phase 2 — Header + reaction summary
- Author name uses shared `.gh-fb-author-name` (15px semibold, FB-like weight).
- Meta line uses `.gh-fb-meta-line` for consistent secondary text colour.
- Avatar 40px on phones / 44px on sm+.
- Reaction summary redesigned as stacked emoji cluster + total count (FB pattern) instead of per-type chips.

## Phase 3 — Feed rhythm + action density
- Feed list spacing tightened (`space-y-2` mobile / `space-y-3` desktop, edge padding reduced on phones).
- Toolbar / action dock min-height aligned for touch targets.
- Separator colour aligned to hairline token.

## Identity
- package.json / lockfile / APP_RELEASE_VERSION / PROJECT_TRUTH / SOURCE_OF_TRUTH / Phase 1 audit register → `0.338.81`.

## Verification notes
- Visual only; no financial, auth, RLS, or migration changes.
- Cursor pagination and prior 0.338.80 TS fix retained.
- Production remains NOT APPROVED pending operator Testnet evidence.

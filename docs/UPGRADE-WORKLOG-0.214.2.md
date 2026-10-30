# Upgrade worklog — 0.214.2

## Typecheck fix: bottom nav without create tab
- `isActive` no longer compares NAV_ITEMS id to `"create"` (not in union home|cart|wallet|profile).
- Prefetch/click handlers updated for Cart/Wallet overlays.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.

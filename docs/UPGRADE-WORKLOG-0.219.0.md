# Upgrade worklog — 0.219.0

## Feed / Cart / Badge IA
- Marketplace restored on **feed header** (browse).
- Bottom nav **Cart** opens marketplace **Orders** (payment / checkout surface), wired via `ghc:open-marketplace`.
- Feed **composer** under stories — same control as Profile posts tab.
- Feed **auto-refresh**: focus, visibility, online, post events, and 35s interval while visible.
- Home red badge only for **connection requests** (not generic notification unread). Notification unread stays on the bell.

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.

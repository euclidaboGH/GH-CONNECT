# Upgrade worklog — 0.271.3

## CI contract repair (source-only)

- Stale release version pins (0.226–0.256) → synchronized with package/app-release
- Transfer + payment-intent rate-limit contracts accept durable limiter (fail-closed)
- Phase 2 architecture nav matches product BOTTOM_NAV (home/messages/communities/cart/profile)
- Migration inventory gates accept ≥170 files (current 172)
- Pass 43 prebuild ordering check no longer requires startsWith

Supported runtime: Node.js 24.15.0.

Document date: 2026-11-01.

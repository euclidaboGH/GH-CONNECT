# Upgrade worklog — 0.315.9

## Phase 4 — Cart and Checkout premium upgrade

Detailed scope and release boundaries: `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`.

### Source changes
- Normalized and bounded the local marketplace cart cache before exposing data to UI components.
- Rejected malformed cart rows and invalid numeric values, merged duplicate listing IDs, and repaired malformed legacy cache content.
- Added same-origin cross-tab synchronization for cart updates.
- Locked cart line controls while an in-flight checkout is processing.
- Replaced whole-cart clearing after checkout with selective cleanup of only successfully reserved listing lines, preventing unrelated cart entries from being silently discarded.
- Preserved server-authoritative order creation, durable GHC payment, Pi payment handoff and stable retry idempotency.
- Added static and runtime regression coverage; no database migration or financial authority change.

### Verification
- Phase 4 cart static contract: 10/10 PASS.
- Phase 4 cart runtime contract: 8/8 assertions PASS.
- Existing marketplace cart upgrade contract: 9/9 PASS.

Supported Node 24.15.0 full install/typecheck/lint/production build, disposable PostgreSQL, live provider/Testnet, multi-tab/device and operator acceptance remain unverified. Source-only checks are not production acceptance.

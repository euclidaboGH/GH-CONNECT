# Refresh + Notification UX Upgrade — 0.222.0

## Refresh policy
- Screen-level server revalidation uses `useSectionRefresh` / `attachSoftRefresh`.
- Focus, visible-tab and online transitions are coalesced and throttled.
- Product mutation events are routed into the same section refresh lane.
- Async refreshes remain in-flight until their Promise settles; events arriving meanwhile are queued instead of stampeding requests.
- Feed, Wallet and Notifications now use this canonical policy. Existing Marketplace and Communities already use it.
- Low-frequency polling remains only as a recovery lane where live events can be missed; hidden tabs do not poll.
- Visibility listeners whose purpose is UI lifecycle rather than data refresh (close transient UI, mark a selected conversation read, session-resume UX) remain local by design.

## Notification center UX
- Conventional top app-bar presentation with clear title, unread state, refresh, mark-all-read and close controls.
- Cleaner bell treatment with subtle GreenHaven gold identity instead of a heavy prototype-style button.
- Unread badge remains compact and accessible.
- Category and All/Unread filters remain directly available.
- Notification rows have improved spacing, hierarchy, touch targets, focus states and unread emphasis.
- Detail/channel history remains a secondary drill-in rather than cluttering the primary inbox.
- Developer-facing `Auto-sync 12s` copy was replaced with human-facing sync state.
- Offline and partial durable-store states remain fail-soft and visible.

## Regression gates
`check-section-refresh.mjs` now verifies async coalescing and canonical Feed/Wallet/Notification refresh wiring.
`check-notification-center-contract.mjs` recognizes the shared refresh coordinator as the canonical event subscription path.

## Verification
- `npm run verify:static`: PASS
- `check-section-refresh.mjs`: 12/12 PASS
- `check-notification-center-contract.mjs`: 10/10 PASS
- `check-unified-wallet-card.mjs`: 13/13 PASS

# Phase 28 — Notification Center Restoration and Wiring

## Root cause

The notification-center implementation (`components/ghc/notification-bell.tsx`) remained in the repository, but the redesigned global app shell no longer mounted it. This removed the primary entry point even though server notification APIs, durable event stores, local notifications, and section indicators were still present.

## Changes in v0.91.0

- Restored a global, code-split notification bell in the primary app shell so it remains reachable across Home, Discover, Messages, and Profile.
- Improved touch target, focus-visible treatment, and accessible unread label for the bell.
- Removed the browser notification permission prompt from the simple act of opening the inbox; browser permission remains an explicit opt-in rather than a surprise side effect.
- Added refresh listeners for read-state changes and community, marketplace, wallet, and payment updates, with symmetric listener cleanup.
- Guarded asynchronous refresh against overlapping polling/event requests.
- Corrected Home's red-dot signal so unrelated local/economy alerts do not incorrectly mark the Home tab as having social activity; the global bell remains the cross-platform summary.
- Added a static notification-center regression contract to release verification.

## UX and safety principles applied

- One persistent in-app inbox complements section-level badges; badges should reflect relevant unread work rather than unrelated global events.
- Non-urgent updates use polite accessible status messaging and do not steal focus.
- Browser-level notification permission should be requested only when users explicitly opt in from notification settings or a clearly explained context.
- Server-authenticated notification endpoints remain authoritative. No client-side notification creation privilege, authentication bypass, or financial authority was added.

## Validation

Run `node scripts/check-notification-center-contract.mjs` and `node scripts/verify-phase14-static.mjs`. Full TypeScript/Next.js build and live testnet notification delivery still require the project's Node 24 runtime, dependencies, and authenticated testnet environment.

## Research references

- W3C WCAG 2.2, Status Messages (4.1.3): https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- UK Home Office User-Centred Design Manual, Notifications: https://design.homeoffice.gov.uk/accessibility/interactivity/notifications
- Courier, Notification Center Best Practices: https://www.courier.com/guides/how-to-build-a-notification-center/chapter-3-best-practices-for-notification-centers
- MDN, Display a badge on the app icon: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon

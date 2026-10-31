# GreenHaven — Regional Date, Time & Location Integration

## Implemented

- Added a global `RegionalContextProvider` for device locale, IANA time zone, UTC offset, optional browser location, permission state, and regional formatting helpers.
- All same-origin `/api/*` browser requests now carry `X-GH-Locale` and `X-GH-Timezone` display hints. Precise location is never attached globally.
- Added server-side `getRequestRegionalContext()` to safely parse and validate regional headers for location-aware APIs.
- Browser location is explicitly opt-in, kept in memory by default, and only coarse-rounded when a feature chooses to send it.
- Feed ranking now receives opted-in location and nearby ranking uses actual post coordinates with a Haversine distance calculation instead of a fixed demo score.
- Community event formatting now uses the viewer's locale/time zone and correctly determines same-day events in that time zone.
- Notification relative times use the regional formatter and a live 30-second UI clock.
- Wallet date/time helpers use the same regional formatter.
- Settings > Preferences now exposes the detected time zone/language and an explicit live-location enable/disable control.

## Safety / privacy

- Server-side timestamps remain authoritative UTC/ISO values.
- Client display converts timestamps to the viewer's device time zone.
- No exact GPS coordinate is persisted by the new regional context.
- Location permission is never requested automatically; the user must explicitly enable it.
- Optional location request headers are rounded to three decimal places and are only produced by feature code that explicitly asks for them.

## Verification

`npm run verify:static` — **57/57 PASS**, including the new Regional Context contract **10/10 PASS**.

A full dependency-backed production build was not claimed from this workspace because GreenHaven requires Node 24.15+ while the available local runtime is Node 22.16.0 and this extracted workspace does not provide the supported Node runtime.

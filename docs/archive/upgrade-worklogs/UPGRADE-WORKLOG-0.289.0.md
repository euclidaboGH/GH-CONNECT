# GreenHaven upgrade worklog — 0.289.0

## Delivered

- Built the global i18n foundation on top of the 60-country / 240-recommendation Phase 1 registry.
- Added BCP 47 locale normalization and backwards-compatible mapping for legacy language names.
- Replaced the eight-item language menus with a native select global registry list, deduplicated by locale tag and visibly marking untranslated choices.
- Persisted the selected locale on the device, applied `lang` and script-aware `dir` to the document root, and propagated locale/time zone as advisory request headers.
- Exposed locale-aware number, currency, date, and list formatting helpers with defensive English fallback.
- Explicitly limited approved UI translation resources to English until native-speaker-reviewed dictionaries are ready; user content is never automatically rewritten.
- Added a dedicated static regression gate and documentation.

## Safety boundaries

No Supabase migration, stored profile rewrite, identity change, wallet/economy change, user-location persistence, or external translation-provider integration was performed.

## Release gate

Source-only verification is required before release. Static source checks are required. TypeScript, ESLint and production build must be run under Node.js 24.15.0; Node.js 22 is not an acceptable substitute for the pinned runtime.

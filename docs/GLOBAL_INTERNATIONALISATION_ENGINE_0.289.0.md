# Global internationalisation engine — 0.289.0

## Scope delivered

- Added a canonical BCP 47 locale resolver with invalid-tag fallback and compatibility mapping for legacy settings values (`English`, `Spanish`, `French`, `German`, `Portuguese`, `Arabic`, `Hindi`, `Chinese`).
- Added a de-duplicated language selector sourced from the Phase 1 country-language recommendation registry, including native display labels and locale tags.
- Added a device-local preference key (`ghc.locale.preference.v1`). The preference does not require a Supabase migration and is not treated as an authorization, identity, wallet or financial setting.
- Added locale-aware number, currency, date and list formatters using the platform `Intl` implementation with safe English fallback.
- Applied the selected language tag and writing direction to the document root and forwarded the selected locale/time zone in regional request headers.
- Added explicit translation-readiness disclosure. English is the only approved interface catalog in this release; other registered languages are selectable as preferences but remain visibly untranslated until reviewed resources are shipped.
- User messages, posts, listings and other authored content are not automatically translated or modified.

## Safety and compatibility

- Existing `settings.language` remains the preference carrier; legacy language names are normalized without deleting the setting or changing user records.
- No database migration, Supabase write, account identity change, or stored location rewrite was introduced.
- Formatting is presentation-only. Server timestamps remain UTC/ISO and currency codes must be explicit ISO 4217 three-letter codes.
- RTL is determined from locale/script metadata, not country. The HTML document `lang` and `dir` attributes are updated together.
- API locale headers are advisory presentation context only and must never be used for authorization, pricing, settlement, tax or wallet decisions.

## Deliberately deferred

- Native-speaker reviewed translation bundles for Hausa, Igbo, Yoruba, Nigerian Pidgin and the other recommended languages.
- Persistent cross-device language preference sync. This requires a deliberate profile-preferences domain contract and RLS review; it is not added as an incidental client write.
- Translation of user-generated content, external machine-translation services, and server-side content localization.
- Full RTL visual audit of every screen, dialog, chart and third-party Pi SDK surface. Root direction is foundational, not proof of complete RTL readiness.

## Verification

`npm run check:global-i18n-engine` validates the locale resolver, formatting API, translation readiness disclosure, settings integration, root direction and API header integration. Run TypeScript, ESLint and production build under the repository-pinned Node.js 24.15.0 runtime before release approval.

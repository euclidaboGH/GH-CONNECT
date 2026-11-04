# GreenHaven upgrade worklog — 0.288.0

## Delivered

- Retained all 36 previously catalogued countries and added the 24 approved additions, reaching 60 countries with ten per continent.
- Added 240 country-language recommendations, exactly four per country, with ISO 639 subtags, BCP 47 locale tags, native names where confidently known, language classification, writing direction and pending review state.
- Added `listCountryLanguages`, `listGlobalLanguages` and `listAvailableCountryLanguages` APIs and exported them from the canonical geography module.
- Kept English available as a global fallback without miscounting it among the four local recommendations when absent from a country's shortlist.
- Improved location entry for countries without verified subdivision seed data by supporting manual region and city/town input. Existing country IDs and stored structured-location shape remain compatible.
- Added `scripts/check-global-language-foundation.mjs` and registered it in static verification and the production prebuild gate.
- Synchronized package, lockfile, application release, README, project truth, source-of-truth metadata and verified source manifest to 0.288.0.

## Validation

All checks recorded here are source-only checks; they do not establish live database/provider or production behavior.

- `npm run check:global-language-foundation` — PASS (60 countries, 10 per continent; 240 recommendations; four per country; all timezones and locale tags validated; Nigeria pilot validated).
- `npm run verify:static` — run after the version/documentation synchronization; record the actual final result in the delivery note.
- TypeScript, ESLint and Next.js production build require Node.js 24.15.0 or a compatible later Node 24 release satisfying `^24.15.0`. The available local runtime is Node.js 22.16.0, so those checks are not claimed as passed here.

## Safety boundary

- No Supabase migration was added or applied.
- No existing profile, location, identity, wallet, reward, Pi or financial data was rewritten.
- The four recommendations are not exhaustive country language inventories. Every language row remains `reviewStatus: "pending"`; this release does not claim that translations are complete or production-approved.
- No translation provider is activated and no user-generated content is sent externally.
- Production deployment remains NOT APPROVED until supported-runtime build, database/provider evidence and operator acceptance are complete.

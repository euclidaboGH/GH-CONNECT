# GreenHaven Global Language & Geography Foundation — 0.288.0

## Scope delivered

- Expanded the canonical geography catalog from 36 to 60 countries, retaining every original country and adding four approved additions to each continent.
- The catalog now contains exactly ten countries in each of Africa, Asia, Europe, North America, South America and Oceania.
- Added 240 country-to-language recommendations (four per country), with ISO 639 language subtags, BCP 47 locale tags, native display names where confidently available, writing direction, classification and human-review status.
- Added a deduplicated global language-list helper and country-specific recommendation helpers.
- English is exposed as a global fallback option without counting it as one of the four country recommendations where it is not already included.
- Improved the structured location picker: countries without verified admin1 seed data can now accept a manually entered region and city/town instead of presenting empty, unusable selectors.
- Preserved all existing country IDs, ISO alpha-2 identifiers, location profile fields and the existing Nigeria state/LGA pathways. No database migration or existing user-location rewrite is required.
- Added a static release gate validating country counts, ISO2 uniqueness, IANA timezone identifiers, four language recommendations per country, BCP 47 locale validity, RTL flags, Nigeria's four-language pilot and location-picker fallback support.

## Canonical files

- `lib/geography/countries.ts` — 60-country source of truth.
- `lib/geography/country-languages.ts` — country-language recommendations and registry helpers.
- `lib/geography/catalog.ts` — country/location lookup and structured-location mapping.
- `components/ghc/location-picker.tsx` — location-picker support for countries without seeded subdivisions.
- `scripts/check-global-language-foundation.mjs` — automated integrity gate.

## Important product semantics

1. Four languages are recommended choices, not an exhaustive list of languages spoken or legally recognized in a country.
2. `category` distinguishes official, recognized, indigenous, regional, community, widely used and script-variant recommendations. It must not be interpreted as a legal status unless its category says `official` or `recognized` and the source has been verified.
3. Every country-language recommendation is marked `reviewStatus: "pending"`. This is intentional. Catalog inclusion is not a claim that the language's translation has been completed or approved.
4. Script variants remain distinct locale choices where needed (for example, Punjabi Shahmukhi vs Gurmukhi and Chinese Simplified vs Traditional). They must not be collapsed into a single visual/script assumption.
5. Right-to-left direction is recorded for Arabic-script locales. Direction must ultimately be driven by the selected locale/script, not by the user's country.
6. Nigerian recommendations are Hausa (`ha`), Igbo (`ig`), Yoruba (`yo`) and Nigerian Pidgin (`pcm`). English remains available as a global fallback. The four local-language recommendations are not national official-language claims.
7. Sign-language accessibility is a separate product/accessibility workstream; a sign language is not represented as an ordinary written-text locale.

## Research and review required before enabling translations

The recommendations are a curated product shortlist, not a claim that every code, variety, official status, orthography or native-language name has already been approved by a government authority or native-language reviewer. Before a locale is marked `reviewed` or `approved`, confirm:

- ISO 639 and IANA language-subtag validity and the exact BCP 47 tag;
- official/recognized status from current constitutional, statutory or government sources where applicable;
- the language variety and orthography users expect in the target region;
- native-language display names and typography;
- availability and quality of human-reviewed translation resources;
- writing direction, plural rules, date/number conventions and font coverage.

Countries with many languages (including South Africa, India, Ethiopia, Papua New Guinea, Vanuatu and Bolivia) must allow users to search for additional languages in later releases. Four recommendations must never be presented as an exhaustive list.

## Verification

Run:

```bash
npm run check:global-language-foundation
npm run verify:static
```

The new foundation check is also part of `prebuild`, so a malformed country or language registry blocks a release build.

## Not included in this phase

- No interface translation dictionaries or translation provider are activated.
- No user preference schema or database migration is added.
- No user-generated content is sent to a third-party translation service.
- No existing profile, wallet, reward, Pi identity, financial ledger or stored location record is rewritten.

Those belong to the next internationalization implementation phase, after language review and architecture approval.

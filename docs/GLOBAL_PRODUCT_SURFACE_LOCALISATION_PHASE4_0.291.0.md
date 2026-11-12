# Global Product-Surface Localisation — Phase 4 (0.291.0)

## Scope delivered

Phase 4 extends the 0.288.0 geography foundation, 0.289.0 internationalisation engine and 0.290.0 navigation preview packs into high-frequency product interface areas. A typed product message catalog now provides English, Hausa, Igbo, Yoruba and Nigerian Pidgin strings for messaging inbox headings and filters, community discovery headings/search, marketplace navigation/search, settings discovery, profile/dashboard labels and Rewards Centre navigation.

## Engineering guarantees

- Locale selection continues to come from the existing regional context and persisted user preference.
- English is the authoritative fallback for missing catalog entries and unsupported locales.
- Existing domain state, server calls, permissions, payments, wallet balances, Pi authorisation, GHC ledger and marketplace settlement are not altered by this work.
- User-authored posts, listings, names, messages and community content are not translated.
- Legal, financial, identity and security workflows remain in their existing approved language until dedicated terminology review is complete.
- Preview translations are not certified as native-speaker approved. The locale status remains partial.

## Verification

`node scripts/check-global-product-translations.mjs` checks catalog key coverage, four locale packs, fallback behaviour, product-surface wiring and separation from user content and transaction logic. The consolidated network/database-independent static suite passes 57/57; global shell, i18n, documentation, release and lock-integrity checks also pass.

## Remaining work

Expand catalog coverage by feature, establish a native-speaker review and approval workflow, and only then promote a locale to complete coverage. Runtime typecheck, lint and production build must be run with the repository-required Node.js 24.15.0 runtime before release approval.

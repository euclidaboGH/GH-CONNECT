# Global Locale Presentation — Phase 8 (0.295.0)

## Scope

Phase 8 establishes a reusable locale-presentation layer rather than adding isolated string translations. `lib/i18n/formatting.ts` provides compact-number, percentage, measurement-unit, relative-time, plural-selection, locale-collation and presentation-metadata helpers. `RegionalContextProvider` exposes these helpers using the active user locale. Notification-centre counts and unread badges now use the selected locale number formatter.

## Correctness boundaries

- Display formatting is not parsing, calculation, persistence or reconciliation.
- Wallet values, GHC balances, Pi amounts, fees, currency codes, transaction IDs and payment states remain canonical and unchanged.
- Callers supply reviewed grammatical forms; the plural engine only selects the correct category.
- English fallback remains available when an Intl locale/option is unsupported.
- Locale metadata reports direction, numbering system, calendar and hour cycle; it does not infer a user's location or change their time zone.

## Translation governance

Catalog version 5 invalidates prior approval attestations for the four Nigerian preview packs. Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial pending native-speaker review and product-owner approval. User-generated content and private messages are never automatically translated.

## Verification

`node scripts/check-global-locale-formatting.mjs` checks the shared API, Intl primitives, context integration and display-only financial boundary. Source-only checks do not replace TypeScript, lint, production build or browser E2E verification.

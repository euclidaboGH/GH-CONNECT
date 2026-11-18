# Global Experience Localisation — Phase 5 (0.292.0)

## Scope

Phase 5 extends the global language foundation and Phase 3/4 preview packs into the high-frequency social experience. The new typed catalog is `lib/i18n/experience.ts` and currently covers 50+ interface messages across Hausa (`ha`), Igbo (`ig`), Yoruba (`yo`) and Nigerian Pidgin (`pcm`), with English as the canonical fallback.

Integrated surfaces:

- Feed filters, filter accessibility labels, feed search, refresh, offline state and on-device drafts.
- Feed personalisation controls for location relevance, content priorities, focus mode and reset.
- Discovery category tabs, search, connection-filter controls, outcome labels and offline states.
- Home time-of-day greetings.

## Translation and safety policy

All four non-English catalogs are preview translations and remain partial. A missing key falls back to English. No locale is marked complete and native-speaker review is still required. Translation approval must include terminology review, plural/number handling where applicable, accessibility review and product-owner sign-off.

User-authored posts, comments, private messages, community content and marketplace descriptions are never automatically translated. Legal text, identity/security instructions, wallet balances, payment states, Pi transaction instructions and financial rules remain outside this preview catalog. Currency values and transaction data continue to use the existing domain formatters and authoritative data sources.

## Architecture and boundaries

- Uses the existing `useRegionalContext()` locale preference; no new preference store.
- No database migration or Supabase schema/data change.
- No API, authentication, identity, wallet, reward, payout or financial logic change.
- English fallback remains deterministic for unsupported locales and missing translations.
- No third-party machine-translation service or network request was introduced.

## Verification

- `scripts/check-global-experience-translations.mjs`: 12 source-contract checks.
- Existing global product translation, i18n engine and consolidated static suites remain registered.
- Static checks do not replace Node 24.15 typecheck, lint, production build, browser tests or live operational acceptance.

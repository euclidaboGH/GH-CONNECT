# Global Social Localisation — Phase 7 (0.294.0)

## Scope

Phase 7 extends the existing locale preference into two high-traffic social surfaces: the notification centre and GH Pulse short-video player. A typed social catalog supplies English source strings and preview translations for Hausa (`ha`), Igbo (`ig`), Yoruba (`yo`) and Nigerian Pidgin (`pcm`).

## Integrated behaviour

- Notification centre: title, unread/caught-up state, refresh, mark-all-read, close labels, focus/category landmarks, offline/unavailable notices, sync status and empty-state actions.
- GH Pulse: player dialog name, latest/following/trending filters, loading/retry/empty/error states, playback/mute controls and previous/next accessible names.
- Locale preference changes update player strings through a locale-dependent callback; server payloads are not transformed.
- English fallback remains authoritative for missing keys and unsupported locales.

## Translation and safety boundary

All four Nigerian packs remain partial previews. No pack is approved by the presence of translated strings. Catalog version 4 is bound to the native-speaker review gate. User-generated posts, captions, profile names, notification payloads and private messages remain in their authored language. Wallet values, currency codes, payment states, fees and transaction identifiers are not translated or recalculated.

## Verification

`node scripts/check-global-social-translations.mjs` passes 12/12 source-contract checks. The consolidated static suite and documentation/release checks are recorded in the 0.294.0 worklog. TypeScript, lint and Next.js production build require the repository's supported Node 24.15.0 runtime and installed dependencies; source checks do not substitute for those gates.

## Change boundary

No Supabase migration, data write, authentication/session change, wallet-ledger change, Pi payment change, or financial-domain logic change is included.

# Global Language Packs — Phase 3 (0.290.0)

## Delivered

- Added native-script preview packs for Hausa (`ha`), Igbo (`ig`), Yoruba (`yo`) and Nigerian Pidgin (`pcm`).
- Localized the persistent five-item bottom navigation: Home, Messages, Communities, Cart and Profile.
- Localized the navigation landmark, current-tab/go-to accessible names, and lazy-screen loading feedback, not only visible captions.
- Added localized essential language-status copy and an explicit statement that user-authored messages/content are not translated.
- Added a strict three-state coverage status: English is complete, the four Nigerian pilot packs are partial, and other locales are not yet translated. Unsupported locales resolve safely to English. The language selector labels partial packs as “partially translated” rather than “not translated yet.”
- Connected settings language guidance to the partial-coverage status so users are not led to believe the entire app is translated.

## Quality and safety boundaries

- This release is a limited UI translation pilot, not full application localization.
- The translations are provisional product copy and require native-speaker review before being promoted to fully approved translations.
- Screens outside persistent navigation and the language-status section remain English.
- User posts, comments, private messages, community content, marketplace listings, legal content and financial records are never automatically translated.
- No third-party translation service, external network request, Supabase migration, profile schema change, wallet change, identity change or financial logic change was introduced.
- Existing locale preference persistence and BCP 47 handling remain in place.

## Verification

`npm run check:global-shell-translations` validates all four packs, fallback behavior, coverage disclosure, visible/accessibility navigation integration, loading feedback and settings integration (10 checks).

Full TypeScript, lint and production build must still be run under the repository-pinned Node.js 24.15.0 runtime before production approval.

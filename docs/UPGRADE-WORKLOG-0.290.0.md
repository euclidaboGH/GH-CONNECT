# Upgrade Worklog — 0.290.0

Phase 3 global language pack implementation.

- Added Hausa, Igbo, Yoruba and Nigerian Pidgin preview resource packs.
- Integrated locale-aware labels into the primary bottom navigation, navigation landmark, current-tab/go-to accessibility labels and lazy-screen loading feedback.
- Added partial-coverage messaging in language preferences; retained English fallback.
- Explicitly preserved original-language user content and excluded machine translation of private/public user content.
- Added `check:global-shell-translations` and integrated it into `prebuild` and `verify:static`.
- No Supabase migration or changes to authentication, identity, wallet, rewards, marketplace payment, or ledger authority.
- Translation packs require native-speaker review; the full application remains only partially localized.
- Source-only verification was run; runtime TypeScript/lint/build gate must run with Node.js 24.15.0. No production approval is implied by source checks.

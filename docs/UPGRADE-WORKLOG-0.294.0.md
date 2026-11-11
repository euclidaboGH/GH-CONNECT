# Upgrade Worklog — 0.294.0

## Phase 7: Global Social Localisation

- Added typed `lib/i18n/social.ts` catalog with English source messages and Hausa, Igbo, Yoruba and Nigerian Pidgin preview packs.
- Localised notification-centre chrome, accessibility names, refresh/read actions, connectivity feedback and empty states. Notification payloads and user-authored text remain unchanged.
- Localised GH Pulse video modes, loading/retry/empty/error fallback, player controls and accessible previous/next labels. Locale changes are reflected without stale callback language.
- Bumped translation catalog and native-review governance version to 4.
- Added 12 focused social-localisation source regression checks and registered them in prebuild/static verification.
- No database migration or auth/wallet/payment/financial logic change.

## Verification boundary

The social-localisation regression gate passes 12/12. These are source-only checks; they do not establish a successful production build. Consolidated static verification, documentation hygiene and release hygiene were run for this worklog. TypeScript/lint/build are not claimed as passed because the active environment is Node 22.16.0 and has no installed `node_modules`; the project requires Node 24.15.0. Production remains NOT APPROVED pending supported-runtime gates and live operational evidence.

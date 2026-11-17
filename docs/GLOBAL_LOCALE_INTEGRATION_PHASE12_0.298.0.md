# Phase 12 — Global Locale Integration and Release Guardrails (0.298.0)

## Delivered

- Locale preferences now retain an explicit in-session selection when an embedded browser blocks or intermittently fails local storage.
- A successfully read persisted preference is mirrored into the in-session fallback so a later storage failure does not silently revert the user's choice.
- Cross-tab preference changes update both the active locale and the in-memory fallback; resetting or clearing the preference pins browser-language selection for the session even if storage removal fails.
- Locale-aware unit formatting now degrades safely when an Intl implementation rejects a locale or unit at runtime. Plural count formatting has an independent fallback path.
- Added an integrated source contract covering preference lifecycle, document language/direction, regional API headers, translation governance and formatter fallback behavior.

## Product and safety boundaries

- Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial preview packs and pending native-speaker/product-owner review. This phase does not approve or expand translation coverage.
- User-generated content, private messages, profile text and listing descriptions remain untranslated.
- Locale formatting is presentation-only. It does not parse, recalculate, persist or reconcile wallet amounts, currency codes, fees, payment states, ledger records or transaction identifiers.
- No database migration, Supabase policy, authentication, Pi provider, wallet, payment or financial-domain behavior was changed.

## Verification

The dedicated Phase 12 source contract is registered in `prebuild` and `verify:static`. It verifies source invariants only. Node.js 24.15.0 locked installation, TypeScript, lint, production build, browser/device testing and native-speaker review remain separate acceptance requirements.

**Release status: NOT APPROVED for production** until the supported-runtime and operator acceptance gates are completed.

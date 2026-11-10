# Global Workflow Localisation — Phase 6 (0.293.0)

## Scope
Preview-language UI labels now cover the canonical post composer, profile editor, community-board explanation, marketplace listing form and wallet transaction-history heading. The translation layer is typed and falls back to English for missing keys and unsupported locales.

## Review and approval
Hausa (`ha`), Igbo (`ig`), Yoruba (`yo`) and Nigerian Pidgin (`pcm`) are preview packs. None is marked complete or native-speaker approved. A locale can be approved only when a native reviewer, review timestamp, reviewed catalog version and product-owner approval are present and the catalog version matches the current catalog. Review evidence must be retained with the release record before changing any locale status.

## Non-negotiable boundaries
- Do not automatically translate user-generated posts, private messages, profile biographies, listing descriptions or community content.
- Do not localise or recalculate financial amounts, currency codes, fees, payment states, wallet balances or transaction identifiers. Only static explanatory labels may be translated.
- Keep English fallback for every missing key.
- Never mark a preview pack complete solely because a string exists in the catalog.
- No database migration or auth, ledger, wallet, payment or Pi integration change is part of this phase.

## Verification
Run `npm run check:global-workflow-translations`, `npm run verify:static`, then Node.js 24.15.0 `npm run typecheck`, `npm run lint` and `npm run build`. Browser E2E and native-speaker review remain required before production approval.

# Upgrade Worklog — 0.291.0

## Phase 4 — Global product-surface localisation

Implemented a typed product-surface translation catalog and integrated it into the messaging inbox, communities discovery, marketplace navigation/search, settings discovery, profile/dashboard and Rewards Centre navigation. Hausa, Igbo, Yoruba and Nigerian Pidgin are preview packs; missing keys fall back to English. Product-surface labels are localised without translating user-authored content or changing domain/transaction behaviour.

## Verification status

Source-only verification was run for the new translation catalog and product-surface wiring.

- Product-surface translation checks: 10/10.
- Global shell translation checks: 10/10.
- Global i18n engine checks: pass.
- Documentation hygiene: pass.
- Full static verification: PASS (57/57), including the existing platform regression suite.
- TypeScript, lint and production build: not run/approved. This environment runs Node.js 22.16.0 while the repository requires Node.js 24.15.0; dependencies are not installed in this working environment.

## Safety boundary

No Supabase migration, database write, auth/session change, Pi wallet authorisation change, GHC ledger change, payment/withdrawal logic change or user-content translation was introduced. Native-speaker review remains required before any locale can be marked complete.

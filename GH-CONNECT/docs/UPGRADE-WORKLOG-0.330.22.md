# Upgrade worklog — 0.330.22

Date: 2026-11-07

## Feed relevance transparency and local feedback

- Connected the ranked-post “Why am I seeing this?” control to a rendered explanation dialog.
- Made the dialog an accessible modal with an explicit label, modal semantics, backdrop dismissal, Escape-key dismissal, keyboard focus trapping and focus restoration.
- Explained the current ranking reason and clarified that relevance ordering does not alter post visibility permissions.
- Replaced inert feedback UI with a working “See fewer like this” action that reuses the existing Feed exclusion state.
- Persisted the preference on the current device using a unique, bounded list of at most 200 post IDs. The preference is not sent to the server and does not change the canonical social visibility or moderation policy.
- Added four regression assertions to the existing Phase 1 Feed completion contract, which is already registered in `prebuild` and `verify:static`.

## Targeted verification

- Feed product transformation: 12/12 PASS.
- Feed completion: 30/30 PASS.
- Engagement reliability: 16/16 PASS.
- Feed reconciliation: 12/12 PASS.
- Feed composer/stories shell: 12/12 PASS.

## Not run / release limitations

- Runtime in this environment is Node 22.16.0; project requires Node 24.15.0.
- Dependencies are not installed. Dependency-backed TypeScript, ESLint and Next.js production build were not run.
- No browser, Android WebView or Pi Browser device acceptance was performed.
- No database migration, Supabase operation, Testnet/Mainnet action, financial mutation or deployment was performed.

**Source-only verification; this is source delivery only. Production remains NOT APPROVED pending supported-runtime, browser/device and existing database/operator acceptance gates.**

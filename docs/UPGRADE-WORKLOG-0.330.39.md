# Upgrade worklog — 0.330.39

## Priority 10: Filters

- Audited existing Feed, Discovery, Wallet, Messages, Marketplace and Notification filter flows.
- Added a shared active-filter summary with removable chips and a single clear-all interaction.
- Wired shared filter summaries to each of the six surfaces without changing their underlying domain permissions or server authority.
- Added common Unicode/diacritic-insensitive, bounded, token-based text matching to Feed, Discovery, Wallet transaction search and Messages inbox search.
- Removed the non-deterministic random-distance placeholder from the legacy text location helper. It now performs deterministic location-label matching and does not represent distance.
- Added 14 focused utility assertions and 17 cross-surface source contracts; registered both in prebuild and static verification.
- Updated release metadata to 0.330.39.

## Verification limits

Focused source-only verification tests pass. Full dependency-backed typecheck/build under the required Node.js 24.15.0 runtime, browser/device/screen-reader, live API/database, account-isolation and production acceptance are not established. No migration was created or applied. Production remains NOT APPROVED.

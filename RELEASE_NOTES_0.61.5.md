# GreenHaven 0.61.5 — Account lifecycle and payout foundation

- Adds step-up protected account export/deletion request APIs and a fixed-table JSON export.
- Adds a seller payout request queue with completed/verified order eligibility and unique order allocation protection.
- Adds creator reward evaluation and community-quality signal schemas without enabling currency issuance or claiming truth labels.
- Adds Phase 15 source regression checks.

This is a repository-only release. The new migration is not applied to any live Supabase project. Seller payouts are requests only; tips remain deferred; creator rewards are not settled; private media is not yet integrated end-to-end across all application consumers. TypeScript, lint, production build, and live integration tests must be run before deployment.

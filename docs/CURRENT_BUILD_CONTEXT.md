# CURRENT BUILD CONTEXT — 0.338.86 (2026-11-16)

This current build context supersedes historical prompts and worklogs unless explicitly cited as historical evidence.

- **Current authoritative source:** `GREENHAVEN-0.338.86-RUN302-PI-A2U-SAFETY-CORRECTIONS.zip`.
- **Package identity:** `gh-connect@0.338.86`; package, lockfile, app release identity and verified migration manifest are synchronized.
- **Latest increment:** Run #302 Pi A2U wallet-scope consent and exact provider-payment destination binding; prior Run #301 CI Node 24.15.0 assertions and 0.338.84 product improvements remain included.
- **CI safety:** repository contents permission remains read-only; CI does not apply Supabase migrations or automatically deploy Vercel production.
- **Audit runtime:** local workspace Node.js 22.16.0; project `.nvmrc` and package engine require Node.js 24.15.0. Dependencies are not installed. Do not claim dependency-backed typecheck, lint or Next.js production build.
- **Migration inventory:** 224 canonical SQL source files; 119 REQUIRED (review candidates only), 1 REQUIRES_APPROVAL, 2 PROPOSAL, 102 REVIEW_REQUIRED. Live Run #302 reconciliation: Testnet has 43 migration-history rows, of which 12 have exact local version/name files and 31 do not; Mainnet has 0 migration-history rows and 0 public application tables. Two later Testnet feed-preference records (20261116054218/20261116054242) are absent as exact source files. No clean Mainnet bootstrap is approved. Never bulk-push or replay unresolved migrations.
- **Outstanding acceptance:** Node 24.15.0 clean install/typecheck/lint/build; authenticated two-account browser/device journeys; Pi Browser/mobile and constrained-network checks; live database/RPC and provider verification; Vercel Preview build and smoke acceptance.
- **No external mutations:** one reviewed Supabase Testnet schema migration was applied; no payout/ledger data, wallet balance, GHC/Pi financial state, provider transfer, GitHub push/PR, Vercel deployment or Mainnet operation was changed.

**Release status: PRODUCTION NOT APPROVED.**

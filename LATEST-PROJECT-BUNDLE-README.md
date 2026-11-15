# GreenHaven — Current Project Bundle

**Authoritative uploaded baseline:** `GREENHAVEN-0.338.85-CI-NODE-ASSERT-HYGIENE.zip`
**Package:** `gh-connect@0.338.85`
**Date:** 2026-11-15
**SHA-256:** `ede88266a095c3904044134270ed56b5bdd5c07a4a08ea9a363b756cabb2d36a`

## Latest delivery — 0.338.85 / CI Node assertion hygiene

- Adds explicit exact-Node.js-24.15.0 assertions to both the static-verification and build jobs in GitHub Actions.
- Retains the 0.338.84 feed, home, profile, community and post-card density improvements.
- Synchronizes the release identity and keeps production deployment authority fail-closed.
- No database migration was applied; no wallet, GHC, Pi, provider or production state was changed.

## Required release gates

The current audit workspace runs Node.js 22.16.0; `.nvmrc` and the package engine require Node.js 24.15.0. Dependencies are not installed in the audit workspace. Therefore dependency-backed TypeScript, ESLint and Next.js production build results must be obtained under Node.js 24.15.0.

Authenticated browser/device and two-account acceptance, live provider checks, and independent Testnet/Mainnet migration-history reconciliation remain outstanding. The repository contains 223 canonical migration sources, including 101 REVIEW_REQUIRED, 2 PROPOSAL and 1 REQUIRES_APPROVAL classifications. The manifest is source inventory, not proof of remote application.

Do not run `supabase db push` or replay migrations while histories and held classifications remain unresolved. No GitHub push, pull request, Vercel deployment or production approval is implied by this archive.

**Production remains NOT APPROVED.**

See `docs/SOURCE_OF_TRUTH.md`, `docs/UPGRADE-WORKLOG-0.338.85.md` and `docs/PROJECT_TRUTH.md`.

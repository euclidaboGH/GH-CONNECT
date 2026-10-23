# GreenHaven Phase 6 — Massive Production Hardening Upgrade

## Scope

This phase continues the existing GreenHaven architecture rather than replacing
working systems. It strengthens the database bootstrap contract, validator
correctness, migration-source verification, and feed pagination reliability.

## Integrated upgrades

### 1. Canonical database validator corrected

The validator previously required `>=101` GreenHaven tables. The executable
migration source contains **99** GreenHaven table definitions. The two extra
`CREATE TABLE` examples are comment-only proposal/note text and are not schema.

The validator now uses `>=99` as the sanity floor while the explicit required-
table list remains authoritative.

### 2. Source contract verification added

New command:

`npm run check:database-contract-source`

It strips SQL comments before inspecting migration DDL and verifies:

- 115 clean migrations
- 99 executable GreenHaven tables
- all critical required tables
- proposal-only tables remain non-executable

This prevents future validation drift caused by commented SQL examples.

### 3. Feed infinite-scroll correctness repaired

`EnhancedFeedScreen` contained two consecutive increments of
`displayedPostsCount` for one fetched page. That could reveal twice the intended
page size and distort pagination boundaries.

The duplicate state transition has been removed and a regression assertion was
added to the product-experience test.

## Verification performed

- Database source contract: **PASS**
- Phase 5 database tools: **PASS**
- Clean migration inventory: **PASS — 115/115**
- Canonical installer regeneration: **PASS — 115/115**
- Product-experience suite: **PASS — 27/27**

## Runtime note

No claim is made here that the full Next.js build, npm dependency installation,
or browser E2E suite has run in this packaging environment. Those remain part of
the normal local/Vercel verification gate after the source package is accepted.

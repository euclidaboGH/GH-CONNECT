# GreenHaven Phase 6 — Database Contract Hardening

## Objective

Make the clean Supabase bootstrap and validation workflow reflect the actual
executable migration source instead of counting SQL examples inside comments.

## Resolved issue

The previous validator required at least 101 GreenHaven tables. The canonical
source contains 99 executable GreenHaven table definitions. Two migration files
contain `CREATE TABLE` examples only inside SQL comments:

- `ghc_community_join_reasons`
- `ghc_economic_telemetry`

Those examples are proposal/note text and must not be treated as installed
schema objects.

The live clean database was independently verified at:

- 99 GreenHaven tables
- 99/99 RLS enabled
- 104 RLS policies
- 282 indexes
- 1,142 constraints
- 7 triggers
- 173 GreenHaven routines

## New source-of-truth check

`npm run check:database-contract-source`

This strips SQL comments before counting executable `CREATE TABLE` statements,
checks the required application tables, and protects proposal-only definitions
from silently becoming part of the database contract.

## Validation policy

Named required objects are authoritative. Numeric counts are sanity floors,
not substitutes for explicit object contracts.

Future migrations that add tables are expected to increase the executable table
count naturally without requiring the validator to be rewritten merely because
a count crossed 100 or 101.

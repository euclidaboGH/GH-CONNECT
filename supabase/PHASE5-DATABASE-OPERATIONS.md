# GreenHaven Phase 5 — Database Operations

## Permanent database lifecycle

GreenHaven uses the migration directory as the development source of truth and a generated one-shot installer for clean database bootstraps.

### The four controlled tools

1. `supabase/migrations/*.sql` — incremental development source.
2. `supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` — generated complete bootstrap.
3. `supabase/RESET-GREENHAVEN-DATABASE.sql` — destructive GreenHaven application reset.
4. `supabase/VALIDATE-GREENHAVEN-DATABASE.sql` — read-only post-install contract validation.

## Future migrations

When a new migration is added, **do not manually edit the canonical installer**.

Run:

```text
npm run db:generate-canonical
```

The generator:

- discovers every current `supabase/migrations/*.sql` file;
- sorts them by the canonical 14-digit migration version;
- rejects duplicate migration versions;
- checks that newly created public GreenHaven objects follow the `gh*`, `ghc*`, or `ghpv*` naming contract;
- regenerates the single canonical installer;
- records the SHA-256 of every source migration.

Therefore, whether GreenHaven has 115, 150, or 300 migrations, a fresh database still has **one installer file**.

## Normal feature development

Do **not** reset the database for ordinary feature work.

Create a new incremental migration, test it, and apply it to the target environment. Then regenerate the canonical installer so future clean environments include the new migration automatically.

## Major schema reconstruction / clean environment

Use this exact sequence:

```text
RESET-GREENHAVEN-DATABASE.sql
        ↓
GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql
        ↓
VALIDATE-GREENHAVEN-DATABASE.sql
```

For a brand-new empty Supabase project, skip RESET and run INSTALL → VALIDATE.

## Reset behavior

The reset script is **object-based, not migration-count-based**. It dynamically discovers current public GreenHaven relations, routines, sequences, and custom types using the GreenHaven naming contract (`gh*`, `ghc*`, `ghpv*`).

That means a future migration such as `2027..._new_feature.sql` is cleaned by the same reset script as long as the public application objects it creates follow the naming contract.

It intentionally does **not** delete:

- Supabase Auth users / the `auth` schema
- Storage buckets
- Storage objects/files
- Supabase extensions
- extension-owned objects

The `gh-media` bucket therefore remains outside this database reset. Storage cleanup, when ever needed, is a separate controlled operation.

## Safety boundary

The reset script is destructive. Never run it against a production database containing data unless a deliberate rebuild has been approved and backups/exports have been handled first.

## Release rule

Whenever migrations change materially:

```text
Add migration
   ↓
Static validation
   ↓
npm run db:generate-canonical
   ↓
Validate canonical installer
   ↓
Commit migration + generated installer together
```

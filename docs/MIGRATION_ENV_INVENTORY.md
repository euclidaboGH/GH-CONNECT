# Migration inventory per environment

**Do not bulk-apply all 70 SQL files.** Use `npm run ops:migration-check` / `docs/MIGRATION_CHECKLIST.md`.

Operators fill this table after reconciling live Supabase with the repository manifest.

| Environment | Applied (count / notes) | Last reconciled | Operator |
|-------------|-------------------------|-----------------|----------|
| Local / Studio | | | |
| Vercel Preview | | | |
| Testnet Supabase | | | |
| Production Supabase | | | |

## Classification reminder

| Class | Action |
|-------|--------|
| REQUIRED | Apply in dependency order after review |
| REQUIRES_APPROVAL | Explicit sign-off |
| PROPOSAL | Not for automatic apply |

## Commands

```bash
npm run ops:migration-check
# or
npm run verify:migrations
```

Authoritative on-disk list: `VERIFIED_MANIFEST.txt`, `docs/MIGRATION_CHECKLIST.md`, `docs/MIGRATION_GAP_REPORT.md`.

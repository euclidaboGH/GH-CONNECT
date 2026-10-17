# Verification-and-fix pass (narrow scope)

## Audit findings addressed

1. **Migration checklist** now includes `202609260002_gh_reaction_multi_type.sql` (`gh_reaction_toggle`) plus comment cursor, feed order, follow status, search.
2. **`operator:live-e2e-social`** now performs:
   - distinct identities
   - A→B connection + B inbox read-back
   - A follows B + B followers list
   - A creates post (requires durable)
   - B feed contains post
   - B likes → A feed like count
   - B comments → A comments GET
   - unauthenticated write rejected

## Operator commands

```bash
npm run operator:multiuser-migrations
# Review SQL; apply missing REQUIRED only after dependency check
# scripts/operator-sql-multiuser-smoke.sql in Supabase

export GHC_E2E_BASE_URL=https://YOUR_PREVIEW.vercel.app
export GHC_E2E_COOKIE_A='…'   # private — local only
export GHC_E2E_COOKIE_B='…'
npm run operator:live-e2e-social
```

## Status

Source verification tooling improved. **Live two-account pass/fail is not claimed here** without cookies and target DB.

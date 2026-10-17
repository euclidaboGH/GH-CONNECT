# Harmonized social backend repair — audit report

## Executive verdict

**READY FOR PREVIEW VERIFICATION**

Evidence supports improved source verification and E2E coverage. Live two-account PASS against a configured Preview + Supabase is still **operator-pending**. Not Mainnet-certified.

## Findings and fixes

| Severity | Finding | Fix |
|----------|---------|-----|
| High | Migration checker only counted files | Scan SQL for required symbols (`gh_reaction_toggle`, etc.); INCONSISTENT status; nonzero exit |
| High | E2E omitted strong like/comment ownership assertions | Assert authorId on feed post and comment; unique markers |
| High | Reaction toggle non-repeatable if double-toggled | Unique post per run; single like toggle; assert `active` |
| Medium | Forged actor not probed | Follow body with forged actorId/followerId still session-bound |
| Info | APPLIED status unknown without DB | Explicit UNKNOWN in checker output |

## Test matrix

| Suite | State |
|-------|--------|
| operator:multiuser-migrations (on-disk + symbols) | RUN locally |
| operator:verify-migration-defs | RUN locally |
| operator:live-e2e-social | NOT RUN without cookies |
| Production build / full tsc | Environment-dependent |
| Live DB APPLIED migrations | UNKNOWN |

## Operator commands

```bash
npm run operator:verify-migration-defs
npm run operator:multiuser-migrations
# Review SQL; apply missing to Preview Supabase only after dependency review
# scripts/operator-sql-multiuser-smoke.sql

export GHC_E2E_BASE_URL=https://YOUR_PREVIEW.vercel.app
export GHC_E2E_COOKIE_A='…'
export GHC_E2E_COOKIE_B='…'
npm run operator:live-e2e-social
```

## Risks remaining

- Target DB may lack applied reaction/comment RPCs even when ON_DISK.
- Feed visibility depends on `gh_post_list_feed` + visibility rules.
- Preview pass ≠ Mainnet readiness.

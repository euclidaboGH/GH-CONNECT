# Testnet migration reconciliation

**Updated:** 2026-09-28  
**Local migration count:** 54  
**Action completed:** Local filenames aligned to the renumbered set already applied on Testnet Supabase.

## What changed

Repository migration **filenames** were renamed to match Testnet history. **SQL file contents were not rewritten.**

Notable renames:
- `20260822_*` day-collision files → `202608220001` … `202608220005`
- `20260903`–`20260927` multi-file days → sequential `…0001` / `…0002` / …
- `20261006_gh_notif_share_type.sql` → `20261006_gh_notif_share_type.sql`
- Creator studio → `202609300001_gh_creator_studio.sql`
- Withdrawal → `202609260001_ghc_withdrawal_requests.sql`

## Policy

- Do **not** re-apply migrations already on Testnet.
- Do **not** reset Testnet history.
- Operator should run `supabase migration list` and confirm **Local = Remote** for applied versions.
- PROPOSAL / REQUIRES_APPROVAL files remain non-auto-apply.

## Classification (unchanged)

- REQUIRED: 51  
- REQUIRES_APPROVAL: 1 (`20260905_connection_request_intents.sql`)  
- PROPOSAL: 2  

## Schema / remote verification

Still requires operator:

```bash
supabase migration list
```

Then functional Testnet QA. Mainnet remains blocked until verified.

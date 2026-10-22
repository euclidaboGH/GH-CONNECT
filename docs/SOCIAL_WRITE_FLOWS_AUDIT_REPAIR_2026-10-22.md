# Four social write flows — audit, repair, regression (0.70.2)

## Scope

1. Post curation (upvote/downvote)
2. Comment creation
3. Comment reactions
4. Save/unsave posts

## Root-cause analysis

### Shared finding

All four flows call PostgREST via **server-only** `socialRpc` with `SUPABASE_SERVICE_ROLE_KEY`.  
EXECUTE is correctly limited to `service_role` (not `authenticated` / `anon`). That is **not** the bug; granting EXECUTE to `authenticated` would be a security regression and would not match the app architecture.

Observed client errors of the form `RPC_<fn>_HTTP_404` mean the **HTTP status from PostgREST was 404**. With functions confirmed present in `public`, the likely causes rank as:

| Cause | Likelihood when fn exists in `pg_proc` | Evidence |
|-------|------------------------------------------|----------|
| **PGRST202** — no matching *signature* (arg names/count/types) | High | Overloaded `gh_post_curation_set_with_reward` (4-arg vs 6-arg) historically coexists in migrations |
| **PGRST203** — ambiguous overload | Medium | Same |
| **Stale PostgREST schema cache** | Medium | Functions added without `NOTIFY pgrst, 'reload schema'` |
| Wrong Supabase project URL / key on Vercel | Medium | App talks to a different project than the one you inspected |
| True missing function | Low if `pg_proc` lists all six | — |
| Mapping non-404 into `*_HTTP_404` | Low | `socialRpc` only sets that when `res.status === 404` |

App did **not** call RPCs from the browser. ACLs for `authenticated` are irrelevant to these server routes.

### 1. Curation

- **Primary RPC:** `gh_post_curation_set_with_reward` with  
  `p_post_id, p_user_id, p_choice, p_percentage, p_curation_weight, p_judgment_mode` (6-arg).
- **Auth:** session only; `stripClientAuthority`; rate limit.
- **Self-curation:** still forbidden (`SELF_CURATION_FORBIDDEN`) — intentional.
- **Repair:** ordered fallback only on signature miss: 6-arg → 4-arg with_reward → `gh_post_curation_set`.  
  Vote-only fallback **never** reports `reward.credited: true` (`REWARD_RPC_UNAVAILABLE`).

### 2. Comment creation

- **RPC:** `gh_comment_create({ p_row })` — JSON uses camelCase (`postId`, `authorId`, …) matching SQL.
- **Auth:** `authorId` forced from session; client `authorId` ignored.
- **Repair:** same diagnostic path; no signature change required in SQL if function exists.

### 3. Comment reactions

- **RPC:** `gh_comment_reaction_toggle(p_post_id, p_comment_id, p_user_id, p_emoji)` — four text args.
- **Auth:** session; visibility; `commentBelongsToPost`.
- **Repair:** diagnostics only; argument shape already correct.

### 4. Save/unsave

- **RPC:** `gh_save_toggle(p_user_id, p_post_id)` — user from session only.
- **Auth:** visibility gate before toggle.
- **Repair:** diagnostics only.

## Code changes (minimal)

- `lib/server/social/rpc.ts` — `Content-Profile`/`Accept-Profile: public`, parse PGRST codes, structured fallbacks, safe warn logs.
- Curation route — honest reward on fallback; richer `SOCIAL_RPC_UNAVAILABLE` diagnostics.
- Comments/saves — surface diagnostic fields.
- `supabase/migrations/20261022010100_pgrst_reload_social_rpcs.sql` — schema reload notify only.
- `scripts/test-social-write-rpc-contracts.mjs` — 22 static contract checks (`npm run test:social-write-rpc-contracts`).

## Operator verification (live DB — not automated here)

```sql
-- signatures
select p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'gh_post_curation_set','gh_post_curation_set_with_reward',
    'gh_comment_create','gh_comment_reaction_toggle','gh_save_toggle','gh_reaction_toggle'
  )
order by 1, 2;

select pg_notify('pgrst', 'reload schema');
```

Then call each API with a valid session cookie against the same project as Vercel `SUPABASE_URL`.

## Tests

| Check | Result |
|-------|--------|
| `node scripts/test-social-write-rpc-contracts.mjs` | **22/22 passed** |
| Live Supabase RPC round-trip | **Not run** (no project credentials in this environment) |
| Full `next build` | **Not run** in this pass |

## Security non-goals (explicitly not done)

- No GRANT EXECUTE to `anon` / `authenticated` / PUBLIC for these functions.
- No service-role key in client bundles.
- No trust of client user IDs or reward claims.

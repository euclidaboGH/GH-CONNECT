# Trust authority (Step 2)

## Verification

| Action | Client production | Studio | Server |
|--------|-------------------|--------|--------|
| request | OK (pending) | OK | POST `/api/verification/request` |
| approve / reject / revoke | **Blocked** | Allowed local | POST `/api/verification/review` + `GHC_VERIFICATION_SERVER=1` + secret |

Public verified badge in production: **`profile.verified` only** — not localStorage verification domain.

## Reputation

| Action | Client production | Studio |
|--------|-------------------|--------|
| Fixed-weight self signal | Class D cache only | OK |
| `deltaOverride` | **Blocked** | Allowed |
| Cross-user write | **Blocked** | Allowed with override rights |
| Purchase with GHC | Always rejected | Always rejected |

Public score in production: prefer server snapshot; hide local-only scores (`resolveReputationDisplay`).

## Env (server only — never NEXT_PUBLIC)

- `GHC_VERIFICATION_SERVER=1`
- `GHC_REPUTATION_SERVER=1`
- `VERIFICATION_REVIEW_SECRET` or service role for review route

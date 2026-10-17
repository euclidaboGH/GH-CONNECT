# Operator infrastructure + live E2E

## Goal

Make multi-user durable on **Testnet** without inventing data or weakening auth.

## Step 1 — Migrations (SQL editor or CLI)

```bash
npm run operator:multiuser-migrations
```

Apply **ON_DISK** critical files in printed order.  
`20260905_connection_request_intents.sql` is **REQUIRES_APPROVAL** — review before apply.

After apply, run in Supabase SQL editor:

`scripts/operator-sql-multiuser-smoke.sql`

Expect non-null `to_regclass` for tables you applied.

## Step 2 — Environment

Required on Vercel / host:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- Pi auth / Client ID as already used for KYC sign-in
- Durable media storage config used by `uploadDurableMedia`

Optional flags already documented for messaging durability.

## Step 3 — Deploy

Push package with **`app/` at repository root**. Confirm build green.

```bash
curl -sS "$DEPLOY_URL/api/health" | jq .
```

## Step 4 — Live E2E smoke (HTTP)

```bash
export GHC_E2E_BASE_URL="https://your-deployment.example"

# Optional — capture session Cookie header from Pi Browser / logged-in desktop
export GHC_E2E_COOKIE_A="..."
export GHC_E2E_COOKIE_B="..."

npm run operator:live-e2e
```

Without cookies: health + public lists only (partial).  
With two cookies: profile distinctness + dual connection inbox.

## Step 5 — Manual product E2E (two KYC users)

Use `docs/PHASE10_MULTIUSER_RELEASE_GATE.md` §4 checklist:

Post visibility, connect/accept, mutual match, DM, notifications, community, marketplace listing.

## What this repo implements for operators

| Artifact | Purpose |
|----------|---------|
| `scripts/operator-multiuser-migrations.mjs` | Ordered multi-user migration list |
| `scripts/operator-sql-multiuser-smoke.sql` | Post-apply table/RPC presence |
| `scripts/operator-live-e2e.mjs` | HTTP smoke against live deploy |
| `docs/OPERATOR_INFRA_LIVE_E2E.md` | This runbook |

## Honesty

- Scripts **do not** apply migrations to your Supabase project.
- Live E2E **does not** invent second users; you supply session cookies.
- Failures with `503` / `durable: false` mean DB path not ready — fix infra, not UI mocks.

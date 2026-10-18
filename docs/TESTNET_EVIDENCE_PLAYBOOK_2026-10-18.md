# Testnet evidence playbook — GH-CONNECT 0.61.1

## Purpose

Turn **source repairs** into **recorded Testnet evidence**. Nothing here claims Mainnet readiness.

## Prerequisites

- Preview/Testnet URL (`GHC_E2E_BASE_URL`)
- Two independent Pi-authenticated sessions (cookies **only on operator machine**)
- Supabase project with multi-user critical migrations applied

## Step 1 — Migration critical set (on disk)

```bash
npm run operator:multiuser-migrations
# Expect: Missing critical files: 0 · Missing RPC symbols: 0
```

Apply missing SQL to **Testnet** Supabase in dependency order (operator console). Do not batch-apply all 96 blindly.

## Step 2 — Stage 2 financial static gates

```bash
node scripts/operator-stage2-financial-gates.mjs
```

## Step 3 — Live two-account social + messaging

```bash
export GHC_E2E_BASE_URL="https://YOUR-PREVIEW.vercel.app"
export GHC_E2E_COOKIE_A="…"
export GHC_E2E_COOKIE_B="…"
npm run operator:live-e2e-social
```

Must PASS: identity, connection request/inbox/accept, follow, post, like, comment, reply, emoji, curation, messaging list/send/readback.

## Step 4 — Manual UX smoke (10 minutes)

| Check | A | B |
|-------|---|---|
| Connect request appears in inbox without hard reload | send | see + accept |
| Like count updates on author feed after refresh | post | like |
| Comment visible cross-account | post | comment |
| DM visible to recipient | send | open thread |
| Notification opens correct surface | — | tap bell |

## Step 5 — Evidence pack (operator fills)

| Item | Result | Timestamp | Notes |
|------|--------|-----------|-------|
| multiuser-migrations on-disk | | | |
| critical migrations applied on Testnet | | | |
| live-e2e-social exit code | | | |
| Manual UX table | | | |
| Economy flags remain OFF | | | |

Store evidence **outside** the repo (private ops doc). Never commit session cookies.

## Feature flags (keep OFF until evidence)

- `GHC_REFERRAL_SETTLEMENT_ENABLED`
- `GHC_CURATION_REDISTRIBUTE_ENABLED`

## Exit criteria for “Testnet social ready”

1. `operator:live-e2e-social` exit 0 against Testnet URL  
2. Manual UX table complete  
3. No local-only success toasts for connect/like/comment/message in the test accounts  

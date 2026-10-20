# Phase 5 — Operator evidence & essentials gate (2026-10-20)

## Product phases covered

| Phase | Scope | Package lineage |
|-------|--------|-----------------|
| 1 | Community membership/post, missions API, discover breadth, message poll | 0.63.0 |
| 2 | Share→community (members only), durable board posts, chat membership | 0.63.1 |
| 3 | Connection request→inbox→accept/decline end-to-end | 0.63.2 |
| 4 | Cross-account comments/replies, soft poll, vote count mapping | 0.63.3 |
| 5 | Operator gate, expanded social E2E, evidence checklist | 0.63.4 |

## Static commands (no secrets)

```bash
npm run operator:phase5-gate
# or
node scripts/operator-phase5-gate.mjs
```

Runs: jsx-safety, multiuser migration inventory, migration def verify (when scripts present).

## Live two-account commands (local only — never commit cookies)

```bash
export GHC_E2E_BASE_URL="https://your-preview.vercel.app"
export GHC_E2E_COOKIE_A="..."   # session for user A
export GHC_E2E_COOKIE_B="..."   # session for user B
npm run operator:live-e2e-social
# optional media DM
npm run operator:live-e2e-media-dm
# full phase 5 including live
node scripts/operator-phase5-gate.mjs --live
```

### Covered live stages (social)

- Distinct identities A/B  
- Unauthenticated post rejected  
- Connection request A→B, B inbox, B accept, IDOR blocked  
- Follow A→B visible on B  
- Post by A durable  
- Like B→A post, A feed like count  
- Comment B, A readback; reply A, B readback; comment emoji  
- Curation upvote + downvote  
- Reaction toggle off  
- Discover lists people  
- Messaging / marketplace / story soft probes  

## Env flags

| Flag | Purpose |
|------|---------|
| `GHC_ACTIVITY_REWARDS_ENABLED=1` | Mission GHC via activity emission (optional) |
| Supabase URL + service role | Required for durable social / connections |

## Mainnet note

Preview/Testnet PASS ≠ Mainnet ready. Apply migrations on the target DB, run live probes against that host, then promote.

## Safety

No ledger authority moved to the client. No invented balances. Fail-closed when `durable: false`.

> HISTORICAL SNAPSHOT — dated findings and test counts are not current release evidence. Check `docs/PROJECT_TRUTH.md` and the latest CI run.

---

# GreenHaven / GH-CONNECT — Production readiness gate (18 Oct 2026)

## What is verified in source (this series)

| Area | Status | Notes |
|------|--------|--------|
| Comments / replies server-first | Source PASS | No local-only success |
| Connection / follow / accept server-first | Source PASS | Durable required |
| Likes / reactions / curation server-first | Source PASS | Durable required |
| Connection inbox hydrate on focus | Source PASS | 12s foreground + mutation |
| Notification deep-links | Source PASS | Inbox, post, comments, messages |
| Message notification → conversation | Source PASS | pendingOpen + peer resolve |
| Messaging send / create DM server-first | Source PASS | Online awaits API |
| Messaging list hydrate on focus/mutation | Source PASS | Conversations merge |
| Operator social E2E script | Expanded | Connect, like, comment, reply, emoji, curation, messaging |
| Economy issuance | **Flags default OFF** | Referral + curation redistribute gated |
| Stage 2 financial recovery RPCs | In repo | Stale claim, orphan membership, transfer pair |

## Migration inventory

- **96** SQL files in `supabase/migrations/`
- Current source manifest: `VERIFIED_MANIFEST.txt` (see `docs/PROJECT_TRUTH.md`; dated inventory details in this document are historical).
- Multi-user critical set: `scripts/operator-multiuser-migrations.mjs`
- Economy/recovery review list printed by the same script (not auto-applied)

## Operator commands (local secrets only)

```bash
npm run operator:multiuser-migrations   # if script name maps; else:
node scripts/operator-multiuser-migrations.mjs

node scripts/operator-stage2-financial-gates.mjs

export GHC_E2E_BASE_URL=https://your-preview.vercel.app
export GHC_E2E_COOKIE_A=…
export GHC_E2E_COOKIE_B=…
npm run operator:live-e2e-social
```

## Explicitly NOT claimed

- Live two-account PASS on your Supabase / Vercel  
- Mainnet readiness  
- Referral or curation **issuance** enabled in production  
- All 96 migrations applied to any environment  

## Recommended order before beta

1. Apply multi-user critical migrations on Testnet  
2. Run `operator:live-e2e-social` until PASS  
3. Stage 2 financial gates + recovery RPC review  
4. Only then consider enabling economy feature flags under monitoring  

## Massive passes 4–7 (source)

| Pass | Scope |
|------|--------|
| 4 | Marketplace, community create/join, stories server-first |
| 5 | Create post, join approve/decline, profile honesty |
| 6 | Edit/archive/save/quote fail-closed |
| 7 | Message pin fail-closed; economy program status UI (flags still OFF) |

Referral + curation settlement remain **disabled** until Testnet evidence + operator flag enablement.

| 8 | Offline create_post flush + honest comment-pin local preference |

| 9 | Delete/story offline flush; local-pref honesty; E2E story+marketplace |

| 10 | Marketplace offline listing queue + unified offline orchestrator |

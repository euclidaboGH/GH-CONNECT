# Migration Gap Report — Phase 14A

**Generated:** 2026-10-09T20:54:04Z  
**Scope:** Repository inventory only. **No database connection. No DDL executed.**

---

## 1. Problem statement

Prior release docs claimed **54** canonical migrations (`VERIFIED_MANIFEST.txt`, older checklist language).  
On-disk `supabase/migrations/` now contains **70** `.sql` files.

This is a **documentation and release-control defect**, not proof that Production or Testnet is wrong.

---

## 2. Current classification (script-aligned)

| Class | Count |
|-------|------:|
| REQUIRED | 67 |
| REQUIRES_APPROVAL | 1 |
| PROPOSAL | 2 |
| **Total** | **70** |

Source of truth for class sets: `scripts/print-migration-checklist.mjs`.

---

## 3. What changed after the “54” inventory

Approximate **new / later** groups not reflected in the old manifest:

| Group | Files | Risk if applied without prerequisites |
|-------|-------|----------------------------------------|
| Messaging prefs / post archive | 20261007–20261008 | Needs social core + posts |
| Balance lock / spendable / settle | 20261009–20261012 | Needs ledger RPCs + withdrawal requests |
| GHPV infrastructure | 20261013–20261020 | Needs curation/reputation foundations; settlement system-only |
| Notif types + content rewards | 20261021–20261022 | Content rewards must not imply vote→mint |

---

## 4. Dependency notes (from migration headers)

| File | Dependency / caution |
|------|----------------------|
| `20261009_ghc_balance_lock_and_spendable.sql` | Replaces fragmented locks; needs existing transfer/spend/withdraw RPCs |
| `20261010_ghc_withdrawal_settle_atomic.sql` | Needs withdrawal requests + balance lock |
| `20261013`–`20261020` GHPV | Builds judgment/weight/settlement **infra**; no client mint |
| `20261022_gh_content_rewards.sql` | Explicit: votes do not insert reward mint; distribution separate |
| `20260905_connection_request_intents.sql` | REQUIRES_APPROVAL — operator review |
| `20260906` / `20260907` | PROPOSAL — do not apply by default |

---

## 5. Live database gap (UNKNOWN in this environment)

This agent **did not** connect to Supabase.

| Question | Status here |
|----------|-------------|
| Which migrations are recorded in `supabase_migrations.schema_migrations` (or equivalent)? | **Unknown — operator** |
| Which core tables exist on Testnet? | **Unknown — operator** |
| Is Production behind / ahead of Testnet? | **Unknown — operator** |

### Operator SQL to fill the gap (read-only)

```sql
-- If using Supabase migration history:
select * from supabase_migrations.schema_migrations order by version;

-- Presence probes (safe):
select to_regclass('public.ghc_user_accounts') as accounts,
       to_regclass('public.gh_posts') as posts,
       to_regclass('public.gh_sessions') as sessions,
       to_regclass('public.gh_content_quality_state') as ghpv_quality,
       to_regclass('public.gh_content_rewards') as content_rewards;
```

Compare results to the full inventory in `docs/MIGRATION_CHECKLIST.md`.

---

## 6. Recommended apply stance

1. **Do not** apply all 70 files in one shot to Production.
2. On **Testnet only**, apply missing **REQUIRED** files oldest → newest after presence probes.
3. Hold **REQUIRES_APPROVAL** and **PROPOSAL** until explicit approval.
4. After GHPV / content-rewards apply: re-run economy safety scripts; confirm votes still do not mint GHC.
5. Only then proceed to Phase 14D/E live verification.

---

## 7. Phase 14A deliverables completed

| Deliverable | Path |
|-------------|------|
| Regenerated manifest | `VERIFIED_MANIFEST.txt` |
| Updated checklist | `docs/MIGRATION_CHECKLIST.md` |
| This gap report | `docs/MIGRATION_GAP_REPORT.md` |
| Checklist script staging groups | `scripts/print-migration-checklist.mjs` |
| Testnet gate inventory count | `docs/TESTNET_VERIFICATION_GATE.md` |

**No tables dropped. No RLS disabled. No migrations executed.**

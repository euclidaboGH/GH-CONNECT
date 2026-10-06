# GHPV Audit vs GreenHaven codebase — Resolution

## Verdict

**PASS WITH PHASED IMPLEMENTATION**

Friend specification aligns with existing GreenHaven doctrine (`GH_SOCIAL_ECONOMY`, curation without money, reputation without wallet power). Full 70-point product cannot ship in one release; foundation is implemented as GHPV-0 + GHPV-1.

## Aligned (already true in repo)

| Claim | Evidence |
|-------|----------|
| Vote ≠ GHC mint | Curation Phase 3; reward engine excludes vote minting |
| Balance ≠ vote power | `GH_SOCIAL_ECONOMY.md`, `reputation-levels.ts` |
| Tip intents exist | `gh_tip_intents`, `POST /api/social/tips` |
| Attention signals | `gh_content_events` / attention phase |
| 15 levels + Haven | `gh_reputation_*`, level 7 gate |
| Server authority | RLS deny-all; service_role RPCs |

## Gaps closed in this pass

| Gap | Resolution |
|-----|------------|
| No frozen product law | `docs/GHPV_PROOF_OF_VALUE_FRAMEWORK.md` |
| No judgment tables | Migration `20261013_ghpv_judgment_infrastructure.sql` |
| No CP formula module | `lib/server/ghpv/curation-power.ts` |

## Explicitly deferred (do not fake)

| Item | Phase | Reason |
|------|-------|--------|
| Live consensus settlement job | GHPV-2/4 | Needs Testnet data + tuning |
| Feed rank rewrite | GHPV-3 | Integrate, do not replace blindly |
| Tip ledger settlement | GHPV-5 | Financial; requires approved transfer path + intent status RPC |
| Quality pool payouts | GHPV-6 | Needs real revenue source |
| Stewardship roles UI | GHPV-7 | Privilege model after calibration exists |
| Domain-specific trust vectors | Later | Schema-ready later |

## Security

- No client-writable quality/reputation tables (RLS false).
- No change to `ghc_execute_*` financial RPCs in this pass.
- Tip settlement remains deferred until GHPV-5.


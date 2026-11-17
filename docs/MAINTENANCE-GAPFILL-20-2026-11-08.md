# Maintenance gap-fill (20 items) — 2026-11-08

**Release:** 0.338.0  
**Baseline:** 0.337.0 Phase 10 platform acceptance  

Source maintenance pass. Does **not** mark any programme workstream Verified complete. Production remains **NOT APPROVED**.

| # | Gap / missing part | Fill |
|---:|---|---|
| 1 | 404 recovery lacked Support | `app/not-found.tsx` → Help & support |
| 2 | 404 lacked legal links | Privacy + Terms on not-found |
| 3 | Route error lacked support path | `app/error.tsx` Support · Privacy · Home |
| 4 | robots.txt missing | `app/robots.ts` allow legal/signin, disallow api/admin |
| 5 | sitemap missing for public pages | `app/sitemap.ts` home, signin, privacy, terms, support |
| 6 | Health report lacked programme phase | `programmePhase` on readiness report |
| 7 | Filtering barrel export | `lib/filtering/index.ts` |
| 8 | Settings export safety (Phase 9) | retained `settings-persistence` |
| 9 | Discovery radius clamp (Phase 9) | retained + settings UI |
| 10 | Active filter summary (Phase 9) | `describeActiveFilterSummary` |
| 11 | Relationship integrity (Phase 8) | retained humanize/sanitize |
| 12 | Marketplace humanize (Phase 7) | retained order messages |
| 13 | Own-seller cart strip (Phase 7) | retained `removeOwnSellerCartItems` |
| 14 | Community join honesty (Phase 6) | retained `resolveJoinCta` / `mapJoinStatus` |
| 15 | Discovery candidate filter (Phase 6) | retained self/block/mute filter |
| 16 | Notification deep-link sanitize (Phase 5) | retained |
| 17 | Messaging integrity helpers (Phase 5) | retained |
| 18 | Session cap + step-up rotation (Phase 4) | retained |
| 19 | Programme completion register | retained + this maintenance note |
| 20 | Platform meta-gate (Phase 10) | retained 24/24 + this maintenance gate |

## Operator still owns
- Disposable PostgreSQL concurrency + 3π reconciliation  
- Authenticated Pi Testnet payments  
- Device a11y / performance  
- Live RLS and durable store proof  

## Gate
```bash
node scripts/check-maintenance-gapfill-20.mjs
node scripts/check-phase10-platform-acceptance.mjs
```

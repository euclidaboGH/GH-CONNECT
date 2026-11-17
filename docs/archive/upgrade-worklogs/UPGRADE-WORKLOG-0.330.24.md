# Upgrade worklog — 0.330.24

Date: 2026-11-07  
Baseline: 0.330.23  
Product roadmap position: Priority 3 — Rewards

## Coordinated work completed

- Audited the existing Rewards Centre, claim flow, server snapshot, history and mission verification foundation before changing the UI.
- Split Rewards attention counts into claim-ready (`eligible` / `approved`) and under-review (`pending_validation`) states.
- Included `approved` records in the attention summary and corrected labels that previously described every attention item as a pending claim.
- Added explicit mission-policy copy: verified mission achievements are non-financial under current policy; they do not issue GHC or Pi.
- Removed a duplicate predicate in recommended mission selection.
- Added a Wallet Security & PIN entry and dedicated withdrawal PIN management card, reusing existing authenticated server status/setup and recovery APIs.
- Clarified Pi available, eligible-to-withdraw and reserved balances, and limited self-service release wording to unstarted payout requests.
- Added a source regression contract and registered it in `prebuild` and `verify:static`.
- Updated release metadata, product roadmap, project truth, migration inventory and release documentation.

## Preserved

- No new SQL migration.
- No remote migration applied.
- No Pi or GHC ledger changes.
- No client-side issuance, payout, transfer, settlement or reservation release authority.
- Existing PIN hashing, weak-PIN checks, insert-only setup, rate limits, lockout and recovery behavior.
- Existing Feed completion and the 11-priority roadmap order.

## Verification evidence

- Priority 3 Rewards + Wallet trust: 15/15.
- Rewards entry/history/release/mission contracts: 18/18, 20/20, 15/15, 31/31.
- Wallet Rewards transparency/product transformation/completion: 9/9, 14/14, 12/12.
- Wallet withdrawal journey/release/security: 11/11, 19/19, 11/11.
- Project truth/release hygiene/repository consistency/migration inventory: 10/10, 11/11, 6/6, 191/191.

The Node runtime check correctly reports the environment as unsupported: available Node is 22.16.0, while `.nvmrc` and `package.json` require 24.15.0. Therefore no dependency-backed typecheck, lint or Next.js production build is claimed. Browser/device, Testnet and operator acceptance remain open.

## Next work

Continue Priority 3 with reward-history cursor pagination, mission evidence and lifecycle detail where the existing APIs can authoritatively supply it. Separately investigate each affected Pi account's ledger reservations and provider request outcomes before any balance correction. Do not start Priority 4 Membership until the Rewards source transformation and its required acceptance checklist are reviewed.

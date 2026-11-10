# GreenHaven programme completion register

Allowed states only: `Not started` | `Audited` | `Implemented, awaiting verification` | `Verified complete`

| # | Workstream | State | Notes |
|---:|---|---|---|
| 1 | Feed — full reliability and functional acceptance | Implemented, awaiting verification | Source gates exist; live feed/device acceptance open |
| 2 | Wallet & Payments — financial integrity and security | Implemented, awaiting verification | Phase 3 operator kit; no Mainnet A2U |
| 3 | Rewards & Membership — earning, redemption, entitlement | Implemented, awaiting verification | Closeout 43/43 source; migration REVIEW_REQUIRED |
| 4 | Identity & Authentication | Implemented, awaiting verification | Session cap, step-up rotation; durable store acceptance open |
| 5 | Messages & Notifications | Implemented, awaiting verification | Deep-link sanitize; Web Push device acceptance open |
| 6 | Communities & Discovery | Implemented, awaiting verification | Honest join status; live membership RPC acceptance open |
| 7 | Marketplace | Implemented, awaiting verification | Humanized orders; live stock/payment Testnet open |
| 8 | Profile & Matching | Implemented, awaiting verification | Relationship integrity; cross-account E2E open |
| 9 | Settings & Filters | Implemented, awaiting verification | Safe export; filter primitives |
| 10 | Platform-wide acceptance | Implemented, awaiting verification | Phase 10 release closure is now wired into prebuild, complete static verification and CI; Node 24.15.0 build, live services, Testnet and device/operator evidence remain open; production NOT APPROVED |

No workstream may move to **Verified complete** from static checks alone.


## Maintenance
- 0.338.0 gap-fill 20. States unchanged.

## Phase 2 database integrity (2026-11-09 / 0.338.14)
- State: **Implemented, awaiting verification**
- Source closeout: `docs/PHASE-2-DATABASE-INTEGRITY-CLOSEOUT-2026-11-09.md`
- Gate: `scripts/check-phase2-database-integrity-closeout.mjs`
- Remote migration apply, Testnet/Mainnet history reconciliation and disposable PostgreSQL rehearsal remain open.
- Production remains **NOT APPROVED**.

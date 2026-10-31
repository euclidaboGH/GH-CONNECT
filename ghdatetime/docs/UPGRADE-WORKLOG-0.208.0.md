# Upgrade worklog — 0.208.0

## Phase 1 complete — registration bonus top-up (3 π)

- Policy locked: **3 π** new / **2.95 π** legacy top-up (0.05 + 2.95 = 3).
- Migration + service_role RPCs + claim API + Wallet/Rewards card.
- Legacy **auto-reconcile** on card load when claimable.
- Migration-pending UI when enabled but ledger RPC unavailable.
- Operator doc: `docs/PHASE1_REGISTRATION_TOPUP.md`
- Static contract: `npm run check:phase1-registration-topup` (15/15).

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Live credit still requires operator to apply the migration and enable Testnet flags.

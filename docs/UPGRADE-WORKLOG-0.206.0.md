# Upgrade worklog — 0.206.0

## Dual-asset wallet UX (3 phases)

### Phase 1 — Clean balance card
- Single professional card houses **PI** and **GHC** with balances side-by-side as selectable rows.
- Shared **Send · Request · Receive · History** action row under both assets.
- Asset selection drives rail-aware actions (GHC P2P vs PI earnings tools).

### Phase 2 — History
- Activity / full history use segmented **GHC | PI** tabs (never mixed).
- Bank-style labeling and violet/emerald rail colors.

### Phase 3 — Declutter
- Removed always-visible sandbox utility status and recovery panel from main stack.
- Advanced details accordion for payment recovery + sandbox proof.
- Registration bonus, PI earnings tools, cashback retained without triple-duplicate balance noise.
- Duplicate GHC metrics grid removed (month summary lives on balance card).

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Isolated helper tests; no production mutation claimed.
